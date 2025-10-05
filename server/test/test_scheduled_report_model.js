const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ScheduledReport = require('../models/ScheduledReport');

(async () => {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        const now = new Date();
        const start = new Date(now.getTime() - 25 * 60 * 60 * 1000); // start 25 hours ago
        const sr = new ScheduledReport({ userId: new mongoose.Types.ObjectId(), activeFastId: new mongoose.Types.ObjectId(), startTime: start, recipients: ['a@b.com'], nextSendAt: new Date(start.getTime() + 24*60*60*1000) });
        await sr.save();

        const found = await ScheduledReport.findById(sr._id);
        if (!found) throw new Error('Saved schedule not found');

        await ScheduledReport.deleteOne({ _id: sr._id });
        const still = await ScheduledReport.findById(sr._id);
        if (still) throw new Error('Schedule was not deleted');

        console.log('ScheduledReport model integration test passed');
    } catch (err) {
        console.error('ScheduledReport model integration test failed:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        await mongod.stop();
        process.exit(0);
    }
})();
