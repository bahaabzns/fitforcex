const requireOwner = require('../middleware/requireOwner');

function makeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

describe('requireOwner', () => {
    it('passes if user is owner', () => {
        const req = { user: { isOwner: true } };
        const res = makeRes();
        const next = jest.fn();

        requireOwner(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 if user is not owner', () => {
        const req = { user: { isOwner: false } };
        const res = makeRes();
        const next = jest.fn();

        requireOwner(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 401 if req.user is missing', () => {
        const req = {};
        const res = makeRes();
        const next = jest.fn();

        requireOwner(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
