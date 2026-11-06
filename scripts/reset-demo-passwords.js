/**
 * Sets every seeded demo account password to Password1!
 * Run: node scripts/reset-demo-passwords.js
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

async function main() {
    const password = 'Password1!';
    const hashed = hashPassword(password);
    const [result] = await db.query(
        `UPDATE users
         SET password = ?
         WHERE email IN (
            'aarav@example.com','diya@example.com','ishaan@example.com',
            'meera@example.com','kabir@example.com','vikram@example.com',
            'ananya@example.com','rahul@example.com','priya@example.com',
            'arjun@example.com','admin@example.com','superadmin@example.com'
         )`,
        [hashed]
    );

    console.log(`Updated ${result.affectedRows} demo users. Password: ${password}`);
    await db.end();
}

main().catch(async error => {
    console.error(error);
    try { await db.end(); } catch (_) {}
    process.exit(1);
});
