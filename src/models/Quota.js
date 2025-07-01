const mongoose = require('mongoose');

const quotaSchema = new mongoose.Schema({
    staffId: {
        type: String,
        required: true,
        index: true
    },
    weekStart: {
        type: Date,
        required: true
    },
    weekEnd: {
        type: Date,
        required: true
    },
    giveawayCount: {
        type: Number,
        default: 0
    },
    quotaMet: {
        type: Boolean,
        default: false
    },
    invites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invite'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Quota', quotaSchema); 