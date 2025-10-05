const mongoose = require('mongoose');

const ScheduledReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // activeFastId is optional: allow scheduling by startTime even when no ActiveFast document exists
    activeFastId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActiveFast' },
    startTime: { type: Date, required: true },
    recipients: [{ type: String }],
    intervalHours: { type: Number, default: 6 },
    nextSendAt: { type: Date, index: true },
    enabled: { type: Boolean, default: true },
    processing: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

ScheduledReportSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ScheduledReport', ScheduledReportSchema);
