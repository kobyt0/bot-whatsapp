const { resolveTargets, mention } = require('../lib/targets');
const { isAdmin, isGroupAdmin, sameUser, botExtra } = require('../lib/identity');
const { prefixes } = require('../config');
const p = prefixes[0];

const list = (ids) => ids.map(mention).join(', ');

function failed(ctx, what, err) {
    console.error(`[admin] no pude ${what}:`, err.message);
    return ctx.msg.reply(
        `❌ No pude ${what}. ` +
            (ctx.isBotAdmin ? 'WhatsApp rechazó la acción.' : 'Necesito ser admin del grupo.')
    );
}

const promote = {
    name: 'promote',
    adminOnly: true,
    groupOnly: true,
    botAdmin: true,
    async run(ctx) {
        const { client, msg, chat } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}promote @usuario (o responde a un mensaje suyo)`);

        const todo = [];
        const already = [];
        for (const id of targets) ((await isGroupAdmin(client, chat, id)) ? already : todo).push(id);

        if (!todo.length) {
            return chat.sendMessage(`ℹ️ ${list(already)} ya es admin.`, { mentions: already });
        }

        try {
            await chat.promoteParticipants(todo);
        } catch (err) {
            return failed(ctx, 'subir de admin', err);
        }

        let text = `✅ ${list(todo)} ahora es admin.`;
        if (already.length) text += `\nℹ️ ${list(already)} ya lo era.`;
        return chat.sendMessage(text, { mentions: [...todo, ...already] });
    }
};

const demote = {
    name: 'demote',
    adminOnly: true,
    groupOnly: true,
    botAdmin: true,
    async run(ctx) {
        const { client, msg, chat } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}demote @usuario (o responde a un mensaje suyo)`);

        const botId = client.info.wid._serialized;
        const todo = [];
        const notAdmin = [];
        for (const id of targets) {
            if (await sameUser(client, id, [], botId, botExtra(client))) {
                return msg.reply('No puedo quitarme el admin a mí mismo.');
            }
            ((await isGroupAdmin(client, chat, id)) ? todo : notAdmin).push(id);
        }

        if (!todo.length) {
            return chat.sendMessage(`ℹ️ ${list(notAdmin)} no es admin.`, { mentions: notAdmin });
        }

        try {
            await chat.demoteParticipants(todo);
        } catch (err) {
            return failed(ctx, 'quitar el admin', err);
        }

        let text = `✅ ${list(todo)} ya no es admin.`;
        if (notAdmin.length) text += `\nℹ️ ${list(notAdmin)} no era admin.`;
        return chat.sendMessage(text, { mentions: [...todo, ...notAdmin] });
    }
};

const kick = {
    name: 'kick',
    adminOnly: true,
    groupOnly: true,
    botAdmin: true,
    async run(ctx) {
        const { client, msg, chat, sender, senderExtra } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}kick @usuario (o responde a un mensaje suyo)`);
        if (targets.length > 5) return msg.reply('Puedes expulsar hasta 5 usuarios por comando.');

        const botId = client.info.wid._serialized;
        const todo = [];
        const skipped = [];
        for (const id of targets) {
            if (await sameUser(client, id, [], botId, botExtra(client))) skipped.push(`${mention(id)} (soy yo)`);
            else if (await sameUser(client, id, [], sender, senderExtra)) skipped.push(`${mention(id)} (eres tú)`);
            else if (await isAdmin(client, chat, id)) skipped.push(`${mention(id)} (es admin: quítale el rol con ${p}demote)`);
            else todo.push(id);
        }

        const note = skipped.length ? `\n⚠️ No expulsé a: ${skipped.join(', ')}` : '';
        if (!todo.length) {
            return chat.sendMessage(`⛔ No había a quién expulsar.${note}`, { mentions: targets });
        }

        try {
            await chat.removeParticipants(todo);
        } catch (err) {
            return failed(ctx, 'expulsar', err);
        }

        return chat.sendMessage(`🚪 Expulsado: ${list(todo)}${note}`, { mentions: targets });
    }
};

const close = {
    name: 'close',
    adminOnly: true,
    groupOnly: true,
    botAdmin: true,
    async run(ctx) {
        try {
            await ctx.chat.setMessagesAdminsOnly(true);
        } catch (err) {
            return failed(ctx, 'cerrar el grupo', err);
        }
        return ctx.msg.reply('🔒 Grupo cerrado: solo los admins pueden escribir.');
    }
};

const open = {
    name: 'open',
    adminOnly: true,
    groupOnly: true,
    botAdmin: true,
    async run(ctx) {
        try {
            await ctx.chat.setMessagesAdminsOnly(false);
        } catch (err) {
            return failed(ctx, 'abrir el grupo', err);
        }
        return ctx.msg.reply('🔓 Grupo abierto: todos pueden escribir.');
    }
};

module.exports = [promote, demote, kick, close, open];
