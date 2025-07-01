const mongoose = require('mongoose');

const giveawayEntrySchema = new mongoose.Schema({
    giveawayId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Giveaway',
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    enteredAt: {
        type: Date,
        default: Date.now
    }
});

giveawayEntrySchema.index({ giveawayId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('GiveawayEntry', giveawayEntrySchema); 