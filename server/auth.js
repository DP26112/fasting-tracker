// backend/auth.js

const jwt = require('jsonwebtoken');

// Middleware function to check for a valid JWT token
const auth = (req, res, next) => {
    // 1. Check for token in the HTTP-only cookie
    const token = req.cookies.token;

    // 2. If no token is found, unauthorized access
    if (!token) {
        // Use 401 Unauthorized for client to know they need to log in
        return res.status(401).json({ message: 'No token, authorization denied. Please log in.' });
    }

    try {
        // 3. Verify the token using the JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach the decoded user payload to the request object
        // The payload is structured as: { user: { id: '...' } }
        req.user = decoded.user;
        
        // 5. Proceed to the next middleware or route handler
        next();
    } catch (err) {
        // If token is invalid (e.g., expired, modified, or wrong signature)
        console.error('JWT Verification Error:', err.message);
        // Clear the bad cookie to force re-login
        res.clearCookie('token'); 
        return res.status(401).json({ message: 'Token is not valid or has expired. Please log in again.' });
    }
};

module.exports = auth;