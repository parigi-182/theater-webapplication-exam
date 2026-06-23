import { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';

function TotpLayout({ totpVerify, logOut }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        totpVerify(code).catch(() => setError('Invalid or expired code'));
    };

    return (
        <Container fluid className='login-container'>

                <Card className='login-card'>
                    <Card.Body className='login-card-body'>
                        <Card.Title className='login-card-body-title'>Two-factor authentication</Card.Title>
                        <Card.Subtitle>
                            Enter the 6-digit code from your authenticator app.
                        </Card.Subtitle>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit} className='login-form'>
                            <Form.Group className="mb-4">
                                <Form.Label>Authentication code</Form.Label>
                                <Form.Control
                                    type="text" inputMode="numeric" maxLength={6}
                                    placeholder="000000" value={code} 
                                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
                            </Form.Group>
                            <div>
                                <Button type="submit" variant="success">Verify</Button>
                                <Button onClick={logOut}>
                                    Cancel and logout
                                </Button>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>

        </Container>
    );
}

export { TotpLayout };