[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/qm-fpFT_)

# Exam #1 – "Paris Theatre"
## Student: s355193 Parigi 

---

## React Client Application Routes

| Route | Component | Description |
|---|---|---|
| `/` | `App` (main layout) | Home page – interactive seat map, reservation/selection panel, sidebar for logged-in users, admin panel for verified admins |
| `/login` | `LoginLayout` | Login form with username/password and optional "act as admin" checkbox (triggers 2FA flow) |
| `/totp` | `TotpLayout` | TOTP two-factor verification page; only reachable after a successful first-factor admin login |
| `*` | `NotFoundLayout` | 404 fallback for any unknown path |

---

## API Server

### Sessions

**POST `/api/sessions`** – Login
- Request body: `{ username: string, password: string, actAsAdmin?: boolean }`
- Response: `{ id, username, isAdmin, needsTotp, totpVerified }` or `400` on wrong credentials

**POST `/api/sessions/totp`** – Verify TOTP (second factor)
- Auth required (first factor already done); user must be an admin
- Request body: `{ code: string }` (exactly 6 digits)
- Response: `{ otp: "authorized" }` or `400` on invalid/replayed code
- Sets `totpVerified = true` in the session and persists `lastTotpStep` to the DB (replay protection)

**GET `/api/sessions/current`** – Get the currently authenticated user
- Auth required
- Response: `{ id, username, isAdmin, needsTotp, totpVerified }`

**DELETE `/api/sessions`** – Logout
- Auth required
- Response: `{}`

---

### Seats

**GET `/api/seats`** – Get all seats with their current status
- No auth: returns public view (`free` / `taken` per seat)
- Logged-in user: adds `mine` status for own seats and `too_early` flag (40 s cooldown) for recently released seats
- Verified admin: returns all seats with occupying `username` (if any)
- Response: array of `{ seat_id, row_label, seat_num, category, status, [too_early], [username] }`

---

### Reservations

**GET `/api/reservations`** – Get reservations
- Auth required
- Regular user: array of `{ id, user_id, seat_id, created_at, row_label, seat_num, category }` for their own seats
- Verified admin: same structure plus `username` for every reservation in the system

**POST `/api/reservations`** – Create a reservation (manual seat selection)
- Auth required; user must not already have a reservation
- Request body: `{ seatIds: number[] }` (non-empty, all positive integers, length ≤ total seats)
- Response: `200` on success; `400` if seats already taken, `403` if already has reservation or seats are in cooldown

**POST `/api/reservations/auto`** – Auto-assign seats
- Auth required
- Request body: `{ category: "normal"|"premium", nseats: number }` (nseats ≥ 1)
- Tries to fill consecutive seats in the same row first; falls back to scattered seats across rows
- Response: `200` on success; `403` if not enough free seats of the requested category

**PUT `/api/reservations/:id`** – Update an existing reservation
- Auth required; requester must own the reservation or be a verified admin
- Request body: `{ seatIds: number[] }` (non-empty)
- Adds new seats, removes deselected ones (logging them to `released_seats` for the cooldown)
- Response: `200` on success; `400/403/404` on constraint violations

**DELETE `/api/reservations/:id`** – Delete a reservation
- Auth required; requester must own the reservation or be a verified admin
- Logs all freed seats to `released_seats` for the 40-second cooldown
- Response: `200 {}`

---

## Database Tables

| Table | Columns | Notes |
|---|---|---|
| `users` | `id`, `username`, `password_hash`, `salt`, `is_admin`, `totp_secret`, `last_totp_step` | Passwords hashed with `crypto.scrypt`; `totp_secret` is null for non-admin users; `last_totp_step` prevents TOTP replay |
| `seats` | `id`, `row_label`, `seat_num`, `category` | `category` ∈ `{normal, premium}`; unique on `(row_label, seat_num)` |
| `reservations` | `id`, `user_id`, `seat_id`, `created_at` | `seat_id` is unique (one reservation per seat); cascade-deletes when the user is removed |
| `released_seats` | `id`, `user_id`, `seat_id`, `released_at` | Audit log; seats freed by a user cannot be re-reserved by the same user for 40 seconds |

**Views** (read-only helpers)

| View | Purpose |
|---|---|
| `v_seats_public` | Seat + `free`/`taken` status for unauthenticated queries |
| `v_seat_status` | Seat + reservation + username for per-user and admin queries |

---

## Main React Components

| Component (file) | Purpose |
|---|---|
| `App` (`App.jsx`) | Root of the application – owns all shared state (user, seats, selections, reservations, edit mode) and coordinates every handler passed down as props |
| `Navigation` (`Navigation.jsx`) | Top navbar – displays current username/admin badge and login/logout button |
| `TheatreMap` (`Theatre.jsx`) | Renders the seat grid row-by-row, the colour-coded legend, and the "STAGE" label; delegates state colouring to `getSeatState` |
| `SeatButton` (`Theatre.jsx`) | Single seat button with `data-state` attribute driving CSS; shows admin tooltip with occupant username |
| `SelectionPanel` (`Reservations.jsx`) | Shown when a user has no reservation (seat count + reserve button) *or* while editing (diff view of seats being added/removed + save/cancel) |
| `AdminPanel` (`Reservations.jsx`) | Table of all users' reservations with per-row edit and delete actions; visible only to verified admins |
| `Sidebar` (`Sidebar.jsx`) | Collapsible panel for logged-in regular users – shows their current reservation detail (seat list + edit/delete) or the auto-assign form when they have none |
| `LoginLayout` (`LoginLayout.jsx`) | Controlled login form; validates locally before calling the `login` prop; supports the "act as admin" flag |
| `TotpLayout` (`TotpLayout.jsx`) | TOTP entry form; strips non-digits on input; provides cancel-and-logout escape hatch |
| `NotFoundLayout` (`NotFoundLayout.jsx`) | 404 page with a link back to `/` |

---

## Screenshot


---

## Users Credentials

| Username | Password | Permissions | Notes
|---|---|---|---|
| `alice` | `alice` | Normal user | Has a pre-existing reservation |
| `bob` | `bob` | Normal user | Has a pre-existing reservation |
| `johnny` | `johnny` | Normal user | No pre-existing reservation
| `valerie` | `valerie` | Normal user | No pre-existing reservation
| `admin1` | `admin1` | Admin |
| `admin2` | `admin2` | Admin |