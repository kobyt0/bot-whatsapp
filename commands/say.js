const { neutralize } = require('../lib/utils');
const { prefixes } = require('../config');

module.exports = {
    name: 'say',
    async run(ctx) {
        const { msg, chat, rest } = ctx;

        let text = rest;
        if (!text && msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            text = quoted.body || '';
        }
        if (!text) return msg.reply(`Uso: ${prefixes[0]}say <mensaje> (o responde a un mensaje)`);
        if (text.length > 1000) return msg.reply('El mensaje es demasiado largo (máximo 1000 caracteres).');

        // Sin "mentions": los @ del texto no notifican a nadie.
        // El mensaje de quien usa el comando no se toca.
        await chat.sendMessage(neutralize(text));
    }
};
