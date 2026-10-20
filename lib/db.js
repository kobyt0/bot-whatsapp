const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'groups.json');

// Ajustes por defecto de cada grupo. En fases futuras solo hay que añadir
// aquí las nuevas claves (economy, gacha, nsfw...).
const DEFAULTS = {
    botEnabled: true,
    onlyAdmin: false,
    antilink: false,
    welcome: false,
    goodbye: false,
    economy: true,
    prefix: null,   // prefijo propio del grupo (null = el de config.js)
    coinName: null  // nombre de la moneda (null = "coins")
};

let data = {};

function load() {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        if (fs.existsSync(FILE)) {
            data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        }
    } catch (err) {
        console.error('No pude leer groups.json, empiezo vacío:', err.message);
        data = {};
    }
}

function save() {
    try {
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, FILE);
    } catch (err) {
        console.error('No pude guardar groups.json:', err.message);
    }
}

function getGroup(groupId) {
    if (!data[groupId]) data[groupId] = {};
    const group = data[groupId];
    for (const key of Object.keys(DEFAULTS)) {
        if (group[key] === undefined) group[key] = DEFAULTS[key];
    }
    if (!group.mutes) group.mutes = {}; // { userId: timestampDeExpiración }
    if (!group.disabledCommands) group.disabledCommands = []; // nombres de comandos apagados con !comando
    // group.welcomeText, group.goodbyeText y group.bannerFile se crean al personalizarlos
    return group;
}

load();

module.exports = { getGroup, save };
