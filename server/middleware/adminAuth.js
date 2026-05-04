const jwt = require('jsonwebtoken');

function adminAuthMiddleware(req, res, next) {
    const token = req.cookies.admin_token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (!decoded.isAdmin) {
            throw new Error('Not an admin token');
        }
        req.admin = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid admin token' });
    }
}

module.exports = adminAuthMiddleware;
