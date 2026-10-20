// Mención oculta: los participantes van solo en "mentions", sin @numero en el texto.
const { neutralize } = require('../lib/utils');

module.exports = {
    name: 'todos',
    aliases: ['tagall', 'tag'],
    adminOnly: true, // cámbialo a false si quieres que cualquiera lo use
    groupOnly: true,
    async run({ chat, rest }) {
        const header = neutralize(rest !== '' ? rest : '📢 *Atención a todos*');
        const mentions = chat.participants.map((p) => p.id._serialized);
        await chat.sendMessage(header, { mentions });
    }
};
