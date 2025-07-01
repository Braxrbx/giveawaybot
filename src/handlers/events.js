const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    if (!fs.existsSync(eventsPath)) return;
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.name && typeof event.execute === 'function') {
            // Debug log to check for double registration
            console.log('Registering event:', event.name, 'from', file);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        }
    }
}; 