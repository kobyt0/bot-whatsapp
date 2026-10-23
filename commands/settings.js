const db = require('../lib/db');
const { parseOnOff } = require('../lib/utils');
const { prefixes } = require('../config');

// Cada interruptor genera un comando "!nombre on|off".
// Para añadir más en fases futuras (economy, gacha, nsfw...), agrega una línea
// aquí y su valor por defecto en lib/db.js.
const TOGGLES = [
    { name: 'bot', key: 'botEnabled', label: 'Bot' },
    { name: 'onlyadmin', key: 'onlyAdmin', label: 'Solo admins' },
    { name: 'antilink', key: 'antilink', label: 'Antilink', needsBotAdmin: true },
    { name: 'welcome', key: 'welcome', label: 'Mensaje de bienvenida' },
    { name: 'goodbye', key: 'goodbye', label: 'Mensaje de despedida' },
    { name: 'economy', key: 'economy', label: 'Economía' },
    { name: 'gacha', key: 'gacha', label: 'Sistema gacha' }
];

module.exports = TOGGLES.map((t) => ({
    name: t.name,
    adminOnly: true,
    groupOnly: true,
    async run({ msg, args, settings, isBotAdmin }) {
        const value = parseOnOff(args[0]);

        if (value === null) {
            return msg.reply(
                `${t.label}: *${settings[t.key] ? 'ON' : 'OFF'}*\nUso: ${prefixes[0]}${t.name} on|off`
            );
        }

        settings[t.key] = value;
        db.save();

        let text = `✅ ${t.label}: *${value ? 'ON' : 'OFF'}*`;
        if (value && t.needsBotAdmin && !isBotAdmin) {
            text += '\n⚠️ Necesito ser admin del grupo para poder borrar mensajes.';
        }
        return msg.reply(text);
    }
}));
