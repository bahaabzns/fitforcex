// Blocks access to endpoints that are exclusively for workspace owners.
// Must be used after authMiddleware (relies on req.user.isOwner).

function requireOwner(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!req.user.isOwner) {
        return res.status(403).json({ message: 'Only the workspace owner can perform this action' });
    }

    next();
}

module.exports = requireOwner;
