const db = require('../lib/db');
const { DEFAULT_WELCOME, DEFAULT_GOODBYE } = require('../lib/welcome');
const { prefixes } = require('../config');
const p = prefixes[0];

function makeSetter({ name, key, toggle, def, label }) {
    return {
        name,
        adminOnly: true,
        groupOnly: true,
        async run({ msg, rest, settings }) {
            if (!rest) {
                return msg.reply(
                    `${label} actual:\n\n${settings[key] || def}\n\n` +
                        'Variables: {user} (quién), {group} (nombre del grupo), {count} (miembros)\n' +
                        `Cambiar: ${p}${name} <texto>\nRestablecer: ${p}${name} reset`
                );
            }

            if (rest.toLowerCase() === 'reset') {
                settings[key] = null;
                db.save();
                return msg.reply(`✅ ${label} restablecido al texto por defecto.`);
            }

            if (rest.length > 3000) return msg.reply('El texto es demasiado largo (máximo 1000 caracteres).');

            settings[key] = rest;
            db.save();

            let text = `✅ ${label} actualizado.`;
            if (!settings[toggle]) text += `\n⚠️ Está desactivado: actívalo con ${p}${toggle} on`;
            return msg.reply(text);
        }
    };
}

module.exports = [
    makeSetter({ name: 'setwelcome', key: 'welcomeText', toggle: 'welcome', def: DEFAULT_WELCOME, label: 'Mensaje de bienvenida' }),
    makeSetter({ name: 'setgoodbye', key: 'goodbyeText', toggle: 'goodbye', def: DEFAULT_GOODBYE, label: 'Mensaje de despedida' })
];
