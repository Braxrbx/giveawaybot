const Giveaway = require('./Giveaway');
const Invite = require('./Invite');
const Quota = require('./Quota');

// In Mongoose, we use references in the schema instead of explicit associations
// The relationships are defined in the individual model files

module.exports = {
    Giveaway,
    Invite,
    Quota
}; 