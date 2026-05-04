// Middleware factory: requirePermission(module, action)
// Passes if the request user is a workspace owner (all permissions) or has the specified permission.
// Must be used after authMiddleware (relies on req.user.isOwner and req.user.permissions).

function requirePermission(module, action = 'read') {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (user.isOwner) {
            return next();
        }

        const allowed = user.permissions?.[module]?.[action] === true;
        if (!allowed) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        next();
    };
}

module.exports = requirePermission;
