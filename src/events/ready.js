const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}!`);

        // Register slash commands
        const commands = [];
        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            commands.push(command.data.toJSON());
        }

        // Set the REST client with the bot token
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    }
}; 