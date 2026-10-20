const db = require('../lib/db');
const banner = require('../lib/banner');
const { prefixes } = require('../config');
const p = prefixes[0];

module.exports = {
    name: 'setbanner',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, chat, args, settings }) {
        if (['reset', 'off', 'delete', 'borrar', 'quitar'].includes((args[0] || '').toLowerCase())) {
            if (!banner.getPath(settings)) return msg.reply('Este grupo no tiene banner.');
            banner.remove(settings);
            db.save();
            return msg.reply('🗑️ Banner eliminado. Los mensajes saldrán sin imagen.');
        }

        // La imagen puede venir en el propio mensaje o en uno citado
        let source = null;
        if (msg.hasMedia) source = msg;
        else if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted.hasMedia) source = quoted;
        }

        if (!source) {
            return msg.reply(
                `Envía una imagen con el texto *${p}setbanner* o responde a una imagen con ese comando.\n` +
                    `Para quitarlo: ${p}setbanner reset`
            );
        }

        const media = await source.downloadMedia();
        if (!media || !/^image\//.test(media.mimetype || '')) {
            return msg.reply('El banner debe ser una imagen (JPG, PNG o WebP).');
        }

        try {
            settings.bannerFile = banner.save(chat.id._serialized, media);
        } catch (err) {
            if (err.message === 'TAMANO') return msg.reply('La imagen pesa más de 5 MB. Usa una más ligera.');
            if (err.message === 'FORMATO') return msg.reply('Formato no compatible. Usa JPG, PNG o WebP.');
            throw err;
        }
        db.save();

        return msg.reply('✅ Banner guardado. Se usará en la bienvenida y la despedida de este grupo.');
    }
};
