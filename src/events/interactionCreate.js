const { Events, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const Giveaway = require('../models/Giveaway');
const GiveawayEntry = require('../models/GiveawayEntry');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Handle slash commands
        if (interaction.isCommand && interaction.isCommand()) {
            // Guild and staff role check
            const allowedGuildId = process.env.GUILD_ID;
            const staffRoleId = process.env.STAFF_ROLE_ID;
            if (interaction.guildId !== allowedGuildId) {
                return interaction.reply({ content: 'This command can only be used in the staff server.', ephemeral: true });
            }
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(staffRoleId)) {
                return interaction.reply({ content: 'You do not have permission to use this command. Staff only.', ephemeral: true });
            }
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                    } else {
                        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                    }
                } catch (err) {
                    // Ignore further errors
                }
            }
            return;
        }

        // Handle buttons
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('enter_giveaway_')) {
                const giveawayId = interaction.customId.replace('enter_giveaway_', '');
                try {
                    const giveaway = await Giveaway.findById(giveawayId);
                    if (!giveaway || !giveaway.endTime || new Date() > giveaway.endTime) {
                        return interaction.reply({
                            content: 'This giveaway is no longer active.',
                            ephemeral: true
                        });
                    }
                    // Check if user already entered
                    const existingEntry = await GiveawayEntry.findOne({ giveawayId, userId: interaction.user.id });
                    if (existingEntry) {
                        return interaction.reply({
                            content: 'You have already entered this giveaway!',
                            ephemeral: true
                        });
                    }
                    // Add entry
                    await GiveawayEntry.create({ giveawayId, userId: interaction.user.id });
                    // Optionally update the embed with entry count
                    const entryCount = await GiveawayEntry.countDocuments({ giveawayId });
                    if (interaction.message && interaction.message.editable) {
                        const embed = interaction.message.embeds[0];
                        if (embed) {
                            const newEmbed = { ...embed.data };
                            // Add or update Entries field
                            let found = false;
                            if (newEmbed.fields) {
                                newEmbed.fields = newEmbed.fields.map(field => {
                                    if (field.name === 'Entries') {
                                        found = true;
                                        return { name: 'Entries', value: entryCount.toString(), inline: true };
                                    }
                                    return field;
                                });
                            } else {
                                newEmbed.fields = [];
                            }
                            if (!found) {
                                newEmbed.fields.push({ name: 'Entries', value: entryCount.toString(), inline: true });
                            }
                            await interaction.message.edit({ embeds: [newEmbed] });
                        }
                    }
                    await interaction.reply({
                        content: 'You have successfully entered the giveaway!',
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error handling giveaway entry:', error);
                    await interaction.reply({
                        content: 'An error occurred while entering the giveaway.',
                        ephemeral: true
                    });
                }
            }
        }
    }
}; 