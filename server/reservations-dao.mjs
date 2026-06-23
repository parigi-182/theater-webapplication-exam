import { queryDB } from "./db.mjs";
const { dbGet, dbAll, dbRun } = queryDB;

const getSeatPublic = async () => {
    return await dbAll('SELECT * FROM v_seats_public', []);
};

const getTotalSeats = async () => {
    const row = await dbGet('SELECT COUNT(*) AS count FROM seats', []);
    return row.count;
};

const getSeatsForUser = async (userId) => {
    return await dbAll(`
        SELECT s.seat_id, s.row_label, s.seat_num, s.category,
            CASE WHEN s.user_id IS NULL THEN 'free' WHEN s.user_id = ? THEN 'mine' ELSE 'taken' END AS status,
            CASE WHEN rs.seat_id IS NOT NULL THEN 1 ELSE 0 END AS too_early
        FROM v_seat_status s
        LEFT JOIN released_seats rs
            ON rs.seat_id = s.seat_id
            AND rs.user_id = ?
            AND (strftime('%s','now') - strftime('%s', rs.released_at)) < 40
            AND s.user_id IS NULL
    `, [userId, userId]);
};

const getSeatsAdmin = async () => {
    return await dbAll(`
        SELECT seat_id, row_label, seat_num, category, user_id, username,
            CASE WHEN user_id IS NULL THEN 'free' ELSE 'taken' END AS status
        FROM v_seat_status
    `, []);
};

const getReservationById = async (reservationId) => {
    return await dbGet(
        'SELECT r.id, r.user_id, r.seat_id, r.created_at, s.row_label, s.seat_num, s.category ' +
        'FROM reservations r JOIN seats s ON s.id = r.seat_id WHERE r.id = ?',
        [reservationId]
    );
};

const getReservationByUser = async (userId) => {
    return await dbAll(
        'SELECT r.id, r.user_id, r.seat_id, r.created_at, s.row_label, s.seat_num, s.category ' +
        'FROM reservations r JOIN seats s ON s.id = r.seat_id WHERE r.user_id = ?',
        [userId]
    );
};

const getAllReservations = async () => {
    return await dbAll(
        'SELECT r.id, r.user_id, r.seat_id, r.created_at, s.row_label, s.seat_num, s.category, u.username ' +
        'FROM reservations r JOIN seats s ON s.id = r.seat_id JOIN users u ON u.id = r.user_id ' +
        'ORDER BY u.username, s.row_label, s.seat_num',
        []
    );
};

const createReservation = async (userId, seatIds) => {
    const existing = await dbAll('SELECT id FROM reservations WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
        console.warn(`[dao] createReservation: user ${userId} already has a reservation`);
        throw { status: 403, errors: ['You already have a reservation'] };
    }

    const blocked = await checkReleasedSeats(userId, seatIds);
    if (blocked.length > 0) {
        console.warn(`[dao] createReservation: user ${userId} is in cooldown for seats`, blocked);
        throw { status: 403, errors: ['One or more seats are temporarily unavailable (cooldown)'] };
    }

    try {
        await dbRun('BEGIN', []);
        for (const seatId of seatIds) {
            await dbRun('INSERT INTO reservations (user_id, seat_id) VALUES (?,?)', [userId, seatId]);
        }
        await dbRun('COMMIT', []);
        console.log(`[dao] createReservation: user ${userId} reserved seats`, seatIds);
    } catch (err) {
        try { await dbRun('ROLLBACK', []); } catch (_) {}
        // Re-throw known domain errors (cooldown, already-reserved) unchanged
        if (err.status) throw err;
        console.error(`[dao] createReservation: DB error for user ${userId}:`, err);
        throw { status: 409, errors: ['One or more seats are already taken'] };
    }
};

const autoReserve = async (userId, category, nseats) => {
    const rows = await dbAll(
        'SELECT row_label FROM v_seats_public WHERE category = ? AND status = "free" ' +
        'GROUP BY row_label HAVING COUNT(*) >= ?',
        [category, nseats]
    );

    let selectedSeats;
    if (rows.length > 0) {
        const rowLabel = rows[0].row_label;
        const seats = await dbAll(
            'SELECT seat_id FROM v_seats_public WHERE category = ? AND status = "free" AND row_label = ? ORDER BY seat_num LIMIT ?',
            [category, rowLabel, nseats]
        );
        selectedSeats = seats.map(s => s.seat_id);
        console.log(`[dao] autoReserve: found consecutive seats in row "${rowLabel}" for user ${userId}`);
    } else {
        const seats = await dbAll(
            'SELECT seat_id FROM v_seats_public WHERE category = ? AND status = "free" ORDER BY row_label, seat_num LIMIT ?',
            [category, nseats]
        );
        if (seats.length < nseats) {
            console.warn(`[dao] autoReserve: not enough free "${category}" seats for user ${userId} (requested ${nseats}, available ${seats.length})`);
            throw { status: 409, errors: ['Not enough free seats available in that category'] };
        }
        selectedSeats = seats.map(s => s.seat_id);
        console.log(`[dao] autoReserve: falling back to scattered seats for user ${userId}`);
    }

    await createReservation(userId, selectedSeats);
    return selectedSeats;
};

const updateReservation = async (reservationId, seatIds) => {
    const ref = await dbGet('SELECT user_id FROM reservations WHERE id = ?', [reservationId]);
    if (!ref) {
        console.warn(`[dao] updateReservation: reservation id=${reservationId} not found`);
        throw { status: 404, errors: ['Reservation not found'] };
    }
    const userId = ref.user_id;

    const current = await dbAll('SELECT seat_id FROM reservations WHERE user_id = ?', [userId]);
    const currentIds = current.map(r => r.seat_id);

    const toRemove = currentIds.filter(id => !seatIds.includes(id));
    const toAdd    = seatIds.filter(id => !currentIds.includes(id));

    const blocked = await checkReleasedSeats(userId, toAdd);
    if (blocked.length > 0) {
        console.warn(`[dao] updateReservation: user ${userId} is in cooldown for seats`, blocked);
        throw { status: 403, errors: ['One or more seats are temporarily unavailable (cooldown)'] };
    }

    try {
        await dbRun('BEGIN', []);

        if (toRemove.length > 0) {
            const placeholders = toRemove.map(() => '?').join(',');
            await dbRun(
                `DELETE FROM reservations WHERE user_id = ? AND seat_id IN (${placeholders})`,
                [userId, ...toRemove]
            );
            // Log released seats inside the transaction so a failure rolls everything back
            for (const seatId of toRemove) {
                await dbRun('INSERT INTO released_seats (user_id, seat_id) VALUES (?,?)', [userId, seatId]);
            }
        }

        for (const seatId of toAdd) {
            await dbRun('INSERT INTO reservations (user_id, seat_id) VALUES (?, ?)', [userId, seatId]);
        }

        await dbRun('COMMIT', []);
        console.log(`[dao] updateReservation: user ${userId} — removed`, toRemove, '— added', toAdd);
    } catch (err) {
        try { await dbRun('ROLLBACK', []); } catch (_) {}
        // Re-throw known domain errors unchanged
        if (err.status) throw err;
        console.error(`[dao] updateReservation: DB error for reservation id=${reservationId}:`, err);
        throw { status: 409, errors: ['One or more seats are already taken'] };
    }
};

const deleteReservation = async (reservationId) => {
    const ref = await dbGet('SELECT user_id FROM reservations WHERE id = ?', [reservationId]);
    if (!ref) {
        console.warn(`[dao] deleteReservation: reservation id=${reservationId} not found`);
        throw { status: 404, errors: ['Reservation not found'] };
    }
    const userId = ref.user_id;

    try {
        const seats = await dbAll('SELECT seat_id FROM reservations WHERE user_id = ?', [userId]);
        const seatIds = seats.map(s => s.seat_id);

        await dbRun('BEGIN', []);
        await dbRun('DELETE FROM reservations WHERE user_id = ?', [userId]);
        for (const seatId of seatIds) {
            await dbRun('INSERT INTO released_seats (user_id, seat_id) VALUES (?,?)', [userId, seatId]);
        }
        await dbRun('COMMIT', []);
        console.log(`[dao] deleteReservation: user ${userId} — released seats`, seatIds);
    } catch (err) {
        try { await dbRun('ROLLBACK', []); } catch (_) {}
        if (err.status) throw err;
        console.error(`[dao] deleteReservation: DB error for reservation id=${reservationId}:`, err);
        throw { status: 500, errors: ['Server error while deleting reservation'] };
    }
};

const checkReleasedSeats = async (userId, seatIds) => {
    if (seatIds.length === 0) return [];
    const placeholders = seatIds.map(() => '?').join(',');
    const rows = await dbAll(
        `SELECT seat_id FROM released_seats WHERE user_id = ? AND seat_id IN(${placeholders}) AND (strftime('%s', 'now') - strftime('%s', released_at)) < 40`,
        [userId, ...seatIds]
    );
    return rows.map(r => r.seat_id);
};

// NOTE: logReleasedSeats is kept for any future external use but
// internally all callers now inline the INSERT inside their own transaction.
const logReleasedSeats = async (userId, seatIds) => {
    try {
        for (const seatId of seatIds) {
            await dbRun('INSERT INTO released_seats (user_id, seat_id) VALUES (?,?)', [userId, seatId]);
        }
    } catch (err) {
        console.error(`[dao] logReleasedSeats: failed for user ${userId}, seats`, seatIds, err);
        throw { status: 500, errors: ['Server error while logging released seats'] };
    }
};

const reservationsDao = {
    getSeatPublic, getSeatsForUser, getSeatsAdmin,
    getReservationById, getReservationByUser, getAllReservations,
    createReservation, autoReserve, updateReservation, deleteReservation,
    getTotalSeats
};

export { reservationsDao };
