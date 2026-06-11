exports.up = (pgm) => {
    pgm.addColumns('users', {
        email_verified: {
            type: 'boolean',
            notNull: true,
            default: false,
        },
        email_verification_code: {
            type: 'text',
            default: null,
        },
        verification_code_expires_at: {
            type: 'timestamptz',
            default: null,
        },
    });

    // Existing users are already active — mark them verified so they are not locked out
    pgm.sql(`UPDATE users SET email_verified = TRUE`);
};

exports.down = (pgm) => {
    pgm.dropColumns('users', [
        'email_verified',
        'email_verification_code',
        'verification_code_expires_at',
    ]);
};
