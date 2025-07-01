const express = require('express');
const passport = require('passport');
const router = express.Router();

// Discord OAuth login route
router.get('/discord', passport.authenticate('discord', {
    scope: ['identify', 'guilds']
}));

// Discord OAuth callback route
router.get('/discord/callback', 
    passport.authenticate('discord', { 
        failureRedirect: '/',
        failureMessage: true
    }), 
    async (req, res) => {
        try {
            console.log('Auth successful, user:', req.user);
            
            // Check if user has the required role
            const client = req.app.discordClient;
            const guildId = process.env.GUILD_ID;
            const staffRoleId = process.env.STAFF_ROLE_ID;

            if (!client || !guildId || !staffRoleId) {
                console.error('Missing configuration:', { client: !!client, guildId, staffRoleId });
                return res.redirect('/?error=config');
            }

            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(req.user.id);
            
            console.log('User roles:', member.roles.cache.map(r => r.name));

            if (!member.roles.cache.has(staffRoleId)) {
                console.log('User does not have staff role');
                return res.redirect('/?error=role');
            }

            // If they have the role, redirect to dashboard
            res.redirect('/dashboard');
        } catch (error) {
            console.error('Error in callback:', error);
            res.redirect('/?error=server');
        }
    }
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

module.exports = router; 