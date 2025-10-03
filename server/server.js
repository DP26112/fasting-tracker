// server.js - Pre-Fix, Pre-Auth State

require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Require the Fast model (assuming it's in ./models/Fast)
const Fast = require('./models/Fast');

const app = express();
const PORT = 3001;

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


// 1. Endpoint to save a completed fast (Anonymous Access)
app.post('/api/save-fast', async (req, res) => {
    const { startTime, endTime, durationHours, fastType, notes } = req.body;
    
    try {
        const newFast = new Fast({ 
            startTime,
            endTime,
            durationHours,
            fastType,
            notes,
        });

        await newFast.save();
        res.status(201).send({ message: 'Fast successfully logged!', fast: newFast });
    } catch (error) {
        console.error('Error logging fast:', error);
        res.status(500).send({ message: 'Failed to log fast statistics.', error: error.message });
    }
});


// 2. Endpoint to fetch all logged fasts (Anonymous Access)
app.get('/api/fast-history', async (req, res) => {
    try {
        const history = await Fast.find().sort({ endTime: -1 }); 
        res.status(200).send(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).send({ message: 'Failed to retrieve fast history.', error: error.message });
    }
});


// 3. Email Current Status Endpoint (Anonymous Access)
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


// 4. Endpoint to email the entire history (Anonymous Access)
app.post('/api/email-history', async (req, res) => {
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
        return res.status(400).send({ message: 'Missing recipient email.' });
    }

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


// 5. DELETE A FAST RECORD BY ID (Anonymous Access)
app.delete('/api/fast-history/:id', async (req, res) => {
    const { id } = req.params;
    
    console.log(`Attempting to delete fast record with ID: ${id}`);

    if (!id) {
        return res.status(400).json({ message: 'Fast ID is required.' });
    }

    try {
        const deletedFast = await Fast.findByIdAndDelete(id); 

        if (!deletedFast) {
            return res.status(404).json({ message: 'Fast record not found in the database.' });
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

// 6. DELETE A NOTE from a logged fast (Anonymous Access)
app.patch('/api/fast-history/:fastId/notes', async (req, res) => {
    const { fastId } = req.params;
    const { noteId } = req.body;  

    if (!fastId || !noteId) {
        return res.status(400).json({ message: 'Fast ID and Note ID are required for deletion.' });
    }

    try {
        const result = await Fast.updateOne(
            { _id: fastId }, 
            { $pull: { notes: { id: noteId } } } 
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Fast log not found.' });
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