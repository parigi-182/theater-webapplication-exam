import { Link } from 'react-router';
import { Navbar, Nav, Button, Badge } from 'react-bootstrap';

function Navigation({ user, logOut }) {
    return (
        <Navbar fluid className="navbar">
            <Navbar.Brand className="navbar-paris">Paris Theatre</Navbar.Brand>
            <Nav className="ms-auto">
                {user ? (
                    <>
                        <Navbar.Text className="username">
                            {user.username}
                            {user.totpVerified &&
                                <Badge className='admin-badge'>Admin</Badge>}
                        </Navbar.Text>
                        <Button onClick={logOut} className='login-logout'>Logout</Button>
                    </>
                ) : (
                    <Link to="/login">
                        <Button className='login-logout'>Login</Button>
                    </Link>
                )}
            </Nav>
        </Navbar>
    );
}

export { Navigation };