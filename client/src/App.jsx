import { useState, useEffect} from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router';
import { Container, Alert}from 'react-bootstrap';
import { API }             from './API';
import { Navigation }      from './components/Navigation';
import { TheatreMap }      from './components/Theatre';
import { Sidebar }         from './components/Sidebar';
import { LoginLayout }     from './components/LoginLayout';
import { TotpLayout }      from './components/TotpLayout';
import { NotFoundLayout }  from './components/NotFoundLayout';
import { SelectionPanel, AdminPanel }    from './components/Reservations';
import './seats.css';
import 'bootstrap/dist/css/bootstrap.min.css';
function App() {

    const [user, setUser] = useState(null);
    const [seats, setSeats] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState(new Set());
    const [myReservations, setMyReservations] = useState(null);
    const [allReservations, setAllReservations] = useState([]);
    const [editingReservation, setEditingReservation] = useState(null);
    const [message, setMessage] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [errors, setErrors] = useState([]);
    const navigate = useNavigate();
    const [pendingUser, setPendingUser] = useState(null);


    useEffect(()=>{
       API.getSession()
       .then(u=> setUser(u))
       .catch(()=> setUser(null));
    },[]);

    useEffect(()=>{
        loadSeats();
        if(!user){
            setMyReservations(null);
            setAllReservations([]);
            setEditingId(null);
            setEditingReservation(null);
        }else if(user.isAdmin && user.totpVerified){
            setMyReservations(null);
            loadAllReservations();
        }else{
            loadResevations();
        }
    },[user]);

    useEffect(() => {
        if (editingId) {
            loadSeats();
        } else {
            setSelectedSeats(new Set());
            setEditingReservation(null);
        }
        loadSeats();
    }, [editingId]);

    const isAdmin = user?.isAdmin && user?.totpVerified;

    const loadSeats = () =>{
        return API.fetchSeats()
            .then(setSeats)
            .catch(() => setErrors('Could not load seats'));
    };

    const loadResevations = () =>{
        return API.fetchMySeats()
            .then(reservations =>{
                if (reservations.length === 0) {
                    setMyReservations(null);
                } else {
                    setMyReservations({ id: reservations[0].id, seatIds: reservations.map(r => r.seat_id) });                }
            })
            .catch(() => setErrors('Could not load reservations'));
    };

    const loadAllReservations = () => {
        return API.fetchAllReservations()
            .then(rows => {
                const map = new Map();
                for (const r of rows) {
                    if (!map.has(r.user_id)) map.set(r.user_id, { id: r.id, userId: r.user_id, username: r.username, seats: [] });
                        map.get(r.user_id).seats.push({ seat_id: r.seat_id, row_label: r.row_label, seat_num: r.seat_num, category: r.category });
                    }
                    setAllReservations([...map.values()]);
                })          
            .catch(() => setMessage('Could not load all reservations'));
    };


    const handleLogin = (credentials) =>{
        return API.logIn(credentials)
                    .then(u=>{
                        if(u.needsTotp && credentials.actAsAdmin){
                            setPendingUser(u);
                            navigate('/totp');
                        } else {
                            setUser(u);
                            navigate('/');
                            if (selectedSeats.size > 0) {
                                API.reserveSeats([...selectedSeats])
                                .then(() => {
                                    setSelectedSeats(new Set());
                                    setMessage('Reservation confirmed');
                                    loadSeats();
                                    loadResevations();
                                })
                                .catch(err => {
                                setSelectedSeats(new Set());
                                setErrors(Array.isArray(err) ? err : ['Reservation failed']);
                                loadSeats();
                                loadResevations();
                                });
                            }
                        }
                    });
    };

    const handleTotp = (token) =>{
        return API.logInTotp({code: token})
            .then(()=>{
                setUser(prev => ({ ...prev, ...pendingUser, totpVerified: true }));
                setPendingUser(null);
                navigate('/');
            })
    };

    const handleLogout = () =>{
        API.logOut()
            .catch(()=>{
                setMessage("Logout failed.");
            }).finally(()=>{
                if(myReservations) setSelectedSeats(new Set());
                setUser(null);
                setMyReservations(null);
                setEditingId(null);
                setMessage('');
                loadSeats();
                navigate('/');
            });
    };

    const currentEditTarget = editingId
    ? (editingReservation ? { seatIds: editingReservation.seats.map(s => s.seat_id) } : myReservations)
    : null;

    const handleSeatClick = (seat) => {
    if (seat.too_early) return;
    const id = seat.seat_id ?? seat.id;

    // If the user has a reservation and is NOT in edit mode, block all clicks
    if (myReservations && !editingId) return;

    const isBeingEdited = currentEditTarget?.seatIds?.includes(id);

    if (!isBeingEdited) {
        if (seat.status === 'taken') return;
        if (seat.status === 'mine' && !editingId) return;
    }

    setSelectedSeats(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    };

    const handleReserve = () =>{
        return API.reserveSeats([...selectedSeats])
                    .then(()=>{
                        setSelectedSeats(new Set());
                        setMessage('Reservation confirmed');
                        return Promise.all([loadSeats(), loadResevations()]);
                    })
                    .catch(err => setErrors(Array.isArray(err) ? err : ['Reservation failed']));
    };

    const handleAutoReserve = (category, nseats) =>{
        return API.autoReservation(category, nseats)
                    .then(()=>{
                        setMessage('Reservation confirmed');
                        return Promise.all([loadSeats(), loadResevations()]);
                    })
                    .catch(err => setErrors(Array.isArray(err) ? err : ['Reservation failed']));
    };

    const handleAdminStartEdit = (reservation) => {
        setEditingReservation(reservation);
        setSelectedSeats(new Set(reservation.seats.map(s => s.seat_id)));
        setEditingId(reservation.id);
    };

    const handleUpdate = (reservationId) => {
        if(selectedSeats.size===0) return handleDelete(reservationId);
        return API.updateReservation(reservationId, [...selectedSeats])
                    .then(() =>{
                        setEditingId(null);
                        setSelectedSeats(new Set());
                        setMessage('Reservation updated');
                        if (isAdmin) return Promise.all([loadSeats(), loadAllReservations()]);
                        return Promise.all([loadSeats(), loadResevations()]);
                    })
                    .catch(err => setErrors(Array.isArray(err) ? err : ['Update failed']));
    };

    const handleDelete = (reservationId) => {
        return API.deleteReservation(reservationId)
                    .then(()=>{
                        setMyReservations(null);
                        setEditingId(null);
                        setMessage('Reservation deleted');
                        if (isAdmin) return Promise.all([loadSeats(), loadAllReservations()]);
                        return Promise.all([loadSeats(), loadResevations()]);
                    })
                    .catch(err => setErrors(Array.isArray(err) ? err : ['Delete failed']));
    };

    const handleStartEdit = (reservationId) => {
        if(myReservations){
            setSelectedSeats(new Set(myReservations.seatIds));
        }
        setEditingId(reservationId);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setSelectedSeats(new Set());
    };

    return (
  
            <Routes>
                <Route path="/" element={
                    <Container fluid>
                        <Navigation user={user} logOut={handleLogout} />
                            {message && ( <Alert variant="success" dismissible onClose={() => setMessage('')}>
                                {message}
                            </Alert>)}
                                {errors.length > 0 && (
                                    <Alert variant="danger" dismissible onClose={() => setErrors([])}>
                                        {errors.map((e, i) => <div key={i}>{e}</div>)}
                                    </Alert>
                                )}
                            <Container fluid className="p-3 main-layout">
                                <div className='main-content'>
                                    <TheatreMap
                                        seats={seats}
                                        selectedSeats={selectedSeats}
                                        onSeatClick={handleSeatClick}
                                        myReservation={editingId ? currentEditTarget : myReservations}
                                        editingId={editingId}
                                        isAdmin={isAdmin}
                                    />

                                    {isAdmin && !editingId && (
                                        <AdminPanel
                                            reservations={allReservations}
                                            onEdit={handleAdminStartEdit}
                                            onDelete={handleDelete}
                                        />
                                    )}

                                    {!myReservations && !editingId && !isAdmin && (
                                        <SelectionPanel
                                            seats={seats}
                                            selectedSeats={selectedSeats}
                                            onReserve={handleReserve}
                                            loggedIn={!!user}
                                        />
                                    )}

                                    {user && editingId && (
                                        <SelectionPanel
                                            seats={seats}
                                            selectedSeats={selectedSeats}
                                            editingId={editingId}
                                            myReservation={currentEditTarget}
                                            editingLabel={editingReservation
                                                ? `Editing reservation of ${editingReservation.username}`
                                                : null}
                                            onUpdate={handleUpdate}
                                            onCancelEdit={handleCancelEdit}
                                        />
                                    )}
                                </div>

                                {user && !isAdmin && (
                                    
                                        <div className='sidebar-container'>
                                            <Sidebar
                                                seats={seats}
                                                myReservation={myReservations}
                                                onStartEdit={handleStartEdit}
                                                onAutoReserve={handleAutoReserve}
                                                onDelete={handleDelete}
                                            />
                                        </div>
                                )}
                            
                    </Container>
                </Container>
                } />
                <Route path="/login" element={
                    user ? <Navigate to="/" /> : <LoginLayout login={handleLogin} goBack={()=>{navigate('/')}} />
                } />
                <Route path="/totp" element={
                    pendingUser ? <TotpLayout totpVerify={handleTotp} logOut={handleLogout} /> : <Navigate to="/login" />
                } />
                <Route path="*" element={<NotFoundLayout />} />
            </Routes>
    );




};

export default App;