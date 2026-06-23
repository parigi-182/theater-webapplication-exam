'use strict';

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import passport from 'passport';
import { TOTP } from 'otpauth';
import { isLoggedIn, canManageReservation,
  validateId, validateSeatIds, validateAutoReserve, isAdminUser, otpValidated } from "./middlewares.mjs";
import { setupUserSession } from './authentication.mjs';
import { reservationsDao } from './reservations-dao.mjs';
import { userDao } from './user-dao.mjs';


const PORT = 3001;

const app = new express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

const TOTAL_SEATS = await reservationsDao.getTotalSeats();
console.log(`[init] Theatre loaded – ${TOTAL_SEATS} total seats`);

setupUserSession(app, userDao);


// ---------------------------------------------------------------------------
// TOTP verification helper
// ---------------------------------------------------------------------------
function verifyTotpToken(user, token) {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: user.secret
  });

  const delta = totp.validate({ token, window: 1 });
  if (delta === null) {
    console.warn(`[totp] Invalid code submitted by user "${user.username}"`);
    return false;
  }

  // actual_step = current time-step + delta (delta can be -1, 0, or +1 with window:1)
  const currentCounter = totp.counter();
  const actualStep = currentCounter + delta;

  if (actualStep <= user.lastTotpStep) {
    console.warn(`[totp] Replayed TOTP code by user "${user.username}" (step ${actualStep} <= last ${user.lastTotpStep})`);
    return false;
  }

  user.lastTotpStep = actualStep;
  return true;
}


// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------
app.get("/api/seats", async (req, res) => {
  try {
    if (req.user?.isAdmin && req.user?.totpVerified) {
      return res.status(200).json(await reservationsDao.getSeatsAdmin());
    }
    if (req.user) {
      return res.status(200).json(await reservationsDao.getSeatsForUser(req.user.id));
    }
    return res.status(200).json(await reservationsDao.getSeatPublic());
  } catch (error) {
    console.error('[seats] GET /api/seats error:', error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});


// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------
app.get("/api/reservations", isLoggedIn, async (req, res) => {
  try {
    if (req.user?.isAdmin && req.user?.totpVerified) {
      return res.status(200).json(await reservationsDao.getAllReservations());
    }
    return res.status(200).json(await reservationsDao.getReservationByUser(req.user.id));
  } catch (error) {
    console.error(`[reservations] GET /api/reservations error (user "${req.user?.username}"):`, error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});

app.post("/api/reservations", isLoggedIn, validateSeatIds(TOTAL_SEATS), async (req, res) => {
  try {
    console.log(`[reservations] User "${req.user.username}" creating reservation for seats`, req.body.seatIds);
    await reservationsDao.createReservation(req.user.id, req.body.seatIds);
    return res.status(201).json({ message: 'Reservation created' });
  } catch (error) {
    console.error(`[reservations] POST /api/reservations error (user "${req.user?.username}"):`, error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});

app.post("/api/reservations/auto", isLoggedIn, validateAutoReserve, async (req, res) => {
  try {
    console.log(`[reservations] User "${req.user.username}" requesting auto-reserve: ${req.body.nseats}x ${req.body.category}`);
    const seatIds = await reservationsDao.autoReserve(req.user.id, req.body.category, req.body.nseats);
    return res.status(201).json({ seatIds });
  } catch (error) {
    console.error(`[reservations] POST /api/reservations/auto error (user "${req.user?.username}"):`, error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});

app.put("/api/reservations/:id", isLoggedIn, validateId, canManageReservation, validateSeatIds(TOTAL_SEATS), async (req, res) => {
  try {
    console.log(`[reservations] User "${req.user.username}" updating reservation id=${req.params.id} with seats`, req.body.seatIds);
    await reservationsDao.updateReservation(req.params.id, req.body.seatIds);
    return res.status(200).json({ message: 'Reservation updated' });
  } catch (error) {
    console.error(`[reservations] PUT /api/reservations/${req.params.id} error (user "${req.user?.username}"):`, error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});

app.delete("/api/reservations/:id", isLoggedIn, validateId, canManageReservation, async (req, res) => {
  try {
    console.log(`[reservations] User "${req.user.username}" deleting reservation id=${req.params.id}`);
    await reservationsDao.deleteReservation(req.params.id);
    return res.status(204).end();
  } catch (error) {
    console.error(`[reservations] DELETE /api/reservations/${req.params.id} error (user "${req.user?.username}"):`, error);
    return res.status(error.status || 500).json({ errors: error.errors || ["Server error"] });
  }
});


// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
function clientUserInfo(req) {
  const user = req.user;
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    needsTotp: !!user.secret,
    totpVerified: req.user.totpVerified ?? false
  };
}

app.get("/api/sessions/current", isLoggedIn, (req, res) => {
  return res.status(200).json(clientUserInfo(req));
});

app.post("/api/sessions", async (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      console.warn(`[auth] Failed login attempt for username "${req.body?.username}"`);
      return res.status(401).json({ errors: [info || "Invalid username or password"] });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      console.log(`[auth] User "${user.username}" logged in`);
      return res.status(200).json(clientUserInfo(req));
    });
  })(req, res, next);
});

app.post("/api/sessions/totp", isLoggedIn, isAdminUser, otpValidated, async (req, res) => {
  if (!req.user.secret) {
    console.warn(`[totp] User "${req.user.username}" has no TOTP secret configured`);
    return res.status(403).json({ errors: ["TOTP not configured for this account"] });
  }

  const success = verifyTotpToken(req.user, req.body.code);
  if (!success) {
    return res.status(401).json({ errors: ["Invalid or expired TOTP code"] });
  }

  req.session.passport.user.totpVerified = true;
  req.user.totpVerified = true;

  try {
    await userDao.updateLastTotpStep(req.user.id, req.user.lastTotpStep);
    console.log(`[totp] User "${req.user.username}" verified – lastTotpStep=${req.user.lastTotpStep}`);
  } catch (error) {
    console.error(`[totp] Failed to persist lastTotpStep for user "${req.user.username}":`, error);
    return res.status(500).json({ errors: ["Server error while persisting TOTP state"] });
  }

  return res.status(200).json({ otp: 'authorized' });
});

app.delete("/api/sessions", isLoggedIn, (req, res) => {
  const username = req.user?.username;
  req.logout((err) => {
    if (err) {
      console.error(`[auth] Logout error for user "${username}":`, err);
      return res.status(500).json({ errors: ["Logout failed"] });
    }
    console.log(`[auth] User "${username}" logged out`);
    return res.status(204).end();
  });
});


// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, (error) => {
  if (error) {
    console.error('[init] Failed to start server:', error);
    process.exit(1);
  } else {
    console.log(`[init] Server listening on port ${PORT}`);
  }
});
