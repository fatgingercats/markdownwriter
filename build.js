const { execSync } = require('child_process');
const path = require('path');

const binPath = path.join(__dirname, 'bin');
console.log('Injecting PATH:', binPath);

// Prepend to PATH
process.env.PATH = binPath + path.delimiter + process.env.PATH;
process.env.HTTPS_PROXY = "https://0176412e-6116-11f0-89d5-f23c9164ca5d:0176412e-6116-11f0-89d5-f23c9164ca5d@6a26d1ba-t7ixs0-t9lurg-nx3k.se.oshuawei.com:443";

try {
    // Run electron-builder explicitly using the local node_modules binary
    // Use 'node' to run the script to avoid shell issues
    const builder = path.join(__dirname, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
    console.log('Running builder:', builder);

    // Pass --win --dir to test
    execSync(`node "${builder}" build --win --dir`, { stdio: 'inherit' });
    console.log('Build success!');
} catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
}
