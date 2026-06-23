import { Link } from 'react-router';
import { Container, Button } from 'react-bootstrap';

function NotFoundLayout() {
    return (
        <Container>
            <h1>404</h1>
            <p>This page doesn't exist.</p>
            <Link to="/"><Button variant="success">Back to home</Button></Link>
        </Container>
    );
}

export { NotFoundLayout };