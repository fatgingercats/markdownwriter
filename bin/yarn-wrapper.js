const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const yarnPath = path.join(__dirname, 'yarn-core.js');
const args = process.argv.slice(2);

const logPath = path.join(__dirname, 'wrapper_debug.log');
fs.appendFileSync(logPath, `ARGS: ${JSON.stringify(args)}\n`);

const child = spawn('node', [yarnPath, ...args], { stdio: ['inherit', 'pipe', 'inherit'], shell: false });

let output = '';

child.stdout.on('data', (data) => {
    output += data.toString();
});

child.on('close', (code) => {
    fs.appendFileSync(logPath, `RAW OUTPUT LENGTH: ${output.length}\n`);
    fs.appendFileSync(logPath, `RAW OUTPUT START: ${output.substring(0, 100)}\n`);

    if (args.includes('--json')) {
        const lines = output.split(/(\r\n|\n|\r)/);
        let jsonOutput = '';
        for (const line of lines) {
            if (line.trim().startsWith('{')) {
                jsonOutput += line;
            }
        }
        fs.appendFileSync(logPath, `FILTERED OUTPUT LENGTH: ${jsonOutput.length}\n`);
        process.stdout.write(jsonOutput);
    } else {
        process.stdout.write(output);
    }
    process.exit(code);
});
