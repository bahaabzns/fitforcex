const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        // Convenience aliases used throughout route handlers
        req.user.userId      = decoded.userId;
        req.user.workspaceId = decoded.workspaceId;
        req.user.isOwner     = decoded.role === 'owner';
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}

module.exports = authMiddleware;
