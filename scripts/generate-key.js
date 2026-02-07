/**
 * Key Generator script for MDWriter
 * Usage: node generate-key.js <MACHINE_ID>
 */
const crypto = require('crypto');

const SECRET = 'ANTIGRAVITY_MD_SECRET_2025';

function generateActivationCode(mid) {
    const hash = crypto.createHmac('sha256', SECRET)
        .update(mid)
        .digest('hex');
    const code = hash.substring(0, 16).toUpperCase();
    return code.match(/.{4}/g)?.join('-') || code;
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node generate-key.js <MACHINE_ID>');
} else {
    const mid = args[0];
    const key = generateActivationCode(mid);
    console.log('------------------------------------');
    console.log(`Machine ID:      ${mid}`);
    console.log(`Activation Code: ${key}`);
    console.log('------------------------------------');
}
