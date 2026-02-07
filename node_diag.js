console.log('Starting Node.js Diagnostic');
try {
    const fs = require('fs');
    console.log('SUCCESS: fs module loaded');
    const path = require('path');
    console.log('SUCCESS: path module loaded');
} catch (error) {
    console.error('CRITICAL FAILURE:', error);
}
