const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    staffId: {
        type: String,
        required: true,
        index: true
    },
    inviteCount: {
        type: Number,
        required: true,
        default: 0
    },
    weekStart: {
        type: Date,
        required: true
    },
    weekEnd: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Invite', inviteSchema); 