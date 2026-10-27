// Carga automáticamente todos los archivos de esta carpeta.
// Cada archivo exporta un comando o un array de comandos:
// { name, aliases?, adminOnly?, groupOnly?, botAdmin?, run(ctx) }
// Además de su nombre y alias, cada comando responde a su versión en español y en inglés (lib/aliases.js).
const fs = require('fs');
const path = require('path');
const registry = require('../lib/aliases');
const { normalizeName } = require('../lib/utils');

const map = new Map();

function add(name, cmd) {
    const key = normalizeName(name);
    const prev = map.get(key);
    if (prev && prev !== cmd) {
        throw new Error(`Nombre de comando repetido: "${key}" (${prev.name} y ${cmd.name})`);
    }
    map.set(key, cmd);
}

for (const file of fs.readdirSync(__dirname)) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    const exported = require(path.join(__dirname, file));
    for (const cmd of [].concat(exported)) {
        const reg = registry[cmd.name];
        if (!reg) console.warn(`⚠️ El comando "${cmd.name}" no tiene su versión en español/inglés en lib/aliases.js`);

        const names = [cmd.name, ...(cmd.aliases || [])];
        if (reg) names.push(reg.es, reg.en, ...(reg.extra || []));
        for (const n of names) add(n, cmd);
    }
}

module.exports = map;
