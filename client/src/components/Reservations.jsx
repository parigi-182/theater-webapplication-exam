import { useNavigate } from "react-router";
import { Badge, Card, Button, Alert, Table } from "react-bootstrap";
import '../App.css';
import '../seats.css';
function SelectionPanel({ seats, selectedSeats, myReservation, editingId, editingLabel,
    onReserve, onUpdate, onCancelEdit, loggedIn }) {

    const navigate = useNavigate();
    const selectedInfo = seats.filter(s => selectedSeats.has(s.seat_id ?? s.id));
    const selectedCount = selectedSeats.size;
    const tooEarlyCount = seats.filter(s => s.too_early).length;

    const originalIds = new Set(myReservation?.seatIds ?? []);
    const toAdd    = selectedInfo.filter(s => !originalIds.has(s.seat_id ?? s.id));
    const toRemove = (myReservation?.seatIds ?? []).filter(id => !selectedSeats.has(id));
    const labelSeat = (id) => {
        const s = seats.find(x => (x.seat_id ?? x.id) === id);
        return s ? `${s.row_label}${s.seat_num}` : id;
    };

    if (editingId) {
        return (
            <Alert variant="info" className="edit-panel">
                <Alert.Heading className="h6">{editingLabel ?? 'Editing reservation'}</Alert.Heading>
                <p>Click seats to add or deselect to remove.</p>
                {selectedCount === 0 && <p> No seats selected — saving will delete the reservation.</p>}
                {toAdd.length > 0    && <p>Adding: {toAdd.map(s => `${s.row_label}${s.seat_num}`).join(', ')}</p>}
                {toRemove.length > 0 && <p>Removing: {toRemove.map(labelSeat).join(', ')}</p>}
                <div className="
                btn.btn-box-save-cancel">
                    <Button className="btn-edit-save" onClick={() => onUpdate(editingId)}>Save changes</Button>
                    <Button className="btn-edit-cancel mx-1" onClick={onCancelEdit}>Cancel</Button>
                </div>
            </Alert>
        );
    }

    return (
        <Card>
            <Card.Body>
                {tooEarlyCount > 0 && (
                    <span>
                        {tooEarlyCount} seat(s) temporarily unavailable (~40s cooldown).
                    </span>
                )}
                {selectedCount === 0
                    ? <span>Click seats on the map to select them.</span>
                    : <>
                        <span>
                            <strong>{selectedCount}</strong> selected:{' '}
                            {selectedInfo.map(s => `${s.row_label}${s.seat_num}`).join(', ')}
                        </span>
                        {loggedIn
                            ? <Button variant="success" onClick={onReserve}>
                                Reserve {selectedCount} seat(s)
                              </Button>
                            : <Button variant="success" onClick={()=>{navigate('/login');}}>
                                Log in to reserve {selectedCount} seat(s)
                              </Button>
                        }
                    </>
                }
            </Card.Body>
        </Card>
    );
};

function AdminPanel({ reservations, onEdit, onDelete }) {
    return (
        <Card>
            <Card.Header>
                All Reservations {reservations.length > 0 && <Badge bg="secondary" className="ms-1">{reservations.length}</Badge>}
            </Card.Header>
            {reservations.length === 0
                ? <Card.Body><p>No reservations yet.</p></Card.Body>
                : <Table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Seats</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {reservations.map(r => (
                            <tr key={r.id}>
                                <td >{r.username}</td>
                                <td>
                                    {r.seats.map(s => `${s.row_label}${s.seat_num}`).join(', ')}
                                </td>
                                <td>
                                    <div>
                                        <Button variant="success" onClick={() => onEdit(r)}>Edit</Button>
                                        <Button onClick={() => onDelete(r.id)}>Delete</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            }
        </Card>
    );
};
export { SelectionPanel, AdminPanel };