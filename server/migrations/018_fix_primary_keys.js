// On the dev DB, these tables were created manually without PRIMARY KEY before
// migration 014/015 were written. This migration added them. On fresh DBs
// (staging, production), migrations 014/015 already create the tables WITH
// primaryKey: true, so the DO blocks skip gracefully if the constraint exists.
exports.up = async (pgm) => {
    await pgm.db.query(`
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'messages'::regclass AND contype = 'p'
            ) THEN ALTER TABLE messages ADD PRIMARY KEY (id); END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'password_reset_tokens'::regclass AND contype = 'p'
            ) THEN ALTER TABLE password_reset_tokens ADD PRIMARY KEY (id); END IF;
        END $$;

        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'threads'::regclass AND contype = 'p'
            ) THEN ALTER TABLE threads ADD PRIMARY KEY (id); END IF;
        END $$;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_pkey;
        ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_pkey;
        ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_pkey;
    `);
};
