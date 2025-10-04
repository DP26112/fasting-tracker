const mongoose = require('mongoose');

const ActiveFastSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    startTime: { type: Date, required: true },
    fastType: { type: String, enum: ['wet', 'dry'], default: 'wet' },
    notes: [
        {
            id: { type: String },
            time: { type: Date },
            text: { type: String },
        }
    ],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActiveFast', ActiveFastSchema);
