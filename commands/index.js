// Carga automáticamente todos los archivos de esta carpeta.
// Cada archivo exporta un comando o un array de comandos:
// { name, aliases?, adminOnly?, groupOnly?, botAdmin?, run(ctx) }
const fs = require('fs');
const path = require('path');

const map = new Map();

for (const file of fs.readdirSync(__dirname)) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    const exported = require(path.join(__dirname, file));
    for (const cmd of [].concat(exported)) {
        for (const name of [cmd.name, ...(cmd.aliases || [])]) {
            map.set(name, cmd);
        }
    }
}

module.exports = map;
