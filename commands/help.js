// !help: un solo mensaje con todos los comandos por categoría. Lo ven todos (admins incluidos).
// El contenido está en lib/helpdata.js.
const categories = require('../lib/helpdata');
const { prefixes } = require('../config');

// Nombres de una entrada que existen de verdad en el bot
function shownNames(names, registry) {
    const out = [];
    for (const n of names) {
        const cmd = registry.get(n);
        if (!cmd) continue;
        out.push({ name: n, cmd });
        if (out.length === 2) break; // máximo ES / EN en el menú
    }
    return out;
}

function build(registry) {
    const p = prefixes[0]; // el bot cambia "!" por el prefijo del grupo al enviar
    const lines = ['📖 *Menú de comandos*', `Prefijo: *${p}*  ·  🛡️ = solo admins`];

    for (const cat of categories) {
        const rows = [];
        for (const [names, args, desc] of cat.items) {
            const shown = shownNames(names, registry);
            if (!shown.length) continue; // comando que aún no existe: no se muestra
            const label = shown.map((s) => p + s.name).join(' / ');
            const admin = shown[0].cmd.adminOnly ? ' 🛡️' : '';
            rows.push(`• *${label}*${args ? ' ' + args : ''}${admin}\n  → ${desc}`);
        }
        if (rows.length) lines.push('', `*${cat.title}*`, ...rows);
    }

    return lines.join('\n');
}

// Avisa en consola si hay comandos que no salen en el menú
function checkCoverage(registry = require('./index')) {
    const listed = new Set();
    for (const cat of categories) for (const [names] of cat.items) for (const n of names) if (registry.has(n)) listed.add(registry.get(n));
    const missing = [...new Set(registry.values())].filter((c) => !listed.has(c)).map((c) => c.name);
    if (missing.length) {
        console.warn(`⚠️ Estos comandos no aparecen en el !help (agrégalos en lib/helpdata.js): ${missing.join(', ')}`);
    }
    return missing;
}

module.exports = {
    name: 'help',
    aliases: ['ayuda', 'menu', 'comandos'],
    async run({ msg, chat }) {
        const text = build(require('./index'));
        // Mensaje normal al chat (en privado también funciona)
        return chat.sendMessage(text);
    },
    build,
    checkCoverage
};
