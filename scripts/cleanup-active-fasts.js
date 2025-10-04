const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ActiveFast = require('../server/models/ActiveFast');
const User = require('../server/models/User');

(async () => {
  try {
    const envPath = path.resolve(__dirname, '../server/.env');
    if (!fs.existsSync(envPath)) throw new Error('server/.env not found');
    const raw = fs.readFileSync(envPath, 'utf8');
    const match = raw.match(/^[ \t]*MONGO_URI\s*=\s*(.+)$/m);
    const uri = match ? match[1].trim().replace(/^"|"$/g, '') : null;
    if (!uri) throw new Error('MONGO_URI not set in server/.env');

    await mongoose.connect(uri);
    console.log('Connected to MongoDB for cleanup.');

    const HOUR = 1000 * 60 * 60;
    const STALE_ACTIVE_HOURS = 720; // 30 days
    const INACTIVE_USER_HOURS = 360; // 15 days

    const cutoffActive = new Date(Date.now() - STALE_ACTIVE_HOURS * HOUR);
    const cutoffLogin = new Date(Date.now() - INACTIVE_USER_HOURS * HOUR);

    console.log('Cutoff active before:', cutoffActive.toISOString());
    console.log('Cutoff lastLogin before:', cutoffLogin.toISOString());

    const staleActives = await ActiveFast.find({ startTime: { $lt: cutoffActive } });
    console.log(`Found ${staleActives.length} ActiveFast(s) older than ${STALE_ACTIVE_HOURS} hours.`);

    const deleted = [];
    for (const act of staleActives) {
      try {
        const user = await User.findById(act.userId).select('lastLogin');
        const lastLogin = user?.lastLogin ?? null;
        const shouldDelete = !lastLogin || lastLogin < cutoffLogin;
        if (shouldDelete) {
          await ActiveFast.deleteOne({ _id: act._id });
          deleted.push(act._id.toString());
          console.log(`Deleted ActiveFast ${act._id} for user ${act.userId} (lastLogin: ${lastLogin})`);
        } else {
          console.log(`Skipped ActiveFast ${act._id} for user ${act.userId} (lastLogin recent: ${lastLogin})`);
        }
      } catch (err) {
        console.error('Error processing ActiveFast', act._id, err.message);
      }
    }

    console.log(`Cleanup complete. Deleted ${deleted.length} stale ActiveFast(s).`);
    if (deleted.length) console.log('Deleted IDs:', deleted.join(', '));

  } catch (err) {
    console.error('Cleanup error:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
  }
})();
