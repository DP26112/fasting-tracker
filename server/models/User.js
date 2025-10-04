// server/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Requires 'npm install bcrypt' or 'npm install bcryptjs'

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false, // <-- CRITICAL: Prevents password from being returned in standard queries
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // Track last login time to support cleanup of stale active timers
    lastLogin: {
        type: Date,
        default: null,
    },
});

// Middleware to hash the password before saving (Runs only if password is new or modified)
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Instance method to compare passwords during login (Fixes the function call)
UserSchema.methods.comparePassword = async function (candidatePassword) {
    // Uses the password retrieved by .select('+password') in the route
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;