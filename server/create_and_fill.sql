-- Tables creation

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    totp_secret   TEXT             DEFAULT NULL,
    last_totp_step  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seats (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    row_label TEXT    NOT NULL, 
    category  TEXT NOT NULL DEFAULT 'normal' CHECK (category IN ('premium','normal')),
    seat_num  INTEGER NOT NULL CHECK (seat_num >= 1),
    UNIQUE (row_label, seat_num)
);

CREATE TABLE IF NOT EXISTS reservations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_id    INTEGER NOT NULL REFERENCES seats(id),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (seat_id)
);

CREATE TABLE IF NOT EXISTS released_seats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_id     INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    released_at TEXT    NOT NULL DEFAULT (datetime('now'))
);


-- Filling examples [passwords are user names]

INSERT INTO users (username, password_hash, salt, is_admin, totp_secret, last_totp_step) VALUES
    ('alice',  '94c9af0d678b297b32d47e7f154d7685300829a669f2d8691d6368a3f78eeb12cf6ab51155336b1e9f948b0022feb3175f596abfa794a14f627a339a7499d15b',  '159de99ae86900d518cd73024c9f2c43',  0, NULL, NULL),
    ('bob',    'f71632f884c6d14062fb8f83fdd8d1204bd38db1097b69e1b3eec42a438c20d77703f12ae7d301745f81274f05a384d830d2964d97600b5839fc83a772b12e42',    'c143a2225cf3c044304b0a3492ee8585',    0, NULL, NULL),
    ('admin1', 'e306f46dc3dbdd64558a9a82006841764c6d5202801046c8291475c2c51b76507d978292ec0555b5b58838bda7244a30caf9eef568a4ab0f12a4cef5b684ba23', '7db2f02f0c1e31e9f68b6e4698292c6d', 1, 'LXBSMDTMSP2I5XFXIYRGFVWSFI', NULL),
    ('admin2', 'fac9bba7b91eb28a24b3d6467ac5118cee5cf66553b4f49e57fafe94473232296ce317f1aefb865be8b1816039985785348a1f87266a609ef44d69ba9c63b7b6', 'ca81097b86fbfdf447a0aa62fd80c652', 1, 'LXBSMDTMSP2I5XFXIYRGFVWSFI', NULL);

INSERT INTO seats (row_label, seat_num, category) VALUES
    ('A', 1, 'premium'), ('A', 2, 'premium'), ('A', 3, 'premium'), ('A', 4, 'premium'),
    ('A', 5, 'premium'), ('A', 6, 'premium'), ('A', 7, 'premium'), ('A', 8, 'premium');

INSERT INTO seats (row_label, seat_num, category) VALUES
    ('B', 1, 'premium'), ('B', 2, 'premium'), ('B', 3, 'premium'), ('B', 4, 'premium'),
    ('B', 5, 'premium'), ('B', 6, 'premium'), ('B', 7, 'premium'), ('B', 8, 'premium'),
    ('B', 9, 'premium'), ('B', 10, 'premium');
 
INSERT INTO seats (row_label, seat_num, category) VALUES
    ('C', 1, 'normal'), ('C', 2, 'normal'), ('C', 3, 'normal'),  ('C', 4, 'normal'),
    ('C', 5, 'normal'), ('C', 6, 'normal'), ('C', 7, 'normal'),  ('C', 8, 'normal'),
    ('C', 9, 'normal'), ('C', 10, 'normal'), ('C', 11, 'normal'), ('C', 12, 'normal');
 
INSERT INTO seats (row_label, seat_num, category) VALUES
    ('D', 1, 'normal'), ('D', 2, 'normal'), ('D', 3, 'normal'), ('D', 4, 'normal'),
    ('D', 5, 'normal'), ('D', 6, 'normal'), ('D', 7, 'normal'), ('D', 8, 'normal'),
    ('D', 9, 'normal');


INSERT INTO reservations (user_id, seat_id) VALUES (1, 1);
INSERT INTO reservations (user_id, seat_id) VALUES (1, 2); 
INSERT INTO reservations (user_id, seat_id) VALUES (2, 19);
INSERT INTO reservations (user_id, seat_id) VALUES (2, 20);
INSERT INTO reservations (user_id, seat_id) VALUES (2, 21);
INSERT INTO reservations (user_id, seat_id) VALUES (1, 9);
INSERT INTO reservations (user_id, seat_id) VALUES (1, 10);
INSERT INTO reservations (user_id, seat_id) VALUES (3, 29);
INSERT INTO reservations (user_id, seat_id) VALUES (3, 30);
INSERT INTO reservations (user_id, seat_id) VALUES (3, 31);
 
-- View

CREATE VIEW IF NOT EXISTS v_seats_public AS
SELECT
    s.id        AS seat_id,
    s.row_label,
    s.seat_num,
    s.category,
    CASE WHEN r.id IS NULL THEN 'free' ELSE 'taken' END AS status
FROM seats s
LEFT JOIN reservations r ON r.seat_id = s.id;

CREATE VIEW IF NOT EXISTS v_seat_status AS
SELECT
    s.id          AS seat_id,
    s.row_label,
    s.seat_num,
    s.category,
    r.id          AS reservation_id,
    r.user_id,
    u.username
FROM seats s
LEFT JOIN reservations r ON r.seat_id = s.id
LEFT JOIN users u        ON u.id = r.user_id;
