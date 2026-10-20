const { prefixes } = require('../config');
const p = prefixes[0];

function failed(ctx, what, err) {
    console.error(`[group] no pude ${what}:`, err.message);
    return ctx.msg.reply(
        `❌ No pude ${what}. ` +
            (ctx.isBotAdmin ? 'WhatsApp rechazó la acción.' : 'Necesito ser admin del grupo.')
    );
}

const setnamegroup = {
    name: 'setnamegroup',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const name = ctx.rest.replace(/\s+/g, ' ').trim();
        if (!name) return ctx.msg.reply(`Uso: ${p}setnamegroup <nuevo nombre>`);
        if (name.length > 100) return ctx.msg.reply('El nombre es demasiado largo (máximo 100 caracteres).');

        try {
            await ctx.chat.setSubject(name);
        } catch (err) {
            return failed(ctx, 'cambiar el nombre del grupo', err);
        }
        return ctx.msg.reply(`✅ Nombre del grupo cambiado a *${name}*.`);
    }
};

const setpfp = {
    name: 'setpfp',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { msg, chat } = ctx;

        let source = null;
        if (msg.hasMedia) source = msg;
        else if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted.hasMedia) source = quoted;
        }
        if (!source) {
            return msg.reply(`Envía una imagen con *${p}setpfp* o responde a una imagen con ese comando.`);
        }

        if (typeof chat.setPicture !== 'function') {
            return msg.reply('❌ Tu versión de whatsapp-web.js no permite cambiar la foto del grupo. Actualízala con `npm i whatsapp-web.js@latest`.');
        }

        const media = await source.downloadMedia();
        if (!media || !/^image\//.test(media.mimetype || '')) {
            return msg.reply('El archivo debe ser una imagen.');
        }

        try {
            const ok = await chat.setPicture(media);
            if (ok === false) throw new Error('WhatsApp devolvió false');
        } catch (err) {
            return failed(ctx, 'cambiar la foto del grupo', err);
        }
        return msg.reply('✅ Foto del grupo actualizada.');
    }
};

const del = {
    name: 'delete',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { msg, isBotAdmin } = ctx;
        if (!msg.hasQuotedMsg) return msg.reply(`Responde al mensaje que quieres borrar con ${p}delete`);

        const quoted = await msg.getQuotedMessage();
        if (!quoted.fromMe && !isBotAdmin) {
            return msg.reply('⚠️ Para borrar mensajes de otras personas necesito ser admin del grupo.');
        }

        try {
            await quoted.delete(true);
        } catch (err) {
            return failed(ctx, 'borrar el mensaje', err);
        }

        return msg.reply('🗑️ Mensaje eliminado correctamente.');
    }
};

module.exports = [setnamegroup, setpfp, del];
