// A coach-configured URL (payment link, booking page, WhatsApp, etc.) used by
// the client portal's "Renew Subscription" button on the expired-subscription
// screen. Optional -- the button stays disabled/inert until the coach sets one.
exports.up = (pgm) => {
    pgm.addColumns('workspaces', {
        renewal_link: { type: 'text' },
    }, { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropColumns('workspaces', ['renewal_link']);
};
