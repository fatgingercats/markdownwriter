const https = require('https');
const fs = require('fs');

const url = "https://github.com/yarnpkg/yarn/releases/download/v1.22.19/yarn-1.22.19.js";
const file = fs.createWriteStream("yarn.js");

console.log(`Downloading ${url}...`);

https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirecting to ${response.headers.location}`);
        https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("Download completed.");
            });
        });
    } else {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log("Download completed.");
        });
    }
}).on('error', (err) => {
    fs.unlink("yarn.js", () => { }); // Delete the file async
    console.error(`Error: ${err.message}`);
});
