const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Giveaway = require('../models/Giveaway');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requestgw')
        .setDescription('Request a mutual giveaway')
        .addStringOption(option => option.setName('server_name').setDescription('Name of the server').setRequired(true))
        .addStringOption(option => option.setName('server_invite').setDescription('Permanent server invite').setRequired(true))
        .addIntegerOption(option => option.setName('server_member_count').setDescription('Server member count').setRequired(true))
        .addStringOption(option => option.setName('our_ping').setDescription('Our ping (role name, not actual ping)').setRequired(true)
            .addChoices(
                { name: 'Everyone', value: 'Everyone' },
                { name: 'Here', value: 'Here' },
                { name: 'Mutual Ping', value: 'Mutual Ping' },
                { name: 'No Ping', value: 'No Ping' }
            )
        )
        .addStringOption(option => option.setName('their_ping').setDescription('Their ping (role name, not actual ping)').setRequired(true)
            .addChoices(
                { name: 'Everyone', value: 'Everyone' },
                { name: 'Here', value: 'Here' },
                { name: 'Other', value: 'Other' }
            )
        )
        .addStringOption(option => option.setName('their_prize').setDescription('Their prize').setRequired(true)),
    async execute(interaction) {
        // Exit immediately if already replied or deferred
        if (interaction.replied || interaction.deferred) {
            console.warn('Interaction already acknowledged, exiting early.');
            return;
        }

        const serverName = interaction.options.getString('server_name');
        const serverInvite = interaction.options.getString('server_invite');
        const serverMemberCount = interaction.options.getInteger('server_member_count');
        const ourPing = interaction.options.getString('our_ping');
        const theirPing = interaction.options.getString('their_ping');
        const theirPrize = interaction.options.getString('their_prize');

        // Save to database (only ONCE)
        console.trace('Creating giveaway in requestgw.js');
        const giveaway = await Giveaway.create({
            requesterId: interaction.user.id,
            serverName,
            serverInvite,
            serverMemberCount,
            ourPing,
            theirPing,
            theirPrize
        });

        // Build the embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎉 New Giveaway Request')
            .setDescription(`<@${interaction.user.id}> has requested a new giveaway!`)
            .addFields(
                { name: 'Server', value: serverName, inline: true },
                { name: 'Prize', value: theirPrize, inline: true },
                { name: 'Our Ping Type', value: ourPing, inline: true },
                { name: 'Their Ping Type', value: theirPing, inline: true },
                { name: 'Member Count', value: serverMemberCount.toString(), inline: true },
                { name: 'Server Invite', value: serverInvite, inline: false }
            )
            .setFooter({ text: `Request ID: ${giveaway._id}` })
            .setTimestamp();

        // Send to management channel
        const managementChannel = interaction.client.channels.cache.get(process.env.MANAGEMENT_CHANNEL_ID);
        if (managementChannel) {
            await managementChannel.send({ embeds: [embed] });
        }

        // Send to logs channel
        const logChannel = interaction.client.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }

        try {
            await interaction.reply({ content: 'Your mutual giveaway request has been submitted!', ephemeral: true });
        } catch (err) {
            console.error('Failed to reply to interaction:', err);
        }
    }
}; 