// server.js - Authenticated State

require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // 🔑 NEW: Require JWT for middleware

// 🔑 NEW: Require the User model and Auth routes
const User = require('./models/User'); 
const authRoutes = require('./routes/authRoutes');

// Require the Fast model (assuming it's in ./models/Fast)
const Fast = require('./models/Fast');
const ActiveFast = require('./models/ActiveFast');

const app = express();
const PORT = 3001;

// --- AUTH CONFIG ---
const JWT_SECRET = process.env.JWT_SECRET;
// -------------------

// --- DATABASE CONNECTION (Using .env) ---
const DB_URL = process.env.MONGO_URI; 

if (DB_URL) {
        mongoose.connect(DB_URL)
            .then(() => console.log('MongoDB Atlas connected successfully! 🚀'))
            .catch(err => console.error('MongoDB connection error:', err));
} else {
        console.warn('MONGO_URI not set — skipping MongoDB connection. Some routes will be disabled.');
}
// ----------------------------------------


// --- EMAIL CONFIGURATION (Using .env) ---
const EMAIL_USER = process.env.EMAIL_USER;  
const EMAIL_PASS = process.env.EMAIL_PASS;  

// Configure the Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS 
    }
});
// ----------------------------------------

// --- Helper: format dates like frontend: MM/DD/YY | h:mm AM/PM ---
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function formatNoteTimestamp(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const yy = String(d.getFullYear()).slice(-2);

    // 12-hour time
    let hrs = d.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    if (hrs === 0) hrs = 12;
    const mins = pad2(d.getMinutes());
    return `${mm}/${dd}/${yy} | ${hrs}:${mins} ${ampm}`;
}

function formatHourValue(val) {
    const num = Number(val);
    if (Number.isFinite(num)) {
        // one decimal place, trim trailing zeros (but keep one decimal like 18.0 -> 18.0)
        return num.toFixed(1);
    }
    return null;
}


// --- Middleware ---
app.use(cors({
    origin: 'http://localhost:5173' 
}));
app.use(bodyParser.json());

// --- Health endpoints ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), name: 'fasting-tracker' });
});

app.get('/api/ready', (req, res) => {
    const ready = mongoose && mongoose.connection && mongoose.connection.readyState === 1;
    if (ready) return res.json({ ready: true });
    return res.status(503).json({ ready: false });
});


// --- Health endpoints ---
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

app.get('/api/ready', (req, res) => {
    // mongoose.connection.readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const readyState = mongoose.connection.readyState;
    if (readyState === 1) {
        return res.status(200).json({ ready: true });
    }
    res.status(503).json({ ready: false, readyState });
});



// 🔑 NEW: JWT Authentication Middleware
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // If no token is provided, access is denied
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach the user ID to the request object
        req.user = { id: decoded.id }; 
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

// 🔑 NEW: Mount the Auth Routes
app.use('/api/auth', authRoutes);


// 1. Endpoint to save a completed fast (PROTECTED)
app.post('/api/save-fast', requireAuth, async (req, res) => { // 🔑 ADDED: requireAuth
    const { startTime, endTime, durationHours, fastType, notes } = req.body;
    const userId = req.user.id; // 🔑 NEW: Get user ID from the token
    
    try {
        const newFast = new Fast({ 
            userId, // 🔑 NEW: Link the fast to the user
            startTime,
            endTime,
            durationHours,
            fastType,
            notes,
        });

        await newFast.save();
        // Remove any active-fast entry for this user now that the fast is completed
        try {
            await ActiveFast.deleteOne({ userId });
        } catch (err) {
            console.error('Failed to remove active fast after save:', err.message);
        }
        res.status(201).send({ message: 'Fast successfully logged!', fast: newFast });
    } catch (error) {
        console.error('Error logging fast:', error);
        res.status(500).send({ message: 'Failed to log fast statistics.', error: error.message });
    }
});


// 2. Endpoint to fetch all logged fasts (PROTECTED - only fetching *user's* fasts)
app.get('/api/fast-history', requireAuth, async (req, res) => { // 🔑 ADDED: requireAuth
    const userId = req.user.id; // 🔑 NEW: Get user ID from the token
    try {
        // 🔑 MODIFIED: Find only fasts belonging to the authenticated user
        const history = await Fast.find({ userId }).sort({ endTime: -1 }); 
        res.status(200).send(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).send({ message: 'Failed to retrieve fast history.', error: error.message });
    }
});


// 3. Email Current Status Endpoint (ANONYMOUS - UNCHANGED)
app.post('/api/send-report', async (req, res) => {
    const { startTime, currentHours, fastType, notes, recipientEmail } = req.body;

    if (!recipientEmail || !startTime) {
        return res.status(400).send({ message: 'Missing required data (recipient or start time).' });
    }

    console.log(`Attempting to send report to: ${recipientEmail}`);

    // ensure notes are sorted newest-first
    const originalNotes = (notes || []);
    console.log('send-report: original note times:', originalNotes.map(n => n.time));
    let notesSorted = originalNotes.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
    const allInvalidTimes = notesSorted.length > 0 && notesSorted.every(n => isNaN(new Date(n.time).getTime()));
    if (allInvalidTimes) {
        console.warn('send-report: note times appear invalid; falling back to reversing original array to put newest-first');
        notesSorted = originalNotes.slice().reverse();
    }
    console.log('send-report: sorted note times:', notesSorted.map(n => n.time));
    const notesHtml = notesSorted.map(note => {
        const timeStr = formatNoteTimestamp(note.time);
        const atHourRaw = note.fastHours ?? note.fastHour ?? note.duration ?? null;
        const atHour = formatHourValue(atHourRaw);
        const prefix = atHour != null ? `${timeStr} @ ${atHour}h` : `${timeStr}`;
        return `<li style="margin-bottom: 8px; color: #000;"><strong>${prefix}</strong> — ${note.text}</li>`;
    }).join('');

    // Build trophy HTML for the email (same rules as the client)
    const hrs = Number(currentHours) || 0;
    const goldCount = Math.floor(hrs / 24);
    const remainder = hrs - goldCount * 24;
    const showPartial = goldCount >= 1 && remainder >= 6;
    const partialIsSilver = remainder >= 12;
    let trophyHtml = '';
    const svgFor = (color, size = 18) => `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle; margin-right:6px;">
            <path d="M12 2l2.09 4.24L18.6 7l-3.3 2.9L16 14l-4-2-4 2 0.7-4.1L4.4 7l4.51-0.76L12 2z" fill="${color}" />
        </svg>`;

    // Include both an inline SVG and an emoji fallback per trophy so stricter email clients that strip SVG
    // will still display a recognizable trophy/medal glyph.
    for (let i = 0; i < goldCount; i++) {
        trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">
            <span style=\"font-size:18px; line-height:1; margin-right:6px;\">🏆</span>${svgFor('#FFD700', 18)}</span>`;
    }
    if (showPartial) {
        if (partialIsSilver) {
            trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">
                <span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥈</span>${svgFor('#C0C0C0', 16)}</span>`;
        } else {
            trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">
                <span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥉</span>${svgFor('#CD7F32', 16)}</span>`;
        }
    }
    if (!trophyHtml) trophyHtml = '<span style="color:#666;">No trophies yet</span>';

    console.log('send-report: trophyHtml ->', trophyHtml);

    const mailOptions = {
        from: `Fasting Tracker Report <${EMAIL_USER}>`,
        to: recipientEmail,
        subject: `Fasting Status Report - ${currentHours.toFixed(2)} Hours`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <!-- Trophy summary (exalted above the report) -->
                <div style="margin-bottom:12px;">
                    ${trophyHtml}
                </div>
                <h2 style="color: #000;">Fasting Report Summary</h2>
                <p><strong>Fast Start Time:</strong> ${new Date(startTime).toLocaleString()}</p>
                <p><strong>Current Hours Fasted:</strong> ${currentHours.toFixed(2)} hours</p>
                <p><strong>Fast Type:</strong> <span style="font-weight: bold; text-transform: uppercase; color: ${fastType === 'dry' ? '#D32F2F' : '#2196F3'};">${fastType} Fast</span></p>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

                <h3 style="color: #000;">Fasting Notes:</h3>
                ${notes.length > 0 ? `<ul style="padding-left: 20px; list-style-type: none; color: #000;">${notesHtml}</ul>` : '<p>No notes logged during this fast.</p>'}
            </div>
        `
    };

    // Debug: print HTML for verification (helps when mail delivery may fail)
    console.log('=== Generated Email HTML (send-report) ===');
    console.log(mailOptions.html);
    console.log('=== End Generated Email HTML ===');

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        res.status(200).send({ message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error.message);
        res.status(500).send({ 
            message: 'Failed to send email. Check Nodemailer configuration.', 
            error: error.message 
        });
    }
});


// 4. Endpoint to email the entire history (ANONYMOUS - UNCHANGED)
app.post('/api/email-history', async (req, res) => {
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
        return res.status(400).send({ message: 'Missing recipient email.' });
    }

    // NOTE: This route still fetches ALL records in the database (since it's unprotected).
    // In a final auth setup, you should make this protected and use { userId } in Fast.find()
    try {
        const history = await Fast.find().sort({ endTime: -1 }); 

        if (history.length === 0) {
            return res.status(404).send({ message: 'No fasts found to report.' });
        }

        const historyHtml = history.map(fast => {
            const startDate = new Date(fast.startTime).toLocaleString();
            const endDate = new Date(fast.endTime).toLocaleString();
            const originalNotes = (fast.notes || []);
            console.log(`email-history: fast ${fast._id} original note times:`, originalNotes.map(n => n.time));
            let notesSorted = originalNotes.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
            const allInvalidTimes = notesSorted.length > 0 && notesSorted.every(n => isNaN(new Date(n.time).getTime()));
            if (allInvalidTimes) {
                console.warn(`email-history: fast ${fast._id} note times invalid; reversing original notes`);
                notesSorted = originalNotes.slice().reverse();
            }
            console.log(`email-history: fast ${fast._id} sorted note times:`, notesSorted.map(n => n.time));
            const notesHtml = notesSorted.map(note => {
                const full = formatNoteTimestamp(note.time);
                const atHour = formatHourValue(note.fastHours ?? note.fastHour ?? note.duration ?? null);
                const prefix = atHour != null ? `${full} @ ${atHour}h` : `${full}`;
                return `<li style="margin-bottom:8px; color:#000;"><strong>${prefix}</strong> — ${note.text}</li>`;
            }).join('');

            return `
                <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; border-radius: 5px;">
                    <h4 style="color: inherit; margin-top: 0;">${fast.durationHours.toFixed(2)} Hours (${fast.fastType.toUpperCase()})</h4>
                    <p style="margin: 5px 0;"><strong>Completed:</strong> ${endDate}</p>
                    <p style="margin: 5px 0;"><strong>Started:</strong> ${startDate}</p>
                    ${fast.notes && fast.notes.length > 0 ? 
                        `<strong>Notes:</strong><ul style="list-style-type: none; padding-left: 10px; font-size: 0.95em; color:#000;">${notesHtml}</ul>` : 
                        '<p style="font-style: italic; color:#000;">No notes logged.</p>'
                    }
                </div>
            `;
        }).join('');

        const mailOptions = {
            from: `Fasting Tracker Report <${EMAIL_USER}>`,
            to: recipientEmail,
            subject: `Complete Fasting History Report (${history.length} Entries)`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #000;">Complete Fasting History</h2>
                    <p>Attached below are all ${history.length} logged fasts from your tracker.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    ${historyHtml}
                </div>
            `
        };

    // Debug: print HTML for verification
    console.log('=== Generated Email HTML (email-history) ===');
    console.log(mailOptions.html);
    console.log('=== End Generated Email HTML ===');

    await transporter.sendMail(mailOptions);
    console.log('History email sent successfully!');
    res.status(200).send({ message: 'Complete history emailed successfully!' });

    } catch (error) {
        console.error('Error emailing history:', error);
        res.status(500).send({ 
            message: 'Failed to email history. Check Nodemailer configuration and database access.', 
            error: error.message 
        });
    }
});


// 5. DELETE A FAST RECORD BY ID (PROTECTED)
app.delete('/api/fast-history/:id', requireAuth, async (req, res) => { // 🔑 ADDED: requireAuth
    const { id } = req.params;
    const userId = req.user.id; // 🔑 NEW: Get user ID from the token
    
    console.log(`Attempting to delete fast record with ID: ${id} for user ${userId}`);

    if (!id) {
        return res.status(400).json({ message: 'Fast ID is required.' });
    }

    try {
        // 🔑 MODIFIED: Find and delete ONLY if the fast belongs to the authenticated user
        const deletedFast = await Fast.findOneAndDelete({ _id: id, userId });  

        if (!deletedFast) {
            // Updated status message to reflect authorization check
            return res.status(404).json({ message: 'Fast record not found or access denied.' });
        }

        console.log(`Successfully deleted fast: ${id}`);
        res.status(200).json({ message: 'Fast record deleted successfully.' });

    } catch (error) {
        console.error('Error deleting fast record (detailed):', error.message);
        
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Fast ID format.', detailedError: error.message });
        }

        res.status(500).json({ message: 'Server error during deletion.', detailedError: error.message });
    }
});

// 6. DELETE A NOTE from a logged fast (PROTECTED)
app.patch('/api/fast-history/:fastId/notes', requireAuth, async (req, res) => { // 🔑 ADDED: requireAuth
    const { fastId } = req.params;
    const { noteId } = req.body; 
    const userId = req.user.id; // 🔑 NEW: Get user ID from the token
  

    if (!fastId || !noteId) {
        return res.status(400).json({ message: 'Fast ID and Note ID are required for deletion.' });
    }

    try {
        // 🔑 MODIFIED: Update the fast ONLY if it belongs to the authenticated user
        const result = await Fast.updateOne(
            { _id: fastId, userId }, 
            { $pull: { notes: { id: noteId } } } 
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Fast log not found or access denied.' });
        }
        
        if (result.modifiedCount === 0 && result.matchedCount === 1) {
             console.log(`Fast found but note ${noteId} was not present (already deleted?).`);
        }

        console.log(`Note ${noteId} successfully deleted from fast ${fastId}.`);
        res.status(200).json({ message: 'Note deleted successfully.' });
        
    } catch (error) {
        console.error('Error deleting note:', error.message);
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Fast ID format.', detailedError: error.message });
        }
        res.status(500).json({ message: 'Server error during note deletion.', detailedError: error.message });
    }
});


// 7. Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// --- Cleanup job for stale ActiveFast entries ---
// Criteria: ActiveFast.startTime older than 720 hours (30 days)
// AND user.lastLogin is null or older than 360 hours (15 days)
const HOUR = 1000 * 60 * 60;
const STALE_ACTIVE_HOURS = 720; // 30 days
const INACTIVE_USER_HOURS = 360; // 15 days

async function cleanupStaleActiveFasts() {
    try {
        // If mongoose isn't connected yet, skip cleanup to avoid buffering/timeouts
        if (!mongoose || !mongoose.connection || mongoose.connection.readyState !== 1) {
            console.log('cleanupStaleActiveFasts: mongoose not connected, skipping cleanup.');
            return 0;
        }
        const cutoffActive = new Date(Date.now() - STALE_ACTIVE_HOURS * HOUR);
        const cutoffLogin = new Date(Date.now() - INACTIVE_USER_HOURS * HOUR);

        // Find ActiveFast docs older than cutoffActive
        const staleActives = await ActiveFast.find({ startTime: { $lt: cutoffActive } });
        let deletedCount = 0;

        for (const act of staleActives) {
            try {
                const user = await User.findById(act.userId).select('lastLogin');
                const lastLogin = user?.lastLogin;

                if (!lastLogin || lastLogin < cutoffLogin) {
                    await ActiveFast.deleteOne({ _id: act._id });
                    deletedCount++;
                }
            } catch (err) {
                console.error('Error checking user for active-fast cleanup:', err.message);
            }
        }

        if (deletedCount > 0) console.log(`Cleanup: removed ${deletedCount} stale ActiveFast(s)`);
        return deletedCount;
    } catch (err) {
        console.error('Error during stale active-fast cleanup:', err.message);
        return 0;
    }
}

// Run cleanup after a short delay (gives mongoose time to connect) and every 6 hours thereafter
setTimeout(() => {
    cleanupStaleActiveFasts().catch(err => console.error('Initial cleanup failed:', err));
    setInterval(cleanupStaleActiveFasts, 6 * HOUR);
}, 30 * 1000);

// Admin endpoint to trigger cleanup on demand (protected)
app.post('/api/admin/cleanup-active-fasts', requireAuth, async (req, res) => {
    try {
        const deleted = await cleanupStaleActiveFasts();
        return res.status(200).json({ message: 'Cleanup run', deleted });
    } catch (err) {
        console.error('Admin cleanup error:', err.message);
        return res.status(500).json({ message: 'Cleanup failed', error: err.message });
    }
});

// --- ACTIVE FAST Endpoints (per-user) ---
// Get current active fast for the authenticated user
app.get('/api/active-fast', requireAuth, async (req, res) => {
    const userId = req.user.id;
    try {
        const active = await ActiveFast.findOne({ userId });
        if (!active) return res.status(404).json({ message: 'No active fast' });
        res.status(200).json({ active });
    } catch (err) {
        console.error('Error fetching active fast:', err.message);
        res.status(500).json({ message: 'Failed to fetch active fast.' });
    }
});

// Create or update active fast for authenticated user
app.post('/api/active-fast', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { startTime, fastType, notes } = req.body;
    try {
        const update = { startTime, fastType, notes, updatedAt: new Date() };
        const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
        const active = await ActiveFast.findOneAndUpdate({ userId }, update, opts);
        res.status(200).json({ message: 'Active fast updated', active });
    } catch (err) {
        console.error('Error upserting active fast:', err.message);
        res.status(500).json({ message: 'Failed to set active fast.' });
    }
});

// Delete active fast for authenticated user
app.delete('/api/active-fast', requireAuth, async (req, res) => {
    const userId = req.user.id;
    try {
        await ActiveFast.deleteOne({ userId });
        res.status(200).json({ message: 'Active fast cleared' });
    } catch (err) {
        console.error('Error clearing active fast:', err.message);
        res.status(500).json({ message: 'Failed to clear active fast.' });
    }
});