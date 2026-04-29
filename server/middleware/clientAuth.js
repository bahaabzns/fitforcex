const jwt = require('jsonwebtoken');

function clientAuthMiddleware(req, res, next) {
    const token = req.cookies.client_token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.client = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
}

module.exports = clientAuthMiddleware;
