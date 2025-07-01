require('dotenv').config();

// Debug logging for environment variables
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? 'Present' : 'Missing');
console.log('DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? 'Present' : 'Missing');
console.log('DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI ? 'Present' : 'Missing');

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const connectDB = require('./config/database');
const { initializeScheduler, initializeGiveawayQueueScheduler } = require('./utils/scheduler');
const expressLayouts = require('express-ejs-layouts');
const fetch = require('node-fetch');
const { startWeeklyScheduler } = require('./utils/weeklySummary');
require('./models'); // Load model associations

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout'); // Use layout.ejs as the default

// Store Discord client in app for use in routes
app.discordClient = client;

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => {
        return done(null, profile);
    });
}));

// Initialize collections
client.commands = new Collection();
client.giveaways = new Collection();

// Load commands and events
require('./handlers/commands')(client);
require('./handlers/events')(client);

// Initialize scheduler
initializeScheduler(client);
initializeGiveawayQueueScheduler(client);

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/api'));

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        message: 'Something broke!',
        error: { status: 500 },
        title: 'Error',
        details: err.message || null
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Debug print for the token
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Present' : 'Missing');

// Login the bot
client.login(process.env.DISCORD_BOT_TOKEN);

// Handle Discord client errors
client.on('error', error => {
    console.error('Discord client error:', error);
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    startWeeklyScheduler(client);
}); 