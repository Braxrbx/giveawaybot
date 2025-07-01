const express = require('express');
const router = express.Router();
const Giveaway = require('../models/Giveaway');
const Quota = require('../models/Quota');
const Invite = require('../models/Invite');
const moment = require('moment-timezone');
const Log = require('../models/Log');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { scheduleGiveawayEnd } = require('../utils/scheduler');

function ensureAuthenticated(req, res, next) {
    console.log('ensureAuthenticated called. User:', req.user && req.user.id);
    if (!req.isAuthenticated()) {
        console.log('User not authenticated');
        return res.status(401).json({ error: 'Unauthorized - Please log in' });
    }
    
    // Check if user has required role
    const client = req.app.discordClient;
    const guildId = process.env.GUILD_ID;
    const staffRoleId = process.env.STAFF_ROLE_ID;
    
    if (!client || !guildId || !staffRoleId) {
        console.log('Server configuration error', { client: !!client, guildId, staffRoleId });
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check if user has the staff role
    client.guilds.fetch(guildId)
        .then(guild => guild.members.fetch(req.user.id))
        .then(member => {
            if (!member.roles.cache.has(staffRoleId)) {
                console.log('User does not have staff role');
                return res.status(403).json({ 
                    error: 'Access Denied',
                    message: 'You need the Staff role to access this feature.'
                });
            }
            next();
        })
        .catch(error => {
            console.error('Error checking roles:', error);
            res.status(500).json({ error: 'Error checking permissions', details: error.message });
        });
}

// Example: Get pending giveaways
router.get('/giveaways/pending', ensureAuthenticated, async (req, res) => {
    try {
        const giveaways = await Giveaway.find({ status: 'pending' });
        res.json(giveaways);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve giveaway
router.post('/giveaways/:id/approve', async (req, res) => {
    try {
        const giveaway = await Giveaway.findById(req.params.id);
        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        const client = req.app.discordClient;
        const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
        const now = moment().tz('Australia/Sydney');
        let dmEmbed = null;
        let logMsg = '';

        // @everyone: 1 per 24h
        if (giveaway.ourPing === 'Everyone') {
            const since = now.clone().subtract(24, 'hours').toDate();
            const everyoneCount = await Giveaway.countDocuments({
                ourPing: 'Everyone',
                status: { $in: ['approved', 'posted'] },
                postedTime: { $gte: since }
            });
            if (everyoneCount >= 1) {
                const lastEveryone = await Giveaway.findOne({
                    ourPing: 'Everyone',
                    status: { $in: ['approved', 'posted'] }
                }).sort({ postedTime: -1 });
                const nextAvailable = moment(lastEveryone.postedTime).add(24, 'hours');
                giveaway.status = 'scheduled';
                giveaway.scheduledTime = nextAvailable.toDate();
                await giveaway.save();
                dmEmbed = new EmbedBuilder()
                    .setColor('#fbbf24')
                    .setTitle('Giveaway Scheduled')
                    .setDescription(`Your giveaway for **${giveaway.serverName}** has been scheduled.`)
                    .addFields({ name: 'Scheduled For', value: `<t:${Math.floor(nextAvailable.valueOf()/1000)}:F>` })
                    .setFooter({ text: 'Mutual Giveaway System' });
                logMsg = `Giveaway for **${giveaway.serverName}** scheduled for <t:${Math.floor(nextAvailable.valueOf()/1000)}:F> by <@${giveaway.requesterId}>.`;
                if (client) {
                    try {
                        const user = await client.users.fetch(giveaway.requesterId);
                        if (user) await user.send({ embeds: [dmEmbed] });
                    } catch (e) {}
                    if (LOG_CHANNEL_ID) {
                        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                        if (logChannel) await logChannel.send(logMsg);
                    }
                }
                return res.json({ success: true, scheduled: true, date: nextAvailable.format('YYYY-MM-DD HH:mm') });
            }
        }
        // @here: 1 per 24h if @everyone exists, 2 if not
        if (giveaway.ourPing === 'Here') {
            const since = now.clone().subtract(24, 'hours').toDate();
            const everyoneCount = await Giveaway.countDocuments({
                ourPing: 'Everyone',
                status: { $in: ['approved', 'posted'] },
                postedTime: { $gte: since }
            });
            let hereLimit = everyoneCount > 0 ? 1 : 2;
            const hereCount = await Giveaway.countDocuments({
                ourPing: 'Here',
                status: { $in: ['approved', 'posted'] },
                postedTime: { $gte: since }
            });
            if (hereCount >= hereLimit) {
                const lastHere = await Giveaway.findOne({
                    ourPing: 'Here',
                    status: { $in: ['approved', 'posted'] }
                }).sort({ postedTime: -1 });
                const nextAvailable = moment(lastHere.postedTime).add(24, 'hours');
                giveaway.status = 'scheduled';
                giveaway.scheduledTime = nextAvailable.toDate();
                await giveaway.save();
                dmEmbed = new EmbedBuilder()
                    .setColor('#fbbf24')
                    .setTitle('Giveaway Scheduled')
                    .setDescription(`Your giveaway for **${giveaway.serverName}** has been scheduled.`)
                    .addFields({ name: 'Scheduled For', value: `<t:${Math.floor(nextAvailable.valueOf()/1000)}:F>` })
                    .setFooter({ text: 'Mutual Giveaway System' });
                logMsg = `Giveaway for **${giveaway.serverName}** scheduled for <t:${Math.floor(nextAvailable.valueOf()/1000)}:F> by <@${giveaway.requesterId}>.`;
                if (client) {
                    try {
                        const user = await client.users.fetch(giveaway.requesterId);
                        if (user) await user.send({ embeds: [dmEmbed] });
                    } catch (e) {}
                    if (LOG_CHANNEL_ID) {
                        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                        if (logChannel) await logChannel.send(logMsg);
                    }
                }
                return res.json({ success: true, scheduled: true, date: nextAvailable.format('YYYY-MM-DD HH:mm') });
            }
        }
        // Mutual/No ping: always approve instantly
        giveaway.status = 'approved';
        giveaway.postedTime = now.toDate();
        giveaway.scheduledTime = now.toDate();
        // Set end time for 7 days from now
        giveaway.endTime = moment(now).add(7, 'days').toDate();
        await giveaway.save();
        scheduleGiveawayEnd(giveaway, client);
        dmEmbed = new EmbedBuilder()
            .setColor('#22c55e')
            .setTitle('Giveaway Approved')
            .setDescription('Your giveaway is being sent now!')
            .addFields({ name: 'Server', value: giveaway.serverName })
            .setFooter({ text: 'Mutual Giveaway System' });
        logMsg = `Giveaway for **${giveaway.serverName}** approved and posted instantly by <@${giveaway.requesterId}>.`;
        if (client) {
            try {
                const user = await client.users.fetch(giveaway.requesterId);
                if (user) await user.send({ embeds: [dmEmbed] });
            } catch (e) {}
            if (LOG_CHANNEL_ID) {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) await logChannel.send(logMsg);
            }
            // Send the giveaway to the giveaway channel
            const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID;
            if (GIVEAWAY_CHANNEL_ID) {
                try {
                    const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID);
                    if (channel && channel.send) {
                        let ping = '';
                        if (giveaway.ourPing === 'Everyone') ping = '@everyone';
                        else if (giveaway.ourPing === 'Here') ping = '@here';
                        const date = moment(now).format('LL [at] HH:mm');
                        const embed = new EmbedBuilder()
                            .setColor('#5865F2')
                            .setTitle('🎉 Mutual Giveaway')
                            .setDescription(`Join **${giveaway.serverName}** for a chance to win: **${giveaway.prize || giveaway.theirPrize}**`)
                            .addFields(
                                { name: 'How to Enter', value: `1. Join their server: ${giveaway.serverInvite}\n2. Follow their giveaway instructions` },
                                { name: 'Server Invite', value: giveaway.serverInvite, inline: false },
                                { name: 'Giveaway Ends', value: `<t:${Math.floor(giveaway.endTime.getTime()/1000)}:F>`, inline: false }
                            )
                            .setFooter({ text: `Good luck! • ${date}` });
                        const enterButton = new ButtonBuilder()
                            .setCustomId(`enter_giveaway_${giveaway._id}`)
                            .setLabel('Enter Giveaway')
                            .setStyle(ButtonStyle.Success);
                        const row = new ActionRowBuilder().addComponents(enterButton);
                        const sentMessage = await channel.send({
                            content: ping,
                            embeds: [embed],
                            components: [row]
                        });
                        giveaway.messageId = sentMessage.id;
                        await giveaway.save();
                    }
                } catch (e) {
                    console.error('Error sending giveaway to channel:', e);
                }
            }
        }
        // Send log embed to Discord log channel for approval
        if (client && LOG_CHANNEL_ID) {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const approveEmbed = new EmbedBuilder()
                    .setColor('#22c55e')
                    .setTitle('✅ Giveaway Approved')
                    .setDescription(`Giveaway for **${giveaway.serverName}** has been approved.`)
                    .addFields(
                        { name: 'Server', value: giveaway.serverName, inline: true },
                        { name: 'Prize', value: giveaway.prize || giveaway.theirPrize, inline: true },
                        { name: 'Requester', value: `<@${giveaway.requesterId}>`, inline: true }
                    )
                    .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
                    .setTimestamp();
                await logChannel.send({ embeds: [approveEmbed] });
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Approve giveaway error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Deny giveaway
router.post('/giveaways/:id/deny', ensureAuthenticated, async (req, res) => {
    try {
        const giveaway = await Giveaway.findById(req.params.id);
        if (!giveaway) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        giveaway.status = 'denied';
        giveaway.deniedReason = req.body.reason;
        giveaway.approverId = req.user.id;
        await giveaway.save();
        // Log denial
        await Log.create({
            action: 'deny',
            userId: req.user.id,
            username: req.user.username,
            giveawayId: giveaway._id,
            details: `Denied giveaway for ${giveaway.serverName} (Reason: ${req.body.reason || 'N/A'})`
        });
        // DM the requester
        const client = req.app.discordClient;
        if (client) {
            try {
                const user = await client.users.fetch(giveaway.requesterId);
                if (user) {
                    const embed = new EmbedBuilder()
                        .setColor('#ef4444')
                        .setTitle('Giveaway Denied')
                        .setDescription(`Your giveaway request for **${giveaway.serverName}** was denied.`)
                        .addFields({ name: 'Reason', value: req.body.reason || 'No reason provided.' })
                        .setFooter({ text: 'Mutual Giveaway System' });
                    await user.send({ embeds: [embed] });
                }
            } catch (e) { /* ignore DM errors */ }
            // Send log embed to Discord log channel for denial
            const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
            if (LOG_CHANNEL_ID) {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const denyEmbed = new EmbedBuilder()
                        .setColor('#ef4444')
                        .setTitle('❌ Giveaway Denied')
                        .setDescription(`Giveaway for **${giveaway.serverName}** has been denied.`)
                        .addFields(
                            { name: 'Server', value: giveaway.serverName, inline: true },
                            { name: 'Requester', value: `<@${giveaway.requesterId}>`, inline: true },
                            { name: 'Reason', value: req.body.reason || 'No reason provided.', inline: false }
                        )
                        .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
                        .setTimestamp();
                    await logChannel.send({ embeds: [denyEmbed] });
                }
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get staff statistics
router.get('/staff/stats', ensureAuthenticated, async (req, res) => {
    try {
        const now = moment().tz('Australia/Sydney');
        const weekStart = now.clone().startOf('week').add(12, 'hours');
        const weekEnd = weekStart.clone().add(7, 'days');

        const quotas = await Quota.find({
            weekStart: { $gte: weekStart.toDate() },
            weekEnd: { $lte: weekEnd.toDate() }
        }).populate('invites');

        const stats = quotas.map(quota => ({
            staffId: quota.staffId,
            giveawayCount: quota.giveawayCount,
            inviteCount: quota.invites.reduce((sum, invite) => sum + invite.inviteCount, 0),
            earnings: quota.invites.reduce((sum, invite) => sum + invite.inviteCount, 0) * 10
        }));

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Statistics API
router.get('/statistics', ensureAuthenticated, async (req, res) => {
    try {
        const [totalGiveaways, approvedGiveaways, deniedGiveaways, pendingGiveaways, totalInvites, totalQuotas] = await Promise.all([
            Giveaway.countDocuments(),
            Giveaway.countDocuments({ status: 'approved' }),
            Giveaway.countDocuments({ status: 'denied' }),
            Giveaway.countDocuments({ status: 'pending' }),
            Invite.countDocuments(),
            Quota.countDocuments()
        ]);
        res.json({
            totalGiveaways,
            approvedGiveaways,
            deniedGiveaways,
            pendingGiveaways,
            totalInvites,
            totalQuotas
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Dashboard stats endpoint
router.get('/dashboard-stats', ensureAuthenticated, async (req, res) => {
    const [total, pending, scheduled] = await Promise.all([
        Giveaway.countDocuments({}),
        Giveaway.countDocuments({ status: 'pending' }),
        Giveaway.countDocuments({ status: 'scheduled' })
    ]);
    // Get live server member count from Discord
    let serverMembers = 0;
    try {
        const client = req.app.discordClient;
        if (client && client.guilds && process.env.MEMBER_GUILD_ID) {
            const guild = await client.guilds.fetch(process.env.MEMBER_GUILD_ID);
            if (guild) {
                const fullGuild = await guild.fetch();
                serverMembers = fullGuild.memberCount;
            }
        }
    } catch (e) {
        serverMembers = 0;
    }
    // Bot uptime
    let uptimeString = '0d 0h 0m';
    try {
        const client = req.app.discordClient;
        if (client && client.uptime) {
            const uptimeSec = Math.floor(client.uptime / 1000);
            const days = Math.floor(uptimeSec / 86400);
            const hours = Math.floor((uptimeSec % 86400) / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            uptimeString = `${days}d ${hours}h ${minutes}m`;
        }
    } catch (e) {}
    res.json({
        totalGiveaways: total,
        pendingGiveaways: pending,
        scheduledGiveaways: scheduled,
        serverMembers,
        botUptime: uptimeString
    });
});

// Giveaways per month for the current year
router.get('/giveaways-per-month', ensureAuthenticated, async (req, res) => {
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
    res.json({ months });
});

// Get logs
router.get('/logs', ensureAuthenticated, async (req, res) => {
    try {
        const logs = await Log.find({}).sort({ timestamp: -1 }).limit(100).populate('giveawayId');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete scheduled giveaway
router.delete('/giveaways/:id', ensureAuthenticated, async (req, res) => {
    try {
        const giveaway = await Giveaway.findById(req.params.id);
        if (!giveaway) {
            console.log('Delete: Giveaway not found for id', req.params.id);
            return res.status(404).json({ error: 'Scheduled giveaway not found' });
        }
        if (giveaway.status !== 'scheduled') {
            console.log('Delete: Giveaway not scheduled for id', req.params.id, 'status:', giveaway.status);
            return res.status(400).json({ error: 'Giveaway is not scheduled' });
        }
        await giveaway.deleteOne();
        console.log('Delete: Giveaway deleted for id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('API ERROR [DELETE /giveaways/:id]:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Send scheduled giveaway now
router.post('/giveaways/:id/send-now', ensureAuthenticated, async (req, res) => {
    try {
        const giveaway = await Giveaway.findById(req.params.id);
        if (!giveaway || giveaway.status !== 'scheduled') {
            return res.status(404).json({ error: 'Scheduled giveaway not found' });
        }
        const client = req.app.discordClient;
        const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID;
        const now = moment().tz('Australia/Sydney');
        // Set end time before building the embed
        giveaway.endTime = moment(now).add(7, 'days').toDate();
        await giveaway.save();
        scheduleGiveawayEnd(giveaway, client);
        if (client && GIVEAWAY_CHANNEL_ID) {
            const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (channel && channel.send) {
                let ping = '';
                if (giveaway.ourPing === 'Everyone') ping = '@everyone';
                else if (giveaway.ourPing === 'Here') ping = '@here';
                const date = moment(now).format('LL [at] HH:mm');
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎉 Mutual Giveaway')
                    .setDescription(`Join **${giveaway.serverName}** for a chance to win: **${giveaway.prize || giveaway.theirPrize}**`)
                    .addFields(
                        { name: 'How to Enter', value: `1. Join their server: ${giveaway.serverInvite}\n2. Follow their giveaway instructions` },
                        { name: 'Server Invite', value: giveaway.serverInvite, inline: false },
                        { name: 'Giveaway Ends', value: `<t:${Math.floor(giveaway.endTime.getTime()/1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: `Good luck! • ${date}` });
                const enterButton = new ButtonBuilder()
                    .setCustomId(`enter_giveaway_${giveaway._id}`)
                    .setLabel('Enter Giveaway')
                    .setStyle(ButtonStyle.Success);
                const row = new ActionRowBuilder().addComponents(enterButton);
                const sentMessage = await channel.send({
                    content: ping,
                    embeds: [embed],
                    components: [row]
                });
                giveaway.messageId = sentMessage.id;
                await giveaway.save();
            }
        }
        giveaway.status = 'approved';
        giveaway.postedTime = now.toDate();
        await giveaway.save();
        res.json({ success: true });
    } catch (error) {
        console.error('API ERROR [POST /giveaways/:id/send-now]:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Staff quota tracking endpoint
router.get('/staff/quotas', ensureAuthenticated, async (req, res) => {
    try {
        const client = req.app.discordClient;
        const guildId = process.env.GUILD_ID;
        const staffRoleId = process.env.STAFF_ROLE_ID;
        if (!client || !guildId || !staffRoleId) return res.status(500).json({ error: 'Missing config' });
        const guild = await client.guilds.fetch(guildId);
        const staffRole = await guild.roles.fetch(staffRoleId);
        if (!staffRole) return res.json([]);
        const staffMembers = await guild.members.fetch();
        const staff = staffMembers.filter(m => m.roles.cache.has(staffRoleId));
        // Get current week range (Sunday to next Sunday AEST)
        const now = moment().tz('Australia/Sydney');
        const weekStart = now.clone().startOf('week').add(12, 'hours');
        const weekEnd = weekStart.clone().add(7, 'days');
        // Get quotas for this week
        const quotas = await Quota.find({
            weekStart: { $gte: weekStart.toDate() },
            weekEnd: { $lte: weekEnd.toDate() }
        }).populate('invites');
        // Map staff info
        const result = staff.map(member => {
            const quota = quotas.find(q => q.staffId === member.id);
            const inviteCount = quota && quota.invites ? quota.invites.reduce((sum, inv) => sum + inv.inviteCount, 0) : 0;
            return {
                id: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL(),
                giveawayCount: quota ? quota.giveawayCount : 0,
                inviteCount,
                quotaMet: quota ? quota.quotaMet : false
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fallback logger for all API requests
router.use((req, res, next) => {
    console.log('API fallback route hit:', req.method, req.originalUrl);
    next();
});

module.exports = router; 