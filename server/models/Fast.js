// ./models/Fast.js - Pre-Fix, Pre-Auth State

const mongoose = require('mongoose');

const FastSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // New fasts MUST belong to a user
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationHours: { type: Number, required: true },
    fastType: { type: String, enum: ['wet', 'dry'], default: 'wet' },
    notes: [
        {
            id: { type: String, required: true },
            time: { type: Date, required: true },
            text: { type: String, required: true },
        }
    ],
    dateLogged: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fast', FastSchema);