const db = require('../lib/db');
const { isValidPrefix } = require('../lib/prefix');
const { prefixes } = require('../config');

module.exports = {
    name: 'setprefix',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, args, settings }) {
        const arg = args[0];
        const current = settings.prefix || prefixes.join(' o ');

        if (!arg) {
            return msg.reply(`Prefijo actual de este grupo: *${current}*\nUso: !setprefix <nuevo prefijo> (por ejemplo #)`);
        }

        if (['reset', 'default'].includes(arg.toLowerCase())) {
            settings.prefix = null;
            db.save();
            return msg.reply(`✅ Prefijo restablecido: ahora se usa *${prefixes.join(' o ')}*`);
        }

        if (!isValidPrefix(arg)) {
            return msg.reply('El prefijo debe tener 1 o 2 símbolos (por ejemplo # . $ ?), sin letras, números ni espacios.');
        }

        settings.prefix = arg;
        db.save();
        // La salida de emergencia se escribe sin "!" pegado a un comando para que no se traduzca al prefijo nuevo
        return msg.reply(
            `✅ Prefijo de este grupo cambiado a *${arg}*\n` +
                `Ahora los comandos son, por ejemplo, ${arg}sticker o ${arg}saldo.\n` +
                'Si lo olvidas, escribe el prefijo original (! o /) seguido de *setprefix reset*.'
        );
    }
};
