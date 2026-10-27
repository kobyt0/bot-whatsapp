const config = require('./../config');
const registry = require('./aliases');
const { CATEGORIES, INFO } = require('./helpdata');
const eco = require('./economy');
const { formatWait } = require('./utils');

const MAX_LEN = 30000; // si el menú llegara a pasar de esto, se parte por categorías

function every(ms) {
    return ms >= 3600e3 ? `cada ${Math.round(ms / 3600e3)} h` : `cada ${Math.round(ms / 60e3)} min`;
}

// Nombres alternativos de un comando (atajos), sin repetir su nombre en español ni en inglés
function shortcuts(cmd) {
    const reg = registry[cmd.name];
    const shown = new Set([reg.es, reg.en]);
    return [...new Set([cmd.name, ...(cmd.aliases || []), ...(reg.extra || [])])].filter((n) => !shown.has(n));
}

const pretty = (n) => (n === 'cumpleanos' ? 'cumpleaños' : n === 'todoscumpleanos' ? 'todoscumpleaños' : n);

// commands: mapa nombre -> comando (commands/index.js). settings: ajustes del grupo (o null en privado).
function buildHelp(commands, settings) {
    const s = settings || {};
    const p = s.prefix || config.prefixes[0];
    const coins = eco.coinName(s);
    const disabled = new Set(s.disabledCommands || []);
    const offCategory = { economia: s.economy === false, casino: s.economy === false, gacha: s.gacha === false };
    const ctx = { coins, every, fmt: eco.fmt, cfg: config, formatWait };

    const byName = new Map();
    for (const c of new Set(commands.values())) byName.set(c.name, c);

    const sections = CATEGORIES.map((cat) => {
        const lines = [`━━━ ${cat.icon} *${cat.title}* ━━━${offCategory[cat.id] ? ' · 💤 desactivado en este grupo' : ''}`];
        for (const key of cat.keys) {
            const cmd = byName.get(key);
            const info = INFO[key];
            if (!cmd || !info) continue;
            const reg = registry[key];
            const flags = `${cmd.adminOnly ? ' 👑' : ''}${cmd.botAdmin ? ' 🤖' : ''}${disabled.has(key) ? ' 🚫' : ''}`;

            const names = reg.es === reg.en ? `*${p}${pretty(reg.es)}*` : `*${p}${pretty(reg.es)}* | ${p}${reg.en}`;
            const extra = shortcuts(cmd);
            const alias = extra.length ? ` (${extra.map((n) => p + pretty(n)).join(' ')})` : '';
            const args = info.args ? ` ${info.args}` : '';
            const desc = typeof info.desc === 'function' ? info.desc(ctx) : info.desc;

            lines.push(`• ${names}${args}${alias}${flags}`, `   → ${desc}`);
        }
        return lines.join('\n');
    });

    const intro =
        `🤖 *MENÚ DE COMANDOS*\n\n` +
        `Prefijo de este grupo: *${p}*${s.prefix ? '' : ' (o /)'}\n` +
        `Cada comando funciona en español *y* en inglés: *${p}perfil* = ${p}profile\n\n` +
        `👑 solo admins · 🤖 el bot debe ser admin · 🚫 desactivado en este grupo\n` +
        `Los acentos y las mayúsculas no importan.`;

    return { intro, sections };
}

// Reparte las categorías en mensajes que no pasen de MAX_LEN (normalmente sale uno solo)
function pack(sections, max = MAX_LEN) {
    const out = [];
    let cur = '';
    for (const sec of sections) {
        if (cur && cur.length + sec.length + 2 > max) {
            out.push(cur);
            cur = '';
        }
        cur += (cur ? '\n\n' : '') + sec;
    }
    if (cur) out.push(cur);
    return out;
}

module.exports = { buildHelp, pack, MAX_LEN };
