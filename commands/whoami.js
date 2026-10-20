const { aliasesOf, botExtra } = require('../lib/identity');

// Utilidad de depuración: muestra los IDs que ve el bot y los permisos detectados.
module.exports = {
    name: 'whoami',
    groupOnly: true,
    async run({ client, msg, chat, sender, senderExtra, isAdmin, isBotAdmin }) {
        const botId = client.info.wid._serialized;
        const mine = await aliasesOf(client, sender, senderExtra);
        const bot = await aliasesOf(client, botId, botExtra(client));
        const admins = (chat.participants || [])
            .filter((p) => p.isAdmin || p.isSuperAdmin)
            .map((p) => p.id._serialized);

        await msg.reply(
            [
                `Tu ID: ${sender}`,
                `Alias tuyos: ${[...mine].join(', ')}`,
                `¿Admin?: ${isAdmin ? 'sí' : 'no'}`,
                '',
                `ID del bot: ${botId}`,
                `Alias del bot: ${[...bot].join(', ')}`,
                `¿Bot admin?: ${isBotAdmin ? 'sí' : 'no'}`,
                '',
                `Admins del grupo (IDs crudos): ${admins.join(', ') || 'ninguno'}`,
                `Participantes: ${(chat.participants || []).length}`,
                `Grupo: ${chat.id._serialized}`
            ].join('\n')
        );
    }
};
