const db = require('../lib/db');
const { parseOnOff } = require('../lib/utils');
const { prefixes } = require('../config');
const p = prefixes[0];

// Estos no se pueden apagar: te dejarían sin control del bot
const PROTECTED = ['comando', 'bot'];

module.exports = {
    name: 'comando',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, args, settings }) {
        const commands = require('./index'); // se carga aquí para evitar la referencia circular

        if (!args.length) {
            const off = settings.disabledCommands;
            return msg.reply(
                `Comandos desactivados: ${off.length ? off.map((c) => p + c).join(', ') : 'ninguno'}\n` +
                    `Uso: ${p}comando <comando> on|off\nEjemplo: ${p}comando sticker off`
            );
        }

        const rawName = args[0].toLowerCase().replace(new RegExp('^[' + prefixes.map((x) => '\\' + x).join('') + ']'), '');
        const target = commands.get(rawName);
        if (!target) return msg.reply(`No existe el comando *${rawName}*.`);

        if (PROTECTED.includes(target.name)) {
            return msg.reply(`⛔ El comando ${p}${target.name} no se puede desactivar.`);
        }

        const value = parseOnOff(args[1]);
        const isOff = settings.disabledCommands.includes(target.name);
        if (value === null) {
            return msg.reply(`${p}${target.name}: *${isOff ? 'DESACTIVADO' : 'ACTIVADO'}*\nUso: ${p}comando ${target.name} on|off`);
        }

        if (value) settings.disabledCommands = settings.disabledCommands.filter((c) => c !== target.name);
        else if (!isOff) settings.disabledCommands.push(target.name);
        db.save();

        return msg.reply(`✅ ${p}${target.name}: *${value ? 'ACTIVADO' : 'DESACTIVADO'}* en este grupo.`);
    }
};
