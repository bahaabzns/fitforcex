require('dotenv').config();
const pool = require('./db');

async function fixEmailConstraint() { 
    
    try {
        console.log('Fixing clients email constraint...');
        
        // Drop the old global unique constraint on email
        await pool.query(`
            ALTER TABLE clients
            DROP CONSTRAINT IF EXISTS clients_email_key
        `);
        console.log('✓ Dropped old global email constraint');
        
        // Add new composite unique constraint on (coach_id, email)
        await pool.query(`
            ALTER TABLE clients
            ADD CONSTRAINT clients_coach_id_email_key UNIQUE (coach_id, email)
        `);
        console.log('✓ Added new coach-scoped email constraint');
        
        console.log('Done! Emails are now unique per coach.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

fixEmailConstraint();
