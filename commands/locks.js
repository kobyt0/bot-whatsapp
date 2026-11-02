// Solo dueños: ver y liberar los ajustes que el dueño bloqueó en este grupo.
const db = require('../lib/db');
const L = require('../lib/locks');
const { prefixes } = require('../config');
const p = prefixes[0];

const locks = {
    name: 'locks',
    ownerOnly: true,
    groupOnly: true,
    async run({ msg, settings }) {
        const keys = Object.keys(settings.locks);
        if (!keys.length) return msg.reply('🔓 No hay ajustes bloqueados en este grupo.');
        const lines = keys.map((k) => `• \`${k}\` — ${L.label(k, settings)}`);
        return msg.reply(
            `🔒 *Ajustes bloqueados por el dueño* (${keys.length})\n\n${lines.join('\n')}\n\n` +
                `Para liberar uno: ${p}liberar <clave>\nPara liberarlos todos: ${p}liberar all`
        );
    }
};

const unlock = {
    name: 'unlock',
    ownerOnly: true,
    groupOnly: true,
    async run({ msg, args, settings }) {
        const arg = (args[0] || '').toLowerCase();
        if (!arg) return msg.reply(`Uso: ${p}liberar <clave> (o *all*)\nVer lo bloqueado: ${p}bloqueos`);

        if (['all', 'todo', 'todos'].includes(arg)) {
            const n = Object.keys(settings.locks).length;
            settings.locks = {};
            db.save();
            return msg.reply(n ? `🔓 Liberé ${n} ajuste(s): los admins ya pueden cambiarlos.` : '🔓 No había nada bloqueado.');
        }

        const key = L.resolveKey(settings, arg);
        if (!key) return msg.reply(`Ese ajuste no está bloqueado. Mira la lista con ${p}bloqueos`);

        const name = L.label(key, settings);
        delete settings.locks[key];
        db.save();
        return msg.reply(`🔓 *${name}* liberado: los admins ya pueden cambiarlo.`);
    }
};

module.exports = [locks, unlock];
