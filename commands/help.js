// !help: envía help.txt tal cual. Si el grupo tiene banner (lo pone un admin con !setbanner),
// el menú va como pie de foto de la imagen, en un solo mensaje. Para cambiar el menú, edita help.txt
// (se lee en cada uso, no hace falta reiniciar). Si el grupo usa otro prefijo, el bot cambia
// solo los "!" que van antes de un comando.
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const banner = require('../lib/banner');

const FILE = path.join(__dirname, '..', 'help.txt');

module.exports = {
    name: 'help',
    async run({ msg, chat, settings }) {
        let text;
        try {
            text = fs.readFileSync(FILE, 'utf8').trim();
        } catch (_) {
            return msg.reply('No encuentro el archivo help.txt del menú.');
        }

        // Banner del grupo (solo si un admin lo estableció): la imagen lleva el menú como pie de foto,
        // todo en un solo mensaje. Si WhatsApp rechazara un pie tan largo, se envía imagen y texto por separado.
        const bannerPath = settings ? banner.getPath(settings) : null;
        if (bannerPath) {
            const media = MessageMedia.fromFilePath(bannerPath);
            try {
                return await chat.sendMessage(media, { caption: text, quotedMessageId: msg.id._serialized });
            } catch (err) {
                console.error('[help] no pude enviar el menú como pie de foto, lo envío por separado:', err.message);
                try {
                    await chat.sendMessage(media, { quotedMessageId: msg.id._serialized });
                } catch (err2) {
                    console.error('[help] no pude enviar el banner:', err2.message);
                }
            }
        }

        return chat.sendMessage(text, { quotedMessageId: msg.id._serialized });
    }
};
