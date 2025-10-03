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
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Use the instance method to compare the provided password with the hashed one
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Credentials are valid, create a new token
        const token = createToken(user._id);

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