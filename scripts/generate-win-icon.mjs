import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const pngPath = path.join(root, 'build', 'icon.png');
const icoPath = path.join(root, 'build', 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error(`Missing PNG icon: ${pngPath}`);
  process.exit(1);
}

// Generate a multi-resolution .ico from the source PNG.
const buf = await pngToIco(pngPath);
fs.writeFileSync(icoPath, buf);
console.log(`Generated: ${icoPath}`);