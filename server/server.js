// server.js - Authenticated State

const path = require('path');
const dotenv = require('dotenv');
// Load .env from the server directory explicitly so the file is found even if node is run from workspace root
const dotenvPath = path.join(__dirname, '.env');
const dotenvResult = dotenv.config({ path: dotenvPath });
if (dotenvResult.error) {
    console.warn(`No .env loaded from ${dotenvPath}; falling back to environment variables.`);
} else {
    console.log(`Loaded environment variables from ${dotenvPath}`);
}

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
const ScheduledReport = require('./models/ScheduledReport');

const app = express();
const PORT = process.env.PORT || 3001;

// Debug flag to gate verbose dev logs (set DEBUG_LOGS=true to enable)
const DEBUG_LOGS = process.env.DEBUG_LOGS === 'true';

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
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // use TLS
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS 
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
});
// ----------------------------------------// --- Helper: format dates like frontend: MM/DD/YY | h:mm AM/PM ---
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
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://fasting.davorinpiljic.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(bodyParser.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, '../client/dist')));
}

// Simple request logger to help debug route issues
app.use((req, res, next) => {
    try {
        if (DEBUG_LOGS) console.log(`>>> Incoming request: ${req.method} ${req.originalUrl}`);
    } catch (e) { /* ignore logging errors */ }
    next();
});

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

    // Debug: log whether an Authorization header was provided and whether JWT_SECRET is configured
    try { if (DEBUG_LOGS) console.log(`requireAuth: header present=${!!authHeader}, jwtSecretSet=${!!JWT_SECRET}, path=${req.method} ${req.originalUrl}`); } catch (e) { /* ignore */ }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // If no token is provided, access is denied
        console.warn('requireAuth: missing or malformed Authorization header for', req.method, req.originalUrl);
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach the user ID to the request object
        req.user = { id: decoded.id };
        next();
    } catch (err) {
        console.warn('requireAuth: invalid token for', req.method, req.originalUrl, err.message);
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
    const { startTime, currentHours, fastType, notes, recipientEmail, recipients } = req.body;

    // Accept either a single recipientEmail or an array of recipients; require at least one recipient and startTime
    const hasRecipients = Array.isArray(recipients) ? recipients.length > 0 : !!recipientEmail;
    if (!hasRecipients || !startTime) {
        return res.status(400).send({ message: 'Missing required data (recipient(s) or start time).' });
    }

    console.log('send-report payload recipients array:', recipients);
    console.log('send-report payload recipientEmail:', recipientEmail);
    // Determine primary recipient (explicit recipientEmail preferred). Put all other recipients into BCC.
    const primaryRecipient = recipientEmail || (Array.isArray(recipients) && recipients.length > 0 ? recipients[0] : null);
    const bccList = Array.isArray(recipients) ? (recipients.filter(r => r && r !== primaryRecipient)) : [];
    console.log(`Attempting to send report. To: ${primaryRecipient}; BCC: ${bccList.join(', ')}`);

    // ensure notes are sorted newest-first
    const originalNotes = (notes || []);
    console.log('send-report: original note times:', originalNotes.map(n => n.time));
    let notesSorted = originalNotes.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
    const allInvalidTimes = notesSorted.length > 0 && notesSorted.every(n => isNaN(new Date(n.time).getTime()));
    if (allInvalidTimes) {
        console.warn('send-report: note times appear invalid; falling back to reversing original array to put newest-first');
        notesSorted = originalNotes.slice().reverse();
    }
    // notesSorted prepared for rendering
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

    // trophyHtml prepared for rendering

    const mailOptions = {
        from: `Fasting Tracker Report <${EMAIL_USER}>`,
        // We'll send the primary message to the primary recipient and then send
        // separate messages to each additional recipient to avoid provider BCC issues.
        to: primaryRecipient,
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

    // Email HTML prepared (preview available via scripts/generate_email_preview.js)

    try {
        console.log('Sending primary message. To:', primaryRecipient, 'Extras:', bccList.join(', '));
        await transporter.sendMail(mailOptions);
        // Now send separate copies to additional recipients (if any)
        if (Array.isArray(bccList) && bccList.length > 0) {
            for (const addr of bccList) {
                try {
                    const copyOptions = { ...mailOptions, to: addr };
                    // remove any bcc in case it was present
                    delete copyOptions.bcc;
                    await transporter.sendMail(copyOptions);
                    console.log('Sent copy to additional recipient:', addr);
                } catch (copyErr) {
                    console.error('Failed to send copy to additional recipient', addr, copyErr && copyErr.message ? copyErr.message : copyErr);
                }
            }
        }
        res.status(200).send({ message: 'Email sent successfully!', to: primaryRecipient, bcc: bccList });
    } catch (error) {
        console.error('Error sending email:', error && error.message ? error.message : error);
        res.status(500).send({ 
            message: 'Failed to send email. Check Nodemailer configuration.', 
            error: error && error.message ? error.message : String(error) 
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


// --- Scheduled Reports Endpoints (PROTECTED) ---
// Create or update a scheduled report for an active fast
app.post('/api/schedule-status-report', requireAuth, async (req, res) => {
    try {
        // Debug: log incoming body and authenticated user id to help diagnose 404/401/500 issues
    try { if (DEBUG_LOGS) console.log('schedule-status-report POST body:', JSON.stringify(req.body)); } catch (e) { if (DEBUG_LOGS) console.log('schedule-status-report POST body: <unserializable>'); }
    try { if (DEBUG_LOGS) console.log('schedule-status-report user:', req.user && req.user.id); } catch (e) { /* ignore */ }
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database not connected; scheduling unavailable.' });
        }
        const userId = req.user.id;
        const { activeFastId, startTime, recipients } = req.body;
        if (!startTime && !activeFastId) return res.status(400).json({ message: 'Missing required fields (startTime or activeFastId).' });
        if (!recipients) return res.status(400).json({ message: 'Missing recipients.' });

        const recList = String(recipients).split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);

        // Resolve activeFastId: if provided and valid ObjectId, use it; otherwise try to find ActiveFast by userId+startTime
        let resolvedActiveFastId = null;
        if (activeFastId && mongoose.Types.ObjectId.isValid(activeFastId)) {
            resolvedActiveFastId = activeFastId;
        }
    const start = startTime ? new Date(startTime) : null;
        if (!resolvedActiveFastId && start) {
            // try to find an active fast for this user with matching startTime
            // Use a tolerant range (±1 minute) because exact ISO equality is brittle across clients
            const rangeStart = new Date(start.getTime() - 60 * 1000);
            const rangeEnd = new Date(start.getTime() + 60 * 1000);
            const active = await ActiveFast.findOne({ userId, startTime: { $gte: rangeStart, $lte: rangeEnd } });
            if (active) resolvedActiveFastId = active._id;
        }
        // If still not resolved, attempt to find the user's active fast (fallback)
        if (!resolvedActiveFastId) {
            const active = await ActiveFast.findOne({ userId });
            if (active) {
                resolvedActiveFastId = active._id;
            }
        }
    // If no activeFastId could be resolved, we will allow scheduling keyed by userId + startTime
    // (this supports cases where the ActiveFast doc isn't present or exact matching failed)
    const now = new Date();

        // compute nextSendAt anchored to start: first at start+24h, then every 6h after
        const firstAnchor = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        let nextSendAt;
        if (now < firstAnchor) {
            nextSendAt = firstAnchor;
        } else {
            const diffMs = now.getTime() - firstAnchor.getTime();
            const intervalsPassed = Math.floor(diffMs / (6 * 60 * 60 * 1000));
            nextSendAt = new Date(firstAnchor.getTime() + (intervalsPassed + 1) * 6 * 60 * 60 * 1000);
        }

        // Upsert by userId + activeFastId
        try {
            const query = resolvedActiveFastId ? { userId, activeFastId: resolvedActiveFastId } : { userId, startTime: start };
            const setObj = { recipients: recList, startTime: start, nextSendAt, enabled: true, processing: false };
            if (resolvedActiveFastId) setObj.activeFastId = resolvedActiveFastId; else setObj.activeFastId = null;
            const upd = await ScheduledReport.findOneAndUpdate(
                query,
                { $set: setObj },
                { upsert: true, new: true, runValidators: true }
            );
            return res.status(200).json({ message: 'Scheduled report created/updated.', schedule: upd });
        } catch (validationErr) {
            console.error('schedule-status-report validation error:', validationErr.message);
            return res.status(400).json({ message: 'Invalid schedule data.', error: validationErr.message });
        }
    } catch (err) {
        console.error('schedule-status-report error:', err.message);
        return res.status(500).json({ message: 'Server error creating schedule.', error: err.message });
    }
});

// GET schedule by activeFastId
app.get('/api/schedule-status-report', requireAuth, async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database not connected; scheduling unavailable.' });
        }
        const userId = req.user.id;
        const { activeFastId, startTime } = req.query;
        if (!activeFastId && !startTime) return res.status(400).json({ message: 'activeFastId or startTime is required.' });

        let resolvedActiveFastId = null;
        if (activeFastId && mongoose.Types.ObjectId.isValid(String(activeFastId))) resolvedActiveFastId = activeFastId;
        if (!resolvedActiveFastId && startTime) {
            const start = new Date(String(startTime));
            const rangeStart = new Date(start.getTime() - 60 * 1000);
            const rangeEnd = new Date(start.getTime() + 60 * 1000);
            const active = await ActiveFast.findOne({ userId, startTime: { $gte: rangeStart, $lte: rangeEnd } });
            if (active) resolvedActiveFastId = active._id;
        }
        if (!resolvedActiveFastId) {
            const active = await ActiveFast.findOne({ userId });
            if (active) resolvedActiveFastId = active._id;
        }
    // First try to find by activeFastId if we resolved one
        let sched = null;
        if (resolvedActiveFastId) {
            sched = await ScheduledReport.findOne({ userId, activeFastId: resolvedActiveFastId });
        }
        // If not found and startTime was provided, try to find schedule by (userId + startTime) using same ±1 minute tolerance
        if (!sched && startTime) {
            const start = new Date(String(startTime));
            const rangeStart = new Date(start.getTime() - 60 * 1000);
            const rangeEnd = new Date(start.getTime() + 60 * 1000);
            sched = await ScheduledReport.findOne({ userId, startTime: { $gte: rangeStart, $lte: rangeEnd } });
        }

        return res.status(200).json({ schedule: sched || null });
    } catch (err) {
        console.error('GET schedule-status-report error:', err.message);
        return res.status(500).json({ message: 'Server error fetching schedule.', error: err.message });
    }
});

// DELETE schedule for activeFastId
app.delete('/api/schedule-status-report', requireAuth, async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database not connected; scheduling unavailable.' });
        }
        const userId = req.user.id;
        const { activeFastId, startTime } = req.body || req.query;
        if (!activeFastId && !startTime) return res.status(400).json({ message: 'activeFastId or startTime is required.' });

        let resolvedActiveFastId = null;
        if (activeFastId && mongoose.Types.ObjectId.isValid(String(activeFastId))) resolvedActiveFastId = activeFastId;
        if (!resolvedActiveFastId && startTime) {
            const start = new Date(String(startTime));
            const rangeStart = new Date(start.getTime() - 60 * 1000);
            const rangeEnd = new Date(start.getTime() + 60 * 1000);
            const active = await ActiveFast.findOne({ userId, startTime: { $gte: rangeStart, $lte: rangeEnd } });
            if (active) resolvedActiveFastId = active._id;
        }
        if (!resolvedActiveFastId) {
            const active = await ActiveFast.findOne({ userId });
            if (active) resolvedActiveFastId = active._id;
        }

        // If we resolved an activeFastId, delete by that; otherwise if startTime was provided delete by userId+startTime
        if (resolvedActiveFastId) {
            await ScheduledReport.deleteOne({ userId, activeFastId: resolvedActiveFastId });
            return res.status(200).json({ message: 'Schedule removed.' });
        }

        if (startTime) {
            const start = new Date(String(startTime));
            const rangeStart = new Date(start.getTime() - 60 * 1000);
            const rangeEnd = new Date(start.getTime() + 60 * 1000);
            await ScheduledReport.deleteOne({ userId, startTime: { $gte: rangeStart, $lte: rangeEnd } });
            return res.status(200).json({ message: 'Schedule removed by startTime.' });
        }

        return res.status(404).json({ message: 'Active fast not found for user.' });
    } catch (err) {
        console.error('DELETE schedule-status-report error:', err.message);
        return res.status(500).json({ message: 'Server error deleting schedule.', error: err.message });
    }
});


// --- Simple DB-polling Scheduler (Phase A - safe defaults) ---
const SCHEDULER_POLL_INTERVAL_MS = Number(process.env.SCHEDULER_POLL_INTERVAL_MS) || 5 * 60 * 1000; // default 5 minutes
const SCHEDULER_BATCH_LIMIT = Number(process.env.SCHEDULER_BATCH_LIMIT) || 50;

// Scheduler interval handle so we can clear it on shutdown or when DB disconnects
let schedulerInterval = null;

function startScheduler() {
    if (schedulerInterval) return;
    schedulerInterval = setInterval(processDueSchedules, SCHEDULER_POLL_INTERVAL_MS);
    console.log('Scheduler started with interval ms=', SCHEDULER_POLL_INTERVAL_MS);
}

function stopScheduler() {
    if (!schedulerInterval) return;
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped');
}

async function processDueSchedules() {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
    try {
        const now = new Date();
        // Find up to batch limit schedules that are due and not processing
        const due = await ScheduledReport.find({ enabled: true, processing: false, nextSendAt: { $lte: now } }).limit(SCHEDULER_BATCH_LIMIT);
        if (!due || due.length === 0) return;

        for (const sched of due) {
            // Try to atomically claim it
            const claimed = await ScheduledReport.findOneAndUpdate(
                { _id: sched._id, processing: false },
                { $set: { processing: true } },
                { new: true }
            );
            if (!claimed) continue; // someone else claimed

            (async () => {
                try {
                    // Verify the fast is still active
                    const active = await ActiveFast.findOne({ _id: claimed.activeFastId, userId: claimed.userId });
                    if (!active) {
                        // disable schedule
                        await ScheduledReport.findByIdAndUpdate(claimed._id, { $set: { enabled: false, processing: false } });
                        return;
                    }

                    // Build the same payload used by /api/send-report
                    const payload = {
                        startTime: claimed.startTime.toISOString(),
                        currentHours: (new Date().getTime() - new Date(claimed.startTime).getTime()) / (1000 * 60 * 60),
                        fastType: active.fastType,
                        notes: (active.notes || []).map(n => ({ time: n.time, text: n.text, fastHours: null })),
                        // keep recipients array on the scheduled record; normalize to an array here
                        recipients: Array.isArray(claimed.recipients) ? claimed.recipients : String(claimed.recipients || '').split(',').map(s => s.trim()).filter(Boolean)
                    };

                    // Determine primary recipient + BCC list (mirror /api/send-report behavior)
                    const recArr = payload.recipients || [];
                    const primaryRecipient = recArr.length > 0 ? recArr[0] : null;
                    const bccList = recArr.length > 1 ? recArr.slice(1) : [];
                    if (!primaryRecipient) {
                        console.warn('Scheduled send skipped: no recipients for schedule', claimed._id);
                        // disable the schedule to avoid repeated useless work
                        await ScheduledReport.findByIdAndUpdate(claimed._id, { $set: { enabled: false, processing: false } });
                        return;
                    }

                    // Call internal send logic by invoking transporter directly (reuse same mail building logic)
                    // For simplicity, we'll reuse the /api/send-report by calling the mailer code inline
                    // Construct notesHtml similar to send-report
                    const originalNotes = payload.notes || [];
                    let notesSorted = originalNotes.slice().sort((a, b) => new Date(b.time) - new Date(a.time));
                    const allInvalidTimes = notesSorted.length > 0 && notesSorted.every(n => isNaN(new Date(n.time).getTime()));
                    if (allInvalidTimes) notesSorted = originalNotes.slice().reverse();

                    const notesHtml = notesSorted.map(note => {
                        const timeStr = formatNoteTimestamp(note.time);
                        const atHourRaw = note.fastHours ?? note.fastHour ?? note.duration ?? null;
                        const atHour = formatHourValue(atHourRaw);
                        const prefix = atHour != null ? `${timeStr} @ ${atHour}h` : `${timeStr}`;
                        return `<li style="margin-bottom: 8px; color: #000;"><strong>${prefix}</strong> — ${note.text}</li>`;
                    }).join('');

                    const hrs = Number(payload.currentHours) || 0;
                    const goldCount = Math.floor(hrs / 24);
                    const remainder = hrs - goldCount * 24;
                    const showPartial = goldCount >= 1 && remainder >= 6;
                    const partialIsSilver = remainder >= 12;
                    let trophyHtml = '';
                    const svgFor = (color, size = 18) => `\n        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle; margin-right:6px;">\n            <path d="M12 2l2.09 4.24L18.6 7l-3.3 2.9L16 14l-4-2-4 2 0.7-4.1L4.4 7l4.51-0.76L12 2z" fill="${color}" />\n        </svg>`;

                    for (let i = 0; i < goldCount; i++) {
                        trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">\n            <span style=\"font-size:18px; line-height:1; margin-right:6px;\">🏆</span>${svgFor('#FFD700', 18)}</span>`;
                    }
                    if (showPartial) {
                        if (partialIsSilver) {
                            trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">\n                <span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥈</span>${svgFor('#C0C0C0', 16)}</span>`;
                        } else {
                            trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;">\n                <span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥉</span>${svgFor('#CD7F32', 16)}</span>`;
                        }
                    }
                    if (!trophyHtml) trophyHtml = '<span style="color:#666;">No trophies yet</span>';

                    const mailOptions = {
                        from: `Fasting Tracker Report <${EMAIL_USER}>`,
                        to: primaryRecipient,
                        bcc: bccList.length > 0 ? bccList.join(', ') : undefined,
                        subject: `Fasting Status Report - ${payload.currentHours.toFixed(2)} Hours`,
                        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="margin-bottom:12px;">${trophyHtml}</div>
                <h2 style="color: #000;">Fasting Report Summary</h2>
                <p><strong>Fast Start Time:</strong> ${new Date(payload.startTime).toLocaleString()}</p>
                <p><strong>Current Hours Fasted:</strong> ${payload.currentHours.toFixed(2)} hours</p>
                <p><strong>Fast Type:</strong> <span style="font-weight: bold; text-transform: uppercase; color: ${active.fastType === 'dry' ? '#D32F2F' : '#2196F3'};">${active.fastType} Fast</span></p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <h3 style="color: #000;">Fasting Notes:</h3>
                ${notesSorted.length > 0 ? `<ul style="padding-left: 20px; list-style-type: none; color: #000;">${notesHtml}</ul>` : '<p>No notes logged during this fast.</p>'}
            </div>
                        `
                    };

                    console.log('Scheduled send. To:', primaryRecipient, 'Extras:', bccList.join(', '));
                    try {
                        await transporter.sendMail(mailOptions);
                        // send individual copies to extras to avoid BCC delivery issues
                        if (Array.isArray(bccList) && bccList.length > 0) {
                            for (const addr of bccList) {
                                try {
                                    const copyOptions = { ...mailOptions, to: addr };
                                    delete copyOptions.bcc;
                                    await transporter.sendMail(copyOptions);
                                    console.log('Scheduled copy sent to additional recipient:', addr);
                                } catch (copyErr) {
                                    console.error('Failed scheduled copy to', addr, copyErr && copyErr.message ? copyErr.message : copyErr);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Scheduled send failed for schedule', claimed._id, err && err.message ? err.message : err);
                        // clear processing flag so it can be retried next run
                        await ScheduledReport.findByIdAndUpdate(claimed._id, { $set: { processing: false } });
                        return;
                    }

                    // advance nextSendAt by intervalHours (default 6), but align to anchor sequence based on startTime
                    const newNext = new Date(claimed.nextSendAt.getTime() + (claimed.intervalHours || 6) * 60 * 60 * 1000);
                    await ScheduledReport.findByIdAndUpdate(claimed._id, { $set: { nextSendAt: newNext, processing: false } });

                } catch (err) {
                    console.error('Error processing scheduled report:', err.message);
                    try { await ScheduledReport.findByIdAndUpdate(sched._id, { $set: { processing: false } }); } catch (e) { /* swallow */ }
                }
            })();
        }

    } catch (err) {
        console.error('Scheduler error:', err.message);
    }
}

// Start scheduler only when DB is connected and not in test mode. If DB not connected we won't start polling.
if (process.env.NODE_ENV !== 'test') {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        startScheduler();
    } else {
        mongoose.connection.on('connected', () => startScheduler());
        mongoose.connection.on('disconnected', () => stopScheduler());
    }
} else {
    console.log('NODE_ENV=test: scheduler disabled');
}

// Start the HTTP server and keep a reference so we can close it on shutdown
const httpServer = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown to allow process to exit cleanly (close DB, HTTP server, scheduler, and transporter)
async function gracefulShutdown(reason) {
    console.log('Graceful shutdown initiated', reason || '');
    try {
        stopScheduler();
        if (httpServer && typeof httpServer.close === 'function') {
            await new Promise((resolve) => httpServer.close(resolve));
            console.log('HTTP server closed');
        }
        if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('Mongoose disconnected');
        }
        if (transporter && typeof transporter.close === 'function') {
            try { transporter.close(); console.log('Mailer transporter closed'); } catch (e) { /* ignore */ }
        }
    } catch (err) {
        console.error('Error during graceful shutdown:', err);
    } finally {
        // Give Node a moment to cleanup then exit
        setTimeout(() => process.exit(0), 100);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception, shutting down:', err);
    gracefulShutdown('uncaughtException');
});

// Temporary unauthenticated debug endpoints (remove after debugging)
app.get('/api/_debug/ping', (req, res) => {
    res.json({ ok: true, now: new Date().toISOString(), url: req.originalUrl });
});

app.post('/api/_debug/ping', (req, res) => {
    res.json({ ok: true, now: new Date().toISOString(), url: req.originalUrl, body: req.body });
});

// Debug helper: preview how recipients will be mapped to To/BCC without sending mail
app.post('/api/_debug/preview-send', (req, res) => {
    try {
        const { recipientEmail, recipients } = req.body || {};
        const recArr = Array.isArray(recipients) ? recipients : (typeof recipients === 'string' && recipients.length ? recipients.split(',').map(s => s.trim()).filter(Boolean) : []);
        const primaryRecipient = recipientEmail || (recArr.length > 0 ? recArr[0] : null);
        const bccList = recArr.filter(r => r && r !== primaryRecipient);
        console.log('Preview send - primary:', primaryRecipient, 'bcc:', bccList.join(', '), 'raw recipients:', recipients);
        return res.json({ primaryRecipient, bcc: bccList, receivedRecipients: recArr });
    } catch (err) {
        console.error('preview-send error:', err.message);
        return res.status(500).json({ message: 'Preview failed', error: err.message });
    }
});

// Catch-all handler for React app in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
    });
}

// 404 handler for unmatched routes — log the path and return a clear 404
app.use((req, res) => {
    console.warn(`404 - No route matched for ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: `Not Found: ${req.originalUrl}` });
});

