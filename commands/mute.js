const db = require('../lib/db');
const { parseDuration, formatDuration } = require('../lib/utils');
const { isAdmin, sameUser, findMuteKey, botExtra } = require('../lib/identity');
const { prefixes } = require('../config');

// El objetivo es la primera mención o el autor del mensaje citado
async function resolveTarget(msg) {
    if (msg.mentionedIds && msg.mentionedIds.length) {
        const first = msg.mentionedIds[0];
        return typeof first === 'string' ? first : first._serialized;
    }
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        return quoted.author || quoted.from;
    }
    return null;
}

const mention = (id) => `@${id.split('@')[0]}`;

const mute = {
    name: 'mute',
    adminOnly: true,
    groupOnly: true,
    async run({ client, msg, chat, args, settings, isBotAdmin, isOwner }) {
        const ms = args.map(parseDuration).find(Boolean);
        const target = await resolveTarget(msg);

        if (!ms || !target) {
            return msg.reply(
                `Uso: ${prefixes[0]}mute 30m|1h|1d|1w @usuario\n(o responde a un mensaje suyo)`
            );
        }

        const botId = client.info.wid._serialized;
        if (await sameUser(client, target, [], botId, botExtra(client))) {
            return msg.reply('No puedo silenciarme a mí mismo 😅');
        }
        if (await isAdmin(client, chat, target)) {
            return msg.reply('⛔ No se puede silenciar a un admin.');
        }

        // Si el dueño ya silenció a esta persona, otro admin no puede cambiarlo
        const prevKey = await findMuteKey(client, settings, target);
        if (prevKey && settings.ownerMutes[prevKey] && !isOwner) {
            return msg.reply('🔒 Este silencio lo puso el dueño del bot: solo él puede cambiarlo.');
        }

        const key = prevKey || target;
        settings.mutes[key] = Date.now() + ms;
        if (isOwner) settings.ownerMutes[key] = true;
        else delete settings.ownerMutes[key];
        db.save();

        let text = `🔇 ${mention(target)} silenciado por ${formatDuration(ms)}.`;
        if (!isBotAdmin) {
            text += '\n⚠️ No detecto que sea admin del grupo, puede que no pueda borrar sus mensajes.';
        }
        return chat.sendMessage(text, { mentions: [target] });
    }
};

const unmute = {
    name: 'unmute',
    adminOnly: true,
    groupOnly: true,
    async run({ client, msg, chat, settings, isOwner }) {
        const target = await resolveTarget(msg);
        if (!target) {
            return msg.reply(`Uso: ${prefixes[0]}unmute @usuario (o responde a un mensaje suyo)`);
        }

        const key = await findMuteKey(client, settings, target);
        if (!key) {
            return msg.reply('Ese usuario no está silenciado.');
        }

        if (settings.ownerMutes[key] && !isOwner) {
            return msg.reply('🔒 Este silencio lo puso el dueño del bot: solo él puede quitarlo.');
        }

        delete settings.mutes[key];
        delete settings.ownerMutes[key];
        db.save();
        return chat.sendMessage(`🔊 ${mention(target)} ya puede escribir de nuevo.`, {
            mentions: [target]
        });
    }
};

module.exports = [mute, unmute];
