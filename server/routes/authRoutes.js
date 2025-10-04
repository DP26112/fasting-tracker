const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Ensure you have a JWT_SECRET in your .env file!
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_LIFETIME = '7d'; // Token validity

// --- Helper: Generate JWT Token ---
const createToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: JWT_LIFETIME
    });
};

// --- 1. REGISTRATION Route ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // The password will be hashed automatically by the UserSchema pre-save hook
        const user = await User.create({ email, password });
        
        // Create token for immediate login
        const token = createToken(user._id);

        res.status(201).json({ 
            message: 'User successfully registered.',
            user: { id: user._id, email: user.email },
            token 
        });
    } catch (error) {
        // Handle common errors (like duplicate email)
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }
        res.status(500).json({ message: 'Registration failed.', error: error.message });
    }
});

// --- 2. LOGIN Route ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
    // Need to include the password field for comparison; the schema sets select:false
    const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Defensive checks to surface clearer errors when bcrypt fails
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ message: 'Password is required in request body.' });
        }

        if (!user.password) {
            // This should not happen since we selected '+password'
            return res.status(500).json({ message: 'Server error: stored password hash missing for user.' });
        }

    // (debug logs removed)

        let isMatch;
        try {
            // Use the instance method to compare the provided password with the hashed one
            isMatch = await user.comparePassword(password);
        } catch (err) {
            // Surface the bcrypt error for easier debugging
            console.error('BCRYPT_ERROR:', err);
            return res.status(500).json({ message: 'Login failed.', error: err.message });
        }

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Credentials are valid, create a new token
        const token = createToken(user._id);

        // Update lastLogin timestamp
        try {
            user.lastLogin = new Date();
            await user.save();
        } catch (err) {
            console.error('Failed to update lastLogin:', err.message);
            // Not fatal — we still return a successful login
        }

        res.status(200).json({
            message: 'Login successful.',
            user: { id: user._id, email: user.email },
            token
        });

    } catch (error) {
        res.status(500).json({ message: 'Login failed.', error: error.message });
    }
});

module.exports = router;