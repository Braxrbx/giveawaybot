const express = require('express');
const app = express();
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const routes = require('./routes/index');
const apiRoutes = require('./routes/api');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', routes);
apiRoutes(app);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app; 