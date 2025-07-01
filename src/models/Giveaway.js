const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    requesterId: {
        type: String,
        required: true
    },
    serverName: {
        type: String,
        required: true
    },
    serverInvite: {
        type: String,
        required: true
    },
    serverMemberCount: {
        type: Number,
        required: true
    },
    ourPing: {
        type: String,
        required: true
    },
    theirPing: {
        type: String,
        required: true
    },
    theirPrize: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'posted', 'scheduled', 'ended'],
        default: 'pending'
    },
    scheduledTime: {
        type: Date
    },
    postedTime: {
        type: Date
    },
    deniedReason: {
        type: String
    },
    approverId: {
        type: String
    },
    messageId: {
        type: String
    },
    entries: [{
        userId: String,
        username: String,
        enteredAt: {
            type: Date,
            default: Date.now
        }
    }],
    winner: {
        userId: String,
        username: String,
        wonAt: Date
    },
    endTime: {
        type: Date
    }
}, {
    timestamps: true
});

giveawaySchema.index({ requesterId: 1, serverName: 1, createdAt: 1 }, { unique: true });

giveawaySchema.pre('save', function(next) {
  console.log('Giveaway about to be saved:', this);
  next();
});

module.exports = mongoose.model('Giveaway', giveawaySchema); 