const db = require('../lib/db');
const eco = require('../lib/economy');
const I = require('../lib/inactivity');
const { isBotAdmin } = require('../lib/identity');
const { prefixes, inactivity: cfg } = require('../config');
const p = prefixes[0];

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const windowFor = (args, settings) =>
    I.clampDays(args.find((a) => /^\d+$/.test(a)), settings.inactivityDays || cfg.defaultWindowDays);

function trackingNote(settings, days) {
    if (!settings.trackedSince) return '';
    const note = `📅 Contando mensajes desde el ${dateStr(settings.trackedSince)}`;
    return Date.now() - settings.trackedSince < days * I.DAY ? `${note} (menos de ${days} días de datos)` : note;
}

const autoLine = (settings) =>
    settings.inactivityDays
        ? `🤖 Expulsión automática: *activada* (${settings.inactivityDays} días)`
        : `🤖 Expulsión automática: *desactivada* (actívala con ${p}setinactividad <días>)`;

// ---------- !activos ----------
const activos = {
    name: 'activos',
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, args, settings } = ctx;
        const days = windowFor(args, settings);
        const members = await I.classify(client, chat, settings, days);

        const active = members.filter((m) => m.status === 'active').sort((a, b) => b.count - a.count || b.last - a.last);
        if (!active.length) {
            return msg.reply(`😴 Nadie ha escrito en los últimos ${days} día(s).\n${trackingNote(settings, days)}`.trim());
        }

        const shown = active.slice(0, cfg.topLimit);
        const names = await Promise.all(shown.map((m) => eco.nameOf(client, m.id)));
        const lines = shown.map((m, i) => `${i + 1}. ${names[i]} — ${m.count} mensaje${m.count === 1 ? '' : 's'}`);
        const more = active.length - shown.length;

        return msg.reply(
            `📈 *Miembros activos* (últimos ${days} día${days === 1 ? '' : 's'})\n` +
                `${active.length} de ${members.length} miembros han escrito\n\n${lines.join('\n')}` +
                `${more > 0 ? `\n…y ${more} más.` : ''}\n\n${trackingNote(settings, days)}`.trimEnd()
        );
    }
};

// ---------- !inactivos ----------
const inactivos = {
    name: 'inactivos',
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, args, settings } = ctx;
        const days = windowFor(args, settings);
        const now = Date.now();
        const members = await I.classify(client, chat, settings, days, now);

        const inactive = members.filter((m) => m.status === 'inactive').sort((a, b) => a.ref - b.ref);
        const unknown = members.filter((m) => m.status === 'unknown').length;

        const head = `😴 *Miembros inactivos* (sin mensajes en ${days} día${days === 1 ? '' : 's'})`;
        const foot = [
            unknown ? `ℹ️ ${unknown} miembro(s) aún no tienen datos suficientes (el seguimiento o su llegada es reciente).` : '',
            trackingNote(settings, days),
            autoLine(settings)
        ].filter(Boolean).join('\n');

        if (!inactive.length) return msg.reply(`✅ ${head}\n\nNadie está inactivo.\n\n${foot}`);

        const shown = inactive.slice(0, cfg.listLimit);
        const names = await Promise.all(shown.map((m) => eco.nameOf(client, m.id)));
        const lines = shown.map((m, i) => {
            const when = m.last ? `último mensaje hace ${I.ago(now - m.last)}` : `sin mensajes desde que empezó el seguimiento (hace ${I.ago(now - m.ref)})`;
            return `• ${m.isAdmin ? '👑 ' : ''}${names[i]} — ${when}`;
        });
        const more = inactive.length - shown.length;

        return msg.reply(`${head}\n${inactive.length} de ${members.length} miembros\n\n${lines.join('\n')}${more > 0 ? `\n…y ${more} más.` : ''}\n\n${foot}`);
    }
};

// ---------- !setinactividad ----------
const setinactividad = {
    name: 'setinactividad',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, args, settings } = ctx;
        const arg = (args[0] || '').toLowerCase();

        if (!arg) {
            return msg.reply(
                `${autoLine(settings)}\n` +
                    `Uso: ${p}setinactividad <días de 1 a ${cfg.maxDays} | off>\nEjemplo: ${p}setinactividad 7\n` +
                    `Para solo ver quién está inactivo: ${p}inactivos`
            );
        }

        if (['off', 'no', 'desactivar', 'desactivado', 'apagar'].includes(arg)) {
            settings.inactivityDays = null;
            settings.inactivityEnabledAt = null;
            db.save();
            return msg.reply('✅ Expulsión por inactividad *desactivada*.');
        }

        const n = /^\d+$/.test(arg) ? parseInt(arg, 10) : 0;
        if (n < 1 || n > cfg.maxDays) {
            return msg.reply(`Los días deben ser un número de 1 a ${cfg.maxDays}, o *off*.\nEjemplo: ${p}setinactividad 7`);
        }

        settings.inactivityDays = n;
        settings.inactivityEnabledAt = Date.now();
        if (!settings.trackedSince) settings.trackedSince = Date.now();
        db.save();

        let text =
            `✅ Expulsión por inactividad *activada*: quien pase *${n} día${n === 1 ? '' : 's'}* sin enviar mensajes será expulsado automáticamente.\n\n` +
            `• El plazo cuenta desde su último mensaje, desde que entró, o desde ahora (lo más reciente): nadie es expulsado al instante.\n` +
            `• Los admins nunca se expulsan.\n` +
            `• Se revisa cada hora y como máximo se expulsan ${cfg.maxPerSweep} personas por revisión.\n` +
            `• Mira quién está en riesgo con ${p}inactivos`;
        if (!(await isBotAdmin(client, chat))) text += '\n\n⚠️ Ahora mismo no soy admin del grupo, así que no podré expulsar.';
        return msg.reply(text);
    }
};

module.exports = [activos, inactivos, setinactividad];
