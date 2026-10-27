const { MessageMedia } = require('whatsapp-web.js');
const { buildHelp, pack } = require('../lib/help');
const banner = require('../lib/banner');

module.exports = {
    name: 'help',
    async run({ msg, chat, settings }) {
        const commands = require('./index'); // se carga aquí para evitar la referencia circular
        const { intro, sections } = buildHelp(commands, settings);
        const parts = pack(sections);
        const opts = { quotedMessageId: msg.id._serialized };

        // Con banner: la imagen lleva la introducción y después va el menú completo en un solo mensaje
        const bannerPath = settings ? banner.getPath(settings) : null;
        if (bannerPath) {
            try {
                await chat.sendMessage(MessageMedia.fromFilePath(bannerPath), { ...opts, caption: intro });
                for (const part of parts) await chat.sendMessage(part);
                return;
            } catch (err) {
                console.error('[help] no pude enviar el banner, envío solo texto:', err.message);
            }
        }

        await chat.sendMessage(`${intro}\n\n${parts[0]}`, opts);
        for (const part of parts.slice(1)) await chat.sendMessage(part);
    }
};
