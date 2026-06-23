import { reservationsDao } from "./reservations-dao.mjs";


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  console.warn(`[auth] Unauthenticated access attempt – ${req.method} ${req.path}`);
  return res.status(401).json({ errors: ["Not authenticated"] });
}

function isAdminUser(req, res, next) {
  if (req.user?.isAdmin) return next();
  console.warn(`[auth] Non-admin user "${req.user?.username}" attempted admin-only action – ${req.method} ${req.path}`);
  return res.status(403).json({ errors: ["Forbidden"] });
}

function isAdmin(req, res, next) {
  if (req.user?.isAdmin && req.user?.totpVerified) return next();
  console.warn(`[auth] User "${req.user?.username}" lacks verified-admin status – ${req.method} ${req.path}`);
  return res.status(403).json({ errors: ["Forbidden"] });
}

function otpValidated(req, res, next) {
  const code = req.body?.code;
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    console.warn(`[totp] Malformed OTP code from user "${req.user?.username}"`);
    return res.status(400).json({ errors: ["Invalid OTP format – must be exactly 6 digits"] });
  }
  return next();
}

async function canManageReservation(req, res, next) {
  try {
    const reservation = await reservationsDao.getReservationById(req.params.id);
    if (!reservation) {
      console.warn(`[reservations] Reservation id=${req.params.id} not found (requested by "${req.user?.username}")`);
      return res.status(404).json({ errors: ["Reservation not found"] });
    }

    const isOwner = reservation.user_id === req.user.id;
    const isVerifiedAdmin = req.user.isAdmin && req.user.totpVerified;
    if (isOwner || isVerifiedAdmin) return next();

    console.warn(`[reservations] User "${req.user?.username}" forbidden from managing reservation id=${req.params.id}`);
    return res.status(403).json({ errors: ["Forbidden"] });
  } catch (error) {
    console.error(`[reservations] Error in canManageReservation for id=${req.params.id}:`, error);
    return res.status(500).json({ errors: ["Server error"] });
  }
}

function isTotpVerified(req, res, next) {
  if (req.user?.totpVerified) return next();
  console.warn(`[auth] User "${req.user?.username}" attempted action requiring TOTP verification`);
  return res.status(403).json({ errors: ["Forbidden – TOTP verification required"] });
}

function validateId(req, res, next) {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) {
    console.warn(`[validation] Invalid id param "${req.params.id}" – ${req.method} ${req.path}`);
    return res.status(400).json({ errors: ["Invalid id – must be a positive integer"] });
  }
  req.params.id = id;
  return next();
}

function validateSeatIds(maxSeats) {
  return (req, res, next) => {
    const { seatIds } = req.body;
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      console.warn(`[validation] Missing or empty seatIds from user "${req.user?.username}"`);
      return res.status(400).json({ errors: ["seatIds must be a non-empty array"] });
    }
    if (!seatIds.every(id => Number.isInteger(id) && id > 0)) {
      console.warn(`[validation] Non-positive-integer seatIds from user "${req.user?.username}":`, seatIds);
      return res.status(400).json({ errors: ["seatIds must be positive integers"] });
    }
    if (seatIds.length > maxSeats) {
      console.warn(`[validation] User "${req.user?.username}" requested ${seatIds.length} seats (max ${maxSeats})`);
      return res.status(400).json({ errors: [`Cannot reserve more than ${maxSeats} seats`] });
    }
    return next();
  };
}

function validateAutoReserve(req, res, next) {
  const { category, nseats } = req.body;
  if (!['normal', 'premium'].includes(category)) {
    console.warn(`[validation] Invalid category "${category}" from user "${req.user?.username}"`);
    return res.status(400).json({ errors: ["Invalid category – must be 'normal' or 'premium'"] });
  }
  if (!Number.isInteger(nseats) || nseats < 1) {
    console.warn(`[validation] Invalid nseats "${nseats}" from user "${req.user?.username}"`);
    return res.status(400).json({ errors: ["Invalid nseats – must be a positive integer"] });
  }
  return next();
}

export { isLoggedIn, isAdmin, isAdminUser, canManageReservation, isTotpVerified, validateId, validateSeatIds, validateAutoReserve, otpValidated };
