const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { EmbedBuilder } = require('discord.js');
const Invite = require('../models/Invite');
const Quota = require('../models/Quota');

async function generateWeeklySummary(client) {
    try {
        const now = moment().tz('Australia/Sydney');
        const weekStart = now.clone().startOf('week').add(12, 'hours');
        const weekEnd = weekStart.clone().add(7, 'days');

        // Get all quotas for the week
        const quotas = await Quota.find({
            weekStart: { $gte: weekStart.toDate() },
            weekEnd: { $lte: weekEnd.toDate() }
        }).populate('invites');

        // Get all staff members
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const staffRole = await guild.roles.fetch(process.env.STAFF_ROLE_ID);
        const staffMembers = await guild.members.fetch();
        const staff = staffMembers.filter(m => m.roles.cache.has(process.env.STAFF_ROLE_ID));

        // Create summary embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Weekly Staff Summary')
            .setDescription(`Summary for ${weekStart.format('MMM D')} - ${weekEnd.format('MMM D')}`)
            .setTimestamp();

        // Add staff stats
        for (const [id, member] of staff) {
            const quota = quotas.find(q => q.staffId === id);
            const inviteCount = quota && quota.invites ? 
                quota.invites.reduce((sum, inv) => sum + inv.inviteCount, 0) : 0;
            const earnings = inviteCount * 10; // $10 per invite
            const giveawayCount = quota ? quota.giveawayCount : 0;
            const quotaMet = quota ? quota.quotaMet : false;

            embed.addFields({
                name: member.user.username,
                value: [
                    `🎯 Invites: ${inviteCount}`,
                    `💰 Earnings: $${earnings}`,
                    `🎉 Giveaways: ${giveawayCount}`,
                    `📈 Quota: ${quotaMet ? '✅ Met' : '❌ Not Met'}`
                ].join('\n'),
                inline: true
            });
        }

        // Post to summary channel
        const summaryChannel = await client.channels.fetch(process.env.SUMMARY_CHANNEL_ID);
        if (summaryChannel) {
            await summaryChannel.send({ embeds: [embed] });
        }

        // Post quota warnings
        const quotaWarnings = staff.filter(([id]) => {
            const quota = quotas.find(q => q.staffId === id);
            return !quota || !quota.quotaMet;
        });

        if (quotaWarnings.size > 0) {
            const warningEmbed = new EmbedBuilder()
                .setColor('#ef4444')
                .setTitle('⚠️ Quota Warning')
                .setDescription('The following staff members did not meet their weekly quota:')
                .addFields({
                    name: 'Staff Members',
                    value: quotaWarnings.map(([id, member]) => `<@${id}>`).join('\n')
                });

            const warningChannel = await client.channels.fetch(process.env.QUOTA_WARNING_CHANNEL_ID);
            if (warningChannel) {
                await warningChannel.send({ embeds: [warningEmbed] });
            }
        }
    } catch (error) {
        console.error('Error generating weekly summary:', error);
    }
}

function startWeeklyScheduler(client) {
    // Schedule for every Sunday at 12 PM AEST
    schedule.scheduleJob('0 12 * * 0', async () => {
        await generateWeeklySummary(client);
    });
}

module.exports = { startWeeklyScheduler }; 