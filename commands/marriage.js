const eco = require('../lib/economy');
const proposals = require('../lib/proposals');
const { resolveTargets } = require('../lib/targets');
const { sameUser, botExtra } = require('../lib/identity');
const { prefixes, profile: cfg } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const mention = (id) => `@${id.split('@')[0]}`;

const marry = {
    name: 'marry',
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, sender, senderExtra } = ctx;
        const gid = gidOf(ctx);

        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}marry @usuario (o responde a un mensaje suyo)`);
        const targetId = targets[0];

        if (await sameUser(client, targetId, [], sender, senderExtra)) return msg.reply('No puedes casarte contigo mismo 💍');
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) {
            return msg.reply('Soy un bot, mi corazón es de silicio 🤖');
        }

        const from = await me(ctx);
        const to = await eco.getUser(client, gid, targetId);

        if (from.partner) {
            return chat.sendMessage(`💔 Ya estás casado/a con ${mention(from.partner.id)}. Si quieres cambiar, usa ${p}divorce primero.`, {
                quotedMessageId: msg.id._serialized,
                mentions: [from.partner.id]
            });
        }
        if (to.partner) {
            return chat.sendMessage(`💔 ${mention(targetId)} ya está casado/a con ${mention(to.partner.id)}.`, {
                quotedMessageId: msg.id._serialized,
                mentions: [targetId, to.partner.id]
            });
        }
        if (proposals.get(gid, to)) return msg.reply('Esa persona ya tiene una propuesta pendiente. Espera a que responda.');
        if (proposals.outstandingFrom(gid, from)) return msg.reply('Ya tienes una propuesta pendiente. Espera la respuesta.');

        proposals.create(
            {
                gid, type: 'marry', from, fromId: sender, to, toId: targetId, chat,
                expireText: `⌛ La propuesta de ${mention(sender)} a ${mention(targetId)} expiró sin respuesta.`
            },
            cfg.proposalMs
        );

        return chat.sendMessage(
            `💍 ${mention(sender)} le propone matrimonio a ${mention(targetId)}\n\n` +
                `${mention(targetId)}, responde con *${p}acepto* o *${p}rechazo* ` +
                `(tienes ${Math.round(cfg.proposalMs / 1000)} segundos).`,
            { quotedMessageId: msg.id._serialized, mentions: [sender, targetId] }
        );
    }
};

proposals.register('marry', {
    async accept(ctx, prop) {
        const { msg, chat } = ctx;
        // Por si alguno se casó mientras tanto
        if (prop.from.partner || prop.to.partner) return msg.reply('💔 La propuesta ya no es válida: alguno de los dos ya está casado/a.');

        const since = Date.now();
        prop.from.partner = { key: prop.to.key, id: prop.toId, since };
        prop.to.partner = { key: prop.from.key, id: prop.fromId, since };
        eco.save();

        return chat.sendMessage(`💞 ¡${mention(prop.fromId)} y ${mention(prop.toId)} ahora están casados! Felicidades 🎉`, {
            quotedMessageId: msg.id._serialized,
            mentions: [prop.fromId, prop.toId]
        });
    },
    async reject(ctx, prop) {
        return ctx.chat.sendMessage(`💔 ${mention(prop.toId)} rechazó la propuesta de ${mention(prop.fromId)}.`, {
            quotedMessageId: ctx.msg.id._serialized,
            mentions: [prop.toId, prop.fromId]
        });
    }
});

// !acepto y !rechazo sirven para cualquier propuesta pendiente (matrimonio, intercambio...)
const acepto = {
    name: 'acepto',
    groupOnly: true,
    async run(ctx) {
        const prop = proposals.get(gidOf(ctx), await me(ctx));
        if (!prop) return ctx.msg.reply('No tienes ninguna propuesta pendiente.');
        proposals.drop(prop);
        return proposals.kinds.get(prop.type).accept(ctx, prop);
    }
};

const rechazo = {
    name: 'rechazo',
    groupOnly: true,
    async run(ctx) {
        const prop = proposals.get(gidOf(ctx), await me(ctx));
        if (!prop) return ctx.msg.reply('No tienes ninguna propuesta pendiente.');
        proposals.drop(prop);
        return proposals.kinds.get(prop.type).reject(ctx, prop);
    }
};

const divorce = {
    name: 'divorce',
    groupOnly: true,
    async run(ctx) {
        const { msg, chat } = ctx;
        const u = await me(ctx);
        if (!u.partner) return msg.reply('No estás casado/a con nadie.');

        const partnerId = u.partner.id;
        const partner = eco.byKey(gidOf(ctx), u.partner.key);
        if (partner) delete partner.partner;
        delete u.partner;
        eco.save();

        return chat.sendMessage(`💔 ${mention(ctx.sender)} se divorció de ${mention(partnerId)}.`, {
            quotedMessageId: msg.id._serialized,
            mentions: [ctx.sender, partnerId]
        });
    }
};

module.exports = [marry, acepto, rechazo, divorce];
