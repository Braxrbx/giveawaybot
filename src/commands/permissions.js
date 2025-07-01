const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('permissions')
        .setDescription('Check bot permissions'),
    
    async execute(interaction) {
        const permissions = interaction.guild.members.me.permissions;
        
        const requiredPermissions = [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.AddReactions
        ];

        const missingPermissions = requiredPermissions.filter(perm => !permissions.has(perm));
        
        if (missingPermissions.length > 0) {
            await interaction.reply({
                content: `❌ Bot is missing the following permissions:\n${missingPermissions.map(perm => `- ${perm.toString()}`).join('\n')}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '✅ Bot has all required permissions!',
                ephemeral: true
            });
        }
    }
}; 