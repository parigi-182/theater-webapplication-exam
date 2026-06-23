const SERVER_ADDRESS = "http://localhost";
const SERVER_PORT = 3001;
const API_point = "/api/"

const SERVER_API = `${SERVER_ADDRESS}:${SERVER_PORT}${API_point}`;


const callFunction = async(endpoint, method="GET",  body = undefined, headers = undefined, expectResponse = true)=>{
    
    const response = await fetch((SERVER_API+endpoint), { method, body, headers, credentials: "include" });
    if(response.ok){
        return expectResponse ?  await response.json() : null;
    }
    let parsed;
    try {
        parsed = await response.json();
    } catch {
        throw ["Server error"];
    }
    throw parsed?.errors ?? ["Server error"];
};

const fetchSeats = async () => callFunction("seats")

const fetchMySeats = async () => callFunction("reservations");

const reserveSeats = async (seats) => callFunction(
    "reservations",
    "POST",
    JSON.stringify({seatIds: seats}),
    { "Content-Type": "application/json" },
    false
);

const autoReservation = async (category, nseats) => callFunction(
    "reservations/auto",
    "POST",
    JSON.stringify({category, nseats}),
    { "Content-Type": "application/json" },
    false
);

const updateReservation = async (reservationId, seats) => callFunction(
    `reservations/${reservationId}`,
    "PUT",
    JSON.stringify({seatIds: seats}),
    { "Content-Type": "application/json" },
    false
);

const deleteReservation = async (reservationId) => callFunction(
    `reservations/${reservationId}`,
    "DELETE",
    undefined,
    undefined,
    false
);

const logIn = async (credentials) => callFunction(
    "sessions",
    "POST",
    JSON.stringify(credentials),
    { "Content-Type": "application/json" }
);

const logInTotp = async (totp) => callFunction(
    "sessions/totp",
    "POST",
    JSON.stringify(totp),
    { "Content-Type": "application/json" }
);

const logOut = async () => callFunction(
    "sessions",
    "DELETE",
    undefined,
    undefined,
    false
);
const fetchAllReservations = async () => callFunction("reservations");

const getSession = async () => callFunction("sessions/current");

const API = {
    fetchSeats, fetchMySeats,
    reserveSeats, updateReservation, deleteReservation, autoReservation, fetchAllReservations,
    logIn, logOut, logInTotp, getSession
};

export {API};