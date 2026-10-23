const eco = require('../lib/economy');
const avatarStore = require('../lib/avatarstore');
const { prefixes } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);

const setpic = {
    name: 'setpic',
    aliases: ['setphoto', 'setavatar'],
    groupOnly: true,
    async run(ctx) {
        const { msg } = ctx;

        // La imagen puede venir en el propio mensaje o en uno citado
        let source = null;
        if (msg.hasMedia) source = msg;
        else if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted && quoted.hasMedia) source = quoted;
        }
        if (!source) {
            return msg.reply(`Envía una imagen con *${p}setpic* o responde a una imagen con ese comando.\nPara quitarla: ${p}delpic`);
        }

        const media = await source.downloadMedia();
        if (!media || !/^image\//.test(media.mimetype || '')) {
            return msg.reply('El archivo debe ser una imagen (JPG, PNG o WebP).');
        }

        const u = await me(ctx);
        try {
            u.avatar = avatarStore.save(gidOf(ctx), u.key, media);
        } catch (err) {
            if (err.message === 'TAMANO') return msg.reply('La imagen pesa más de 5 MB. Usa una más ligera.');
            if (err.message === 'FORMATO') return msg.reply('Formato no compatible. Usa JPG, PNG o WebP.');
            throw err;
        }
        eco.save();

        return msg.reply(`✅ Foto de perfil guardada. Se verá en ${p}profile y ${p}pfp.`);
    }
};

const delpic = {
    name: 'delpic',
    aliases: ['delphoto', 'delavatar'],
    groupOnly: true,
    async run(ctx) {
        const u = await me(ctx);
        if (!avatarStore.getPath(u)) return ctx.msg.reply('No tienes una foto de perfil guardada con el bot.');
        avatarStore.remove(u);
        eco.save();
        return ctx.msg.reply('🗑️ Foto de perfil eliminada. Se usará la de tu WhatsApp (si es visible).');
    }
};

module.exports = [setpic, delpic];
