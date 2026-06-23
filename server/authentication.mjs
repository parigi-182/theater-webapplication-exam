
import passport from "passport";
import session from "express-session";
import LocalStrategy from "passport-local";
import dotenv from 'dotenv';
dotenv.config();

function setupUserSession(app, userDao){

    /** Creating the session */
    app.use(session({
        
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    }));

    app.use(passport.initialize());
    app.use(passport.session());


    /** Set up authentication strategy to search in the DB a user with a matching password.
     * The user object will contain other information extracted by the method userDao.getUser (i.e., id, username, name).
    **/
    passport.use(new LocalStrategy(async function verify(username, password, callback) {
        const user = await userDao.getUser(username, password)
        if(!user)
            return callback(null, false, 'Incorrect username or password');  
        
        return callback(null, user); // NOTE: user info in the session (all fields returned by userDao.getUser, i.e, id, username, name)
    }));

    // Serializing in the session the user object given from LocalStrategy(verify).
    passport.serializeUser(function (user, callback) { // this user is id + username + name 
        callback(null, {id: user.id, totpVerified: user.totpVerified || false});
    });

    // Starting from the data in the session, we extract the current (logged-in) user.
    passport.deserializeUser(async (serialized, done) => {
        try {
            const user = await userDao.getUserById(serialized.id);
            if (!user) return done(null, false);
            done(null, {
                ...user, totpVerified: serialized.totpVerified || false,
            });
        } catch (err) {
            done(err);
        }
    });
    


}



export { setupUserSession };