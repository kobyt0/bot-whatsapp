const { MessageMedia } = require('whatsapp-web.js');
const eco = require('../lib/economy');
const { renderTextSticker, parseColor } = require('../lib/textsticker');
const { prefixes } = require('../config');

const META = { stickerName: 'Mi Bot', stickerAuthor: 'Creado en VS Code' };

// Autor y pack propios (!setmeta); en privado o sin configurar se usan los de por defecto
async function metaFor({ client, chat, sender, senderExtra }) {
    if (!chat.isGroup) return META;
    const u = await eco.findUser(client, chat.id._serialized, sender, senderExtra);
    if (!u || !u.stickerMeta) return META;
    return {
        stickerName: u.stickerMeta.pack || META.stickerName,
        stickerAuthor: u.stickerMeta.author || META.stickerAuthor
    };
}

module.exports = {
    name: 'sticker',
    aliases: ['s'],
    async run(ctx) {
        const { client, msg, chat, rest } = ctx;
        const meta = await metaFor(ctx);
        let targetMsg = msg;
        let quoted = null;

        if (msg.hasQuotedMsg) {
            quoted = await msg.getQuotedMessage();
            if (quoted.hasMedia) targetMsg = quoted;
        }

        // 1) Imagen o video -> sticker
        if (targetMsg.hasMedia) {
            try {
                const media = await targetMsg.downloadMedia();
                if (media) await chat.sendMessage(media, { sendMediaAsSticker: true, ...meta });
            } catch (err) {
                console.error('Error al crear el sticker:', err);
                msg.reply('Ocurrió un error al procesar el sticker.');
            }
            return;
        }

        // 2) Texto (escrito o de un mensaje citado) -> sticker de texto
        const { color, text } = parseColor(rest || (quoted && quoted.body) || '');
        if (!text) {
            return msg.reply(
                `Envía una imagen con *${prefixes[0]}sticker*, responde a una imagen, o escribe texto: ` +
                    `*${prefixes[0]}sticker hola a todos*\n` +
                    `Colores: ${prefixes[0]}sticker verde: hola (blanco, verde, negro o azul)`
            );
        }
        if (text.length > 200) {
            return msg.reply('El texto es demasiado largo para un sticker (máximo 200 caracteres).');
        }

        try {
            const png = await renderTextSticker(client, text, { color });
            const media = new MessageMedia('image/png', png, 'sticker.png');
            await chat.sendMessage(media, { sendMediaAsSticker: true, ...meta });
        } catch (err) {
            console.error('Error al crear el sticker de texto:', err);
            msg.reply(`❌ ${err.userMessage || 'No pude crear el sticker de texto.'}`);
        }
    }
};
