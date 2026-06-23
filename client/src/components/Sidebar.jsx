import { useState } from 'react';
import { Card, Button, Form, Alert, ListGroup, Badge } from 'react-bootstrap';

import '../seats.css';
function Sidebar({seats, myReservation,
    onStartEdit, onAutoReserve, onDelete}) {

    const [show, setShow] = useState(false);
    const [autoCategory, setAutoCategory] = useState('normal');
    const [autoNseats, setAutoNseats] = useState(1);
    const [loading, setLoading] = useState(false);

    const run = async (fn, ...args) => {
        setLoading(true);
        try { await fn(...args); }
        finally { setLoading(false); }
    };

    const tooEarlyCount = seats.filter(s => s.too_early).length;
    const reservedInfo = myReservation
        ? seats.filter(s => myReservation.seatIds.includes(s.seat_id ?? s.id))
        : [];

    if (!show) {
        return (
            <Card className='sidebar-container'>
            
                <Card.Header>
                <Button variant="primary" onClick={() => setShow(prev => !prev)}>
                    {show ? "Close reservations" : "Reservations"}
                </Button>

                </Card.Header>
            </Card>
        );
    }

    const handleAutoSubmit = (e) => {
        e.preventDefault();
        run(onAutoReserve, autoCategory, Number(autoNseats));
    };

    return (
        <Card className='sidebar-container'>
            
            <Card.Header>
                <Button variant="primary" onClick={() => setShow(prev => !prev)}>
                    {show ? "Close reservations" : "Reservations"}
                </Button>

            </Card.Header>

            {show && (

                    <Card.Body>

                {tooEarlyCount > 0 && !myReservation && (
                    <Alert variant="warning">
                        {tooEarlyCount} Seat(s) temporarily unavailable (~40s cooldown).
                    </Alert>
                )}

                {myReservation ? (
                    <>
                        <p>
                            Your reservation — {myReservation.seatIds.length} seat(s)
                        </p>
                        <ListGroup>
                            {reservedInfo.map(s => (
                                <ListGroup.Item key={s.seat_id ?? s.id} >
                                    {s.row_label}{s.seat_num}
                                    <Badge
                                        className={s.category === 'premium' ? 'badge-premium' : 'badge-normal'}
                                        >{s.category}</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        <div className='m-2'>
                            <Button
                                onClick={() => onStartEdit(myReservation.id)} disabled={loading}>
                                Edit
                            </Button>
                            <Button variant="danger"
                                onClick={() => run(onDelete, myReservation.id)} disabled={loading}>
                                {loading ? '…' : 'Delete'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <p> No active reservation.</p>
                        <hr />
                        <p>Auto-assign seats</p>
                        <Form onSubmit={handleAutoSubmit}>
                            <Form.Group >
                                <Form.Label>Category</Form.Label>
                                <Form.Select value={autoCategory}
                                    onChange={e => setAutoCategory(e.target.value)}>
                                    <option value="normal">Normal</option>
                                    <option value="premium">Premium</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group>
                                <Form.Label>Number of seats</Form.Label>
                                <Form.Control type="number" min={1}
                                    value={autoNseats}
                                    onChange={e => setAutoNseats(e.target.value)} />
                            </Form.Group>
                            <Button type="submit" variant="success" disabled={loading}>
                                {loading ? '…' : 'Auto-assign'}
                            </Button>
                        </Form>
                    </>
                )}
            </Card.Body>
        )}
        </Card>
    );
}

export { Sidebar };