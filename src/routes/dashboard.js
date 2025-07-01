const express = require('express');
const router = express.Router();

router.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    try {
        const client = req.app.discordClient;
        const guildId = process.env.GUILD_ID;
        const staffRoleId = process.env.STAFF_ROLE_ID;

        if (!client || !guildId || !staffRoleId) {
            return res.render('error', {
                message: 'Server configuration error. Please contact an administrator.',
                error: { status: 500 }
            });
        }

        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(req.user.id);

        if (!member.roles.cache.has(staffRoleId)) {
            return res.render('error', {
                message: 'Access Denied',
                details: 'You need the Staff role to access the dashboard.',
                error: { status: 403 }
            });
        }

        // If they have the role, render the dashboard
        res.render('dashboard', {
            user: req.user,
            // Add any other data you need for the dashboard
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('error', {
            message: 'An error occurred while loading the dashboard.',
            error: { status: 500 }
        });
    }
});

module.exports = router; 