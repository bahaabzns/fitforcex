const jwt = require('jsonwebtoken');



function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        res.status(401).json({message: 'Not authenticated'});
        return;
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({message: 'Invalid token'});
    }

}

module.exports = authMiddleware;