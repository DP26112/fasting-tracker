const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Ensure you have a JWT_SECRET in your .env file!
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_LIFETIME = process.env.ACCESS_TOKEN_LIFETIME || '15m';
const REFRESH_TOKEN_LIFETIME = process.env.REFRESH_TOKEN_LIFETIME || '7d';

// --- Helpers: Generate tokens ---
const createAccessToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME });
const createRefreshToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_LIFETIME });

// Cookie options for refresh token (httpOnly, secure in prod)
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // default 7 days in ms (can be tuned)
};

// --- 1. REGISTRATION Route ---
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // The password will be hashed automatically by the UserSchema pre-save hook
        const user = await User.create({ email, password });
        
        // Create access + refresh tokens
        const accessToken = createAccessToken(user._id);
        const refreshToken = createRefreshToken(user._id);

        // Persist refresh token
        user.refreshTokens = user.refreshTokens || [];
        user.refreshTokens.push(refreshToken);
        await user.save();

        // Set httpOnly refresh cookie
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(201).json({ 
            message: 'User successfully registered.',
            user: { id: user._id, email: user.email },
            accessToken,
            // Provide legacy `token` key for clients/tests that expect `token`
            token: accessToken
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

    // Credentials are valid, create access + refresh tokens
    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

        // Persist refresh token and update lastLogin timestamp
        try {
            user.lastLogin = new Date();
            user.refreshTokens = user.refreshTokens || [];
            user.refreshTokens.push(refreshToken);
            await user.save();
        } catch (err) {
            console.error('Failed to update lastLogin:', err.message);
            // Not fatal — we still return a successful login
        }

        // Set httpOnly refresh cookie
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(200).json({
            message: 'Login successful.',
            user: { id: user._id, email: user.email },
            accessToken,
            // Provide legacy `token` key for clients/tests that expect `token`
            token: accessToken
        });

    } catch (error) {
        res.status(500).json({ message: 'Login failed.', error: error.message });
    }
});

module.exports = router;

// --- 3. REFRESH Endpoint ---
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token provided.' });

    try {
        const payload = jwt.verify(refreshToken, JWT_SECRET);
        const userId = payload.id;
        const user = await User.findById(userId);
        if (!user) return res.status(401).json({ message: 'Invalid refresh token.' });

        // Check that the refresh token exists in the persisted list
        if (!user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
            return res.status(401).json({ message: 'Refresh token not recognized.' });
        }

        // Optionally rotate refresh token: create new refresh token and replace
        const newRefreshToken = createRefreshToken(userId);
        user.refreshTokens = (user.refreshTokens || []).filter(t => t !== refreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        // Set new cookie and issue new access token
        res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, REFRESH_COOKIE_OPTIONS);
        const accessToken = createAccessToken(userId);
        return res.status(200).json({ accessToken });
    } catch (err) {
        console.error('Refresh token error:', err && err.message ? err.message : err);
        return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }
});

// --- 4. LOGOUT Endpoint ---
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
    if (refreshToken) {
        try {
            const payload = jwt.verify(refreshToken, JWT_SECRET);
            const user = await User.findById(payload.id);
            if (user && user.refreshTokens) {
                user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
                await user.save();
            }
        } catch (err) {
            // ignore — we'll still clear cookie
        }
    }
    res.clearCookie(REFRESH_COOKIE_NAME);
    return res.status(200).json({ message: 'Logged out.' });
});