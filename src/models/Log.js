const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g. 'approve', 'deny', etc.
    userId: { type: String, required: true },
    username: { type: String },
    giveawayId: { type: mongoose.Schema.Types.ObjectId, ref: 'Giveaway' },
    details: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema); 