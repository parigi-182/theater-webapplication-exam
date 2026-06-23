import { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import '../App.css';
function LoginLayout({ login , goBack}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [actAsAdmin, setActAsAdmin] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!username) { setError('Username cannot be empty'); return; }
        if (!password) { setError('Password cannot be empty'); return; }
        login({ username, password, actAsAdmin }).catch(() => setError('Invalid username or password'));
    };

    return (
        <Container fluid className='login-container'>
                <Card className='login-card'>
                    <Card.Body className='login-card-body'>
                                <Button type='submit' onClick={goBack} className='back-button'>Go back home</Button> 
                        <Card.Title className='login-card-body-title'>Login</Card.Title>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit} className='login-form'>
                            <Form.Group>
                                <Form.Label>Username</Form.Label>
                                <Form.Control
                                    type="text" value={username} autoFocus
                                    onChange={e => setUsername(e.target.value)} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label>Password</Form.Label>
                                <Form.Control
                                    type="password" value={password}
                                    onChange={e => setPassword(e.target.value)} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Check
                                    type="checkbox"
                                    label="Act as admin (requires 2FA)"
                                    checked={actAsAdmin}
                                    onChange={e => setActAsAdmin(e.target.checked)} />
                            </Form.Group>
                            <Button type="submit">Login</Button>
                        </Form>
                    </Card.Body>
                </Card>
        </Container>
    );
}

export { LoginLayout };