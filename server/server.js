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

mongoose.connect(DB_URL)
  .then(() => console.log('MongoDB Atlas connected successfully! 🚀'))
  .catch(err => console.error('MongoDB connection error:', err));
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

    const notesHtml = notes.map(note => 
        `<li style="margin-bottom: 5px;"><strong>${new Date(note.time).toLocaleTimeString()}</strong> - ${note.text}</li>`
    ).join('');

    const mailOptions = {
        from: `Fasting Tracker Report <${EMAIL_USER}>`,
        to: recipientEmail,
        subject: `Fasting Status Report - ${currentHours.toFixed(2)} Hours`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #6200EE;">Fasting Report Summary</h2>
                <p><strong>Fast Start Time:</strong> ${new Date(startTime).toLocaleString()}</p>
                <p><strong>Current Hours Fasted:</strong> ${currentHours.toFixed(2)} hours</p>
                <p><strong>Fast Type:</strong> <span style="font-weight: bold; text-transform: uppercase; color: ${fastType === 'dry' ? '#D32F2F' : '#2196F3'};">${fastType} Fast</span></p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                
                <h3 style="color: #6200EE;">Fasting Notes:</h3>
                ${notes.length > 0 ? `<ul style="padding-left: 20px; list-style-type: none;">${notesHtml}</ul>` : '<p>No notes logged during this fast.</p>'}
            </div>
        `
    };

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
            const notesHtml = fast.notes.map(note => 
                `<li>- ${new Date(note.time).toLocaleTimeString()} : ${note.text}</li>`
            ).join('');

            return `
                <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; border-radius: 5px;">
                    <h4 style="color: #6200EE; margin-top: 0;">${fast.durationHours.toFixed(2)} Hours (${fast.fastType.toUpperCase()})</h4>
                    <p style="margin: 5px 0;"><strong>Completed:</strong> ${endDate}</p>
                    <p style="margin: 5px 0;"><strong>Started:</strong> ${startDate}</p>
                    ${fast.notes.length > 0 ? 
                        `<strong>Notes:</strong><ul style="list-style-type: none; padding-left: 10px; font-size: 0.9em;">${notesHtml}</ul>` : 
                        '<p style="font-style: italic;">No notes logged.</p>'
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
                    <h2 style="color: #6200EE;">Complete Fasting History</h2>
                    <p>Attached below are all ${history.length} logged fasts from your tracker.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    ${historyHtml}
                </div>
            `
        };

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

// Run cleanup on startup and every 6 hours thereafter
cleanupStaleActiveFasts();
setInterval(cleanupStaleActiveFasts, 6 * HOUR);

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