const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Giveaway = require('../models/Giveaway');
const GiveawayEntry = require('../models/GiveawayEntry');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('Reroll a giveaway winner')
        .addStringOption(option => 
            option.setName('message_id')
                .setDescription('The message ID of the giveaway')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        
        try {
            // Find the giveaway by message ID and status ended
            const giveaway = await Giveaway.findOne({ messageId, status: 'ended' });
            if (!giveaway) {
                return interaction.reply({ 
                    content: 'No ended giveaway found with that message ID.', 
                    ephemeral: true 
                });
            }
            // Fetch entries from GiveawayEntry model
            const entries = await GiveawayEntry.find({ giveawayId: giveaway._id });
            if (entries.length === 0) {
                return interaction.reply({ 
                    content: 'This giveaway has no entries to reroll.', 
                    ephemeral: true 
                });
            }
            // Select a new random winner
            const newWinnerEntry = entries[Math.floor(Math.random() * entries.length)];
            // Get the channel and message
            const channel = interaction.channel;
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                // Update the message with new winner
                const embed = message.embeds[0];
                const newEmbed = { ...embed.data };
                let found = false;
                if (newEmbed.fields) {
                    newEmbed.fields = newEmbed.fields.map(field => {
                        if (field.name === 'Winner') {
                            found = true;
                            return {
                                name: 'Winner',
                                value: `<@${newWinnerEntry.userId}>`,
                                inline: false
                            };
                        }
                        return field;
                    });
                } else {
                    newEmbed.fields = [];
                }
                if (!found) {
                    newEmbed.fields.push({ name: 'Winner', value: `<@${newWinnerEntry.userId}>`, inline: false });
                }
                await message.edit({ embeds: [newEmbed] });
                // DM the new winner
                try {
                    const user = await interaction.client.users.fetch(newWinnerEntry.userId);
                    await user.send(`Congratulations! You have been rerolled as the winner for **${giveaway.serverName}**! Please open a ticket. 🎉`);
                } catch (error) {
                    console.error('Failed to DM winner:', error);
                }
                // Ping the new winner in the channel
                await channel.send(`🎉 New winner selected: <@${newWinnerEntry.userId}>!`);
            }
            await interaction.reply({ 
                content: `Successfully rerolled the giveaway winner!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error in reroll command:', error);
            await interaction.reply({ 
                content: 'An error occurred while rerolling the giveaway.', 
                ephemeral: true 
            });
        }
    }
}; 