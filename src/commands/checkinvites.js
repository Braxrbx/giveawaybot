const { SlashCommandBuilder } = require('discord.js');
const moment = require('moment-timezone');
const Invite = require('../models/Invite');
const Quota = require('../models/Quota');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkinvites')
        .setDescription('Check your invite stats for the current week'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const now = moment().tz('Australia/Sydney');
            const weekStart = now.clone().startOf('week').add(12, 'hours');
            const weekEnd = weekStart.clone().add(7, 'days');

            // Get invites for the current week
            const invites = await Invite.find({
                staffId: interaction.user.id,
                weekStart: { $gte: weekStart.toDate() },
                weekEnd: { $lte: weekEnd.toDate() }
            });

            // Get quota status
            const quota = await Quota.findOne({
                staffId: interaction.user.id,
                weekStart: { $gte: weekStart.toDate() },
                weekEnd: { $lte: weekEnd.toDate() }
            });

            const totalInvites = invites.reduce((sum, inv) => sum + inv.inviteCount, 0);
            const earnings = totalInvites * 10; // $10 per invite
            const giveawayCount = quota ? quota.giveawayCount : 0;
            const quotaMet = quota ? quota.quotaMet : false;

            const embed = {
                color: 0x5865F2,
                title: '📊 Your Weekly Stats',
                fields: [
                    {
                        name: '🎯 Invites This Week',
                        value: `${totalInvites} invites`,
                        inline: true
                    },
                    {
                        name: '💰 Estimated Earnings',
                        value: `R$${earnings}`,
                        inline: true
                    },
                    {
                        name: '🎉 Giveaways Requested',
                        value: `${giveawayCount} giveaways`,
                        inline: true
                    },
                    {
                        name: '📈 Quota Status',
                        value: quotaMet ? '✅ Quota Met' : '❌ Quota Not Met',
                        inline: true
                    }
                ],
                footer: {
                    text: `Week of ${weekStart.format('MMM D')} - ${weekEnd.format('MMM D')}`
                }
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in checkinvites command:', error);
            await interaction.editReply({ 
                content: 'There was an error fetching your stats. Please try again later.',
                ephemeral: true 
            });
        }
    }
}; 