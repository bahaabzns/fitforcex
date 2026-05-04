const requirePermission = require('../middleware/requirePermission');

function makeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

describe('requirePermission', () => {
    it('passes if user is owner (isOwner=true)', () => {
        const middleware = requirePermission('nutrition', 'write');
        const req = { user: { isOwner: true } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('passes if user has the exact permission', () => {
        const middleware = requirePermission('clients', 'read');
        const req = {
            user: {
                isOwner: false,
                permissions: { clients: { read: true, write: false, delete: false } },
            },
        };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('returns 403 if user lacks the permission', () => {
        const middleware = requirePermission('finance', 'read');
        const req = {
            user: {
                isOwner: false,
                permissions: { finance: { read: false, write: false, delete: false } },
            },
        };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 if permissions object is missing the module', () => {
        const middleware = requirePermission('databases', 'write');
        const req = { user: { isOwner: false, permissions: {} } };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 401 if req.user is missing', () => {
        const middleware = requirePermission('clients', 'read');
        const req = {};
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('defaults action to read when not specified', () => {
        const middleware = requirePermission('training');
        const req = {
            user: {
                isOwner: false,
                permissions: { training: { read: true, write: false, delete: false } },
            },
        };
        const res = makeRes();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
