const cron = require('node-cron');
const moment = require('moment-timezone');
const { EmbedBuilder } = require('discord.js');
const Quota = require('../models/Quota');
const Giveaway = require('../models/Giveaway');
const Invite = require('../models/Invite');
const schedule = require('node-schedule');
const GiveawayEntry = require('../models/GiveawayEntry');

function initializeScheduler(client) {
    // Run every Sunday at 12 PM AEST
    cron.schedule('0 12 * * 0', async () => {
        const now = moment().tz('Australia/Sydney');
        const weekStart = now.clone().subtract(7, 'days').startOf('week').add(12, 'hours');
        const weekEnd = now.clone().startOf('week').add(12, 'hours');

        // Check quotas
        const quotas = await Quota.find({
            weekStart: { $gte: weekStart.toDate() },
            weekEnd: { $lte: weekEnd.toDate() }
        }).populate('invites');

        // Send weekly statistics to log channel
        const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
            const statsEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Weekly Staff Statistics')
                .setDescription(`Statistics for the week of ${weekStart.format('MMM D')} - ${weekEnd.format('MMM D')}`)
                .setTimestamp();

            for (const quota of quotas) {
                const totalInvites = quota.invites.reduce((sum, inv) => sum + inv.inviteCount, 0);
                const earnings = totalInvites * 10; // $10 per invite
                
                statsEmbed.addFields({
                    name: `<@${quota.staffId}>`,
                    value: [
                        `🎯 Invites: ${totalInvites}`,
                        `💰 Earnings: $${earnings}`,
                        `🎉 Giveaways: ${quota.giveawayCount}`,
                        `📈 Quota: ${quota.quotaMet ? '✅ Met' : '❌ Not Met'}`
                    ].join('\n'),
                    inline: true
                });
            }

            await logChannel.send({ embeds: [statsEmbed] });
        }

        // Reset invites for the new week
        await Invite.deleteMany({
            weekStart: { $gte: weekStart.toDate() },
            weekEnd: { $lte: weekEnd.toDate() }
        });

        // Create new quota entries for the next week
        const nextWeekStart = weekEnd;
        const nextWeekEnd = nextWeekStart.clone().add(7, 'days');
        
        for (const quota of quotas) {
            await Quota.create({
                staffId: quota.staffId,
                weekStart: nextWeekStart.toDate(),
                weekEnd: nextWeekEnd.toDate(),
                giveawayCount: 0,
                quotaMet: false
            });
        }

        // Check quotas for notifications
        const quotaChannel = client.channels.cache.get(process.env.QUOTA_CHANNEL_ID);
        if (quotaChannel) {
            for (const quota of quotas) {
                if (!quota.quotaMet) {
                    const member = await client.users.fetch(quota.staffId);
                    const embed = new EmbedBuilder()
                        .setTitle('Quota Not Met')
                        .setDescription(`${member} has failed to meet their weekly quota.`)
                        .addFields(
                            { name: 'Giveaways Requested', value: quota.giveawayCount.toString(), inline: true },
                            { name: 'Required', value: '1', inline: true }
                        )
                        .setTimestamp();

                    await quotaChannel.send({ embeds: [embed] });
                }
            }
        }
    });
}

function initializeGiveawayQueueScheduler(client) {
    // Run every day at 12:05 AM AEST
    cron.schedule('5 0 * * *', async () => {
        const now = moment().tz('Australia/Sydney');
        const todayStart = now.clone().startOf('day');
        const todayEnd = now.clone().endOf('day');
        const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID;

        // Helper: DM requester
        async function dmRequester(userId, message) {
            try {
                const user = await client.users.fetch(userId);
                if (user) await user.send(message);
            } catch (e) { /* ignore DM errors */ }
        }
        // Helper: Send giveaway message
        async function sendGiveawayMessage(giveaway) {
            if (!client || !GIVEAWAY_CHANNEL_ID) return;
            const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (channel && channel.send) {
                // Determine ping
                let ping = '';
                if (giveaway.ourPing === 'Everyone') ping = '@everyone';
                else if (giveaway.ourPing === 'Here') ping = '@here';
                // Format date
                const date = moment(giveaway.postedTime || new Date()).tz('Australia/Sydney').format('LL [at] HH:mm');
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎉 Mutual Giveaway')
                    .setDescription(`Join **${giveaway.serverName}** for a chance to win: **${giveaway.prize || giveaway.theirPrize}**`)
                    .addFields(
                        { name: 'How to Enter', value: `1. Join their server: ${giveaway.serverInvite}\n2. Follow their giveaway instructions` },
                        { name: 'Server Invite', value: giveaway.serverInvite, inline: false }
                    )
                    .setFooter({ text: `Good luck! • ${date}` });
                await channel.send({
                    content: ping,
                    embeds: [embed]
                });
            }
        }
        // Everyone: 1 per day
        const everyoneGiveaways = await Giveaway.find({
            status: 'scheduled',
            ourPing: 'Everyone',
            scheduledTime: { $lte: todayEnd.toDate() }
        }).sort({ scheduledTime: 1 }).limit(1);
        for (const giveaway of everyoneGiveaways) {
            giveaway.status = 'approved';
            giveaway.postedTime = now.toDate();
            await giveaway.save();
            await sendGiveawayMessage(giveaway);
            await dmRequester(giveaway.requesterId, `Your giveaway (Everyone ping) has been sent today!`);
        }
        // Here: 1 per day if Everyone exists, 2 if not
        const everyoneToday = await Giveaway.countDocuments({
            status: 'approved',
            ourPing: 'Everyone',
            postedTime: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() }
        });
        const hereLimit = everyoneToday > 0 ? 1 : 2;
        const hereGiveaways = await Giveaway.find({
            status: 'scheduled',
            ourPing: 'Here',
            scheduledTime: { $lte: todayEnd.toDate() }
        }).sort({ scheduledTime: 1 }).limit(hereLimit);
        for (const giveaway of hereGiveaways) {
            giveaway.status = 'approved';
            giveaway.postedTime = now.toDate();
            await giveaway.save();
            await sendGiveawayMessage(giveaway);
            await dmRequester(giveaway.requesterId, `Your giveaway (Here ping) has been sent today!`);
        }
    });
}

async function endGiveawayAndAnnounce(giveawayId, client) {
    const giveaway = await Giveaway.findById(giveawayId);
    if (!giveaway) return;
    if (giveaway.status === 'ended') return;
    const entries = await GiveawayEntry.find({ giveawayId });
    let winner = null;
    if (entries.length > 0) {
        const winnerEntry = entries[Math.floor(Math.random() * entries.length)];
        winner = winnerEntry.userId;
    }
    giveaway.status = 'ended';
    await giveaway.save();
    // Announce in channel
    const GIVEAWAY_CHANNEL_ID = process.env.GIVEAWAY_CHANNEL_ID;
    if (GIVEAWAY_CHANNEL_ID && client) {
        try {
            const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID);
            if (channel && channel.send) {
                const embed = new EmbedBuilder()
                    .setColor('#43b581')
                    .setTitle('🎉 Giveaway Ended!')
                    .setDescription(`Giveaway for **${giveaway.serverName}** has ended!`)
                    .addFields(
                        { name: 'Prize', value: giveaway.prize || giveaway.theirPrize || 'N/A', inline: true },
                        { name: 'Entries', value: entries.length.toString(), inline: true },
                        { name: 'Winner', value: winner ? `<@${winner}>` : 'No valid entries', inline: false }
                    )
                    .setFooter({ text: 'Thanks for participating!' });
                await channel.send({ embeds: [embed] });
                // DM the winner if there is one
                if (winner) {
                    try {
                        const user = await client.users.fetch(winner);
                        if (user) {
                            const dmEmbed = new EmbedBuilder()
                                .setColor('#43b581')
                                .setTitle('🎉 You Won a Giveaway!')
                                .setDescription(`Congratulations! You won the giveaway for **${giveaway.serverName}**!`)
                                .addFields(
                                    { name: 'Server', value: giveaway.serverName, inline: true },
                                    { name: 'Invite Link', value: giveaway.serverInvite, inline: true },
                                    { name: 'Prize', value: giveaway.prize || giveaway.theirPrize || 'N/A', inline: false }
                                )
                                .setFooter({ text: 'Please open a ticket to claim your prize.' })
                                .setTimestamp();
                            await user.send({ embeds: [dmEmbed] });
                        }
                    } catch (e) {
                        console.error('Error DMing giveaway winner:', e);
                    }
                }
            }
        } catch (e) {
            console.error('Error announcing giveaway winner:', e);
        }
    }
}

function scheduleGiveawayEnd(giveaway, client) {
    if (!giveaway.endTime) return;
    schedule.scheduleJob(giveaway._id.toString(), giveaway.endTime, async () => {
        await endGiveawayAndAnnounce(giveaway._id, client);
    });
}

module.exports = { initializeScheduler, initializeGiveawayQueueScheduler, scheduleGiveawayEnd }; 