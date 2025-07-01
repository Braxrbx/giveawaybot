const express = require('express');
const router = express.Router();
const Giveaway = require('../models/Giveaway');

// Root route for homepage
router.get('/', (req, res) => {
    res.render('index', { user: req.user, title: 'Home' });
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
}

// Dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    // Fetch stats from the database
    const [
        totalGiveaways,
        pendingGiveaways,
        scheduledGiveaways,
        giveawaysPerMonth
    ] = await Promise.all([
        Giveaway.countDocuments({}),
        Giveaway.countDocuments({ status: 'pending' }),
        Giveaway.countDocuments({ status: 'scheduled' }),
        (async () => {
            // Giveaways per month for the current year
            const now = new Date();
            const year = now.getFullYear();
            const months = Array(12).fill(0);
            const giveaways = await Giveaway.find({
                createdAt: {
                    $gte: new Date(year, 0, 1),
                    $lt: new Date(year + 1, 0, 1)
                }
            }, 'createdAt');
            giveaways.forEach(gw => {
                const month = gw.createdAt.getMonth();
                months[month]++;
            });
            return months;
        })()
    ]);

    // Server stats and uptime (if available)
    let serverMembers = 0;
    let botUptime = '0d 0h 0m';
    try {
        const client = req.app.discordClient;
        if (client && client.guilds && process.env.MEMBER_GUILD_ID) {
            const guild = await client.guilds.fetch(process.env.MEMBER_GUILD_ID);
            if (guild) {
                const fullGuild = await guild.fetch();
                serverMembers = fullGuild.memberCount;
            }
        }
        if (client && client.uptime) {
            const uptimeSec = Math.floor(client.uptime / 1000);
            const days = Math.floor(uptimeSec / 86400);
            const hours = Math.floor((uptimeSec % 86400) / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            botUptime = `${days}d ${hours}h ${minutes}m`;
        }
    } catch (e) {}

    res.render('dashboard', {
        user: req.user,
        page: 'dashboard',
        title: 'Dashboard',
        totalGiveaways,
        pendingGiveaways,
        scheduledGiveaways,
        serverMembers,
        botUptime,
        giveawaysPerMonth
    });
});

// Pending
router.get('/pending', ensureAuthenticated, async (req, res) => {
    const pendingGiveaways = await Giveaway.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.render('pending', {
        user: req.user,
        page: 'pending',
        title: 'Pending',
        pendingGiveaways
    });
});

// Schedule
router.get('/schedule', ensureAuthenticated, async (req, res) => {
    const scheduledGiveaways = await Giveaway.find({ status: 'scheduled' }).sort({ scheduledTime: 1 });
    res.render('schedule', {
        user: req.user,
        page: 'schedule',
        title: 'Schedule',
        scheduledGiveaways
    });
});

// Logs
router.get('/logs', ensureAuthenticated, (req, res) => {
    res.render('logs', { user: req.user, page: 'logs', title: 'Logs' });
});

// Quotas
router.get('/quotas', ensureAuthenticated, (req, res) => {
    res.render('quotas', { user: req.user, page: 'quotas', title: 'Quotas' });
});

module.exports = router; 