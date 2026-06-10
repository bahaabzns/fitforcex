exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE messages ADD PRIMARY KEY (id);
        ALTER TABLE password_reset_tokens ADD PRIMARY KEY (id);
        ALTER TABLE threads ADD PRIMARY KEY (id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE messages DROP CONSTRAINT messages_pkey;
        ALTER TABLE password_reset_tokens DROP CONSTRAINT password_reset_tokens_pkey;
        ALTER TABLE threads DROP CONSTRAINT threads_pkey;
    `);
};
