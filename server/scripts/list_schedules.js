// server/scripts/list_schedules.js
// Dev tool: list ScheduledReport documents for validation
// Usage: node scripts/list_schedules.js [--userId=<userId>] [--startTime=<ISO>] [--limit=20]

const mongoose = require('mongoose');
const ScheduledReport = require('../models/ScheduledReport');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const argv = require('minimist')(process.argv.slice(2));
const userId = argv.userId || argv.u || null;
const startTimeArg = argv.startTime || argv.s || null;
const limit = Number(argv.limit || argv.l || 50);

const DB = process.env.MONGO_URI;
if (!DB) {
  console.error('MONGO_URI not found in server/.env — cannot connect');
  process.exit(2);
}

async function run() {
  await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
  const q = {};
  if (userId) q.userId = userId;
  if (startTimeArg) {
    const t = new Date(startTimeArg);
    const rangeStart = new Date(t.getTime() - 60 * 1000);
    const rangeEnd = new Date(t.getTime() + 60 * 1000);
    q.startTime = { $gte: rangeStart, $lte: rangeEnd };
  }

  const docs = await ScheduledReport.find(q).sort({ nextSendAt: 1 }).limit(limit).lean();
  console.log(JSON.stringify(docs, null, 2));
  await mongoose.disconnect();
}

run().catch(err => { console.error('Error listing schedules:', err); process.exit(1); });
