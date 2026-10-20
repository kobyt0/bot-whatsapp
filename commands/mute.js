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
    async run({ client, msg, chat, args, settings, isBotAdmin }) {
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

        settings.mutes[target] = Date.now() + ms;
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
    async run({ client, msg, chat, settings }) {
        const target = await resolveTarget(msg);
        if (!target) {
            return msg.reply(`Uso: ${prefixes[0]}unmute @usuario (o responde a un mensaje suyo)`);
        }

        const key = await findMuteKey(client, settings, target);
        if (!key) {
            return msg.reply('Ese usuario no está silenciado.');
        }

        delete settings.mutes[key];
        db.save();
        return chat.sendMessage(`🔊 ${mention(target)} ya puede escribir de nuevo.`, {
            mentions: [target]
        });
    }
};

module.exports = [mute, unmute];
