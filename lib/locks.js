// Ajustes bloqueados por el dueño del bot: lo que el dueño configura, los demás admins no lo pueden cambiar
// (hasta que el dueño lo libere con !liberar). Lo que cambia un admin normal NO se bloquea.
// Se guarda por grupo en settings.locks = { clave: true }.
const { normalizeName } = require('./utils');

const LABELS = {
    bot: 'Encender/apagar el bot',
    onlyadmin: 'Modo solo admins',
    antilink: 'Antilink',
    welcome: 'Bienvenida activada/desactivada',
    goodbye: 'Despedida activada/desactivada',
    economy: 'Economía',
    gacha: 'Sistema gacha',
    setprefix: 'Prefijo de comandos',
    setwelcome: 'Texto de bienvenida',
    setgoodbye: 'Texto de despedida',
    setbanner: 'Banner',
    setwarnlimit: 'Límite de warns',
    setinactividad: 'Expulsión por inactividad',
    setcoins: 'Nombre de la moneda'
};

function label(key, settings) {
    if (key.startsWith('cmd:')) {
        const name = key.slice(4);
        const off = settings && (settings.disabledCommands || []).includes(name);
        return `Comando !${name} (${off ? 'desactivado' : 'activado'})`;
    }
    return LABELS[key] || key;
}

const isLocked = (settings, key) => !!(settings && settings.locks && settings.locks[key]);

// Copia de los ajustes (sin los bloqueos) para saber si un comando cambió algo
const snapshot = (settings) => JSON.stringify({ ...settings, locks: undefined, ownerMutes: undefined });

// Convierte lo que escribió el dueño (clave o nombre de comando) en una clave de bloqueo existente
function resolveKey(settings, input) {
    const raw = String(input || '').toLowerCase().replace(/^[^\w]+/, '');
    const norm = normalizeName(raw);
    const locks = (settings && settings.locks) || {};
    if (locks[raw]) return raw;
    if (locks[norm]) return norm;
    const cmds = require('../commands');
    const cmd = cmds.get(norm.replace(/^cmd:/, ''));
    if (cmd && locks[`cmd:${cmd.name}`]) return `cmd:${cmd.name}`;
    // un nombre en español/inglés de un ajuste (ej: "antienlace" -> antilink)
    if (cmd && locks[cmd.name]) return cmd.name;
    return null;
}

module.exports = { label, isLocked, snapshot, resolveKey };
