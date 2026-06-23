import crypto from 'crypto';
import { queryDB } from "./db.mjs";

const { dbGet, dbRun } = queryDB;


const getUserById = async (userId) => {
    const row = await dbGet(
        'SELECT id, username, is_admin, totp_secret, last_totp_step FROM users WHERE id = ?',
        [userId]
    );
    if (!row) {
        console.warn(`[dao] getUserById: no user found for id=${userId}`);
        return false;
    }
    return {
        id: row.id,
        username: row.username,
        isAdmin: row.is_admin === 1,
        secret: row.totp_secret,
        lastTotpStep: row.last_totp_step ?? 0
    };
};


const getUser = async (username, password) => {
    const row = await dbGet(
        'SELECT id, username, is_admin, password_hash, salt, totp_secret, last_totp_step FROM users WHERE username = ?',
        [username]
    );
    if (!row) {
        console.warn(`[dao] getUser: unknown username "${username}"`);
        return false;
    }

    const hash = await new Promise((resolve, reject) => {
        crypto.scrypt(password, row.salt, 64, (err, hash) => {
            if (err) return reject(err);
            resolve(hash);
        });
    });

    if (!crypto.timingSafeEqual(hash, Buffer.from(row.password_hash, 'hex'))) {
        console.warn(`[dao] getUser: wrong password for username "${username}"`);
        return false;
    }

    return {
        id: row.id,
        username: row.username,
        isAdmin: row.is_admin === 1,
        secret: row.totp_secret,
        lastTotpStep: row.last_totp_step ?? 0
    };
};


const updateLastTotpStep = async (userId, lastTotpStep) => {
    const result = await dbRun(
        'UPDATE users SET last_totp_step = ? WHERE id = ?',
        [lastTotpStep, userId]
    );
    if (result.changes === 0) {
        console.warn(`[dao] updateLastTotpStep: no rows updated for userId=${userId} – user may not exist`);
    }
};


const userDao = { getUserById, getUser, updateLastTotpStep };
export { userDao };
