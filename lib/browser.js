const fs = require('fs');
const path = require('path');

// Busca Google Chrome. Hace falta para enviar videos como video:
// el Chromium que trae Puppeteer no incluye los códecs necesarios.
function findChrome(custom) {
    if (custom && fs.existsSync(custom)) return custom;

    const env = process.env;
    let candidates;
    if (process.platform === 'win32') {
        candidates = [
            path.join(env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ];
    } else if (process.platform === 'darwin') {
        candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    } else {
        candidates = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'];
    }

    return candidates.find((p) => p && fs.existsSync(p)) || null;
}

module.exports = { findChrome };
