import '../seats.css';
import stageImg from '../assets/stage2.jpg';
import { Container } from 'react-bootstrap';
function getSeatState(seat, selectedSeats, myReservation, editingId) {
    const id = seat.seat_id ?? seat.id;
    const isSelected = selectedSeats.has(id);
    const isMine = myReservation?.seatIds?.includes(id);

    if (editingId) {
        if (isMine && isSelected) return 'editing-kept';
        if (isSelected) return 'selected';
        if (isMine) return 'free';
        if (seat.status === 'taken') return 'taken';
        if (seat.too_early) return 'too-early';
        return seat.category === 'premium' ? 'free-premium' : 'free';
    }

    if (isSelected) return 'selected';
    if (isMine) return 'mine';
    if (seat.status === 'taken') return 'taken';
    if (seat.too_early) return 'too-early';
    return seat.category === 'premium' ? 'free-premium' : 'free';
}

function SeatButton({ seat, state, onClick, isAdmin }) {
    const label = `${seat.row_label}${seat.seat_num}`;
    const adminInfo = isAdmin && seat.username ? ` — ${seat.username}` : '';
    return (
        <button
            title={label + adminInfo}
            onClick={() => onClick(seat)}
            disabled={state === 'taken' || state === 'too-early'}
            data-state={state}
        >
            {seat.seat_num}
        </button>
    );
}

function TheatreMap({ seats, selectedSeats, onSeatClick, myReservation, editingId, isAdmin }) {
    const map = new Map();
    for (const seat of seats) {
        const row = seat.row_label;
        if (!map.has(row)) map.set(row, []);
        map.get(row).push(seat);
    }
    const rows = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([row, rowSeats]) => ({
            row,
            seats: rowSeats.sort((a, b) => a.seat_num - b.seat_num),
        }));

    const legend = [
        { state: 'free',         label: 'Free' },
        { state: 'free-premium', label: 'Premium' },
        { state: 'selected',     label: 'Selected' },
        { state: 'mine',         label: 'Mine' },
        { state: 'taken',        label: 'Taken' },
        { state: 'too-early',    label: 'Unavailable' },
    ];

    return (
        <Container>
            <div>
                <img src={stageImg} className='stage-img'></img>
            </div>

        <div className="card mb-3">
            <div className="card-body">
                
                
                <div className="d-flex flex-wrap gap-3 pt-2 border-top mb-3">
                    {legend.map(({ state, label }) => (
                        <span key={state} className="d-flex align-items-center gap-1 small text-muted">
                            <span data-state={state} className='legend'/>
                            {label}
                        </span>
                    ))}
                </div>

                <div className="mb-3">
                    {rows.map(({ row, seats: rowSeats }) => (
                        <div key={row} className="theatre-row">
                            <span className="theatre-row-label">{row}</span>
                            {rowSeats.map(seat => (
                                <SeatButton
                                key={seat.seat_id ?? seat.id}
                                seat={seat}
                                state={getSeatState(seat, selectedSeats, myReservation, editingId)}
                                onClick={onSeatClick}
                                isAdmin={isAdmin}
                                />
                            ))}
                        </div>
                    ))}
                </div>

            </div>
        </div>
                    </Container>
    );
}

export { TheatreMap };