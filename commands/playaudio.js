const media = require('../lib/media');
const tts = require('../lib/tts');
const { guarded } = require('../lib/downloader');
const { sendVoice } = require('../lib/send');
const { prefixes, media: cfg } = require('../config');

module.exports = {
    name: 'playaudio',
    async run(ctx) {
        const { msg, chat, rest } = ctx;

        let input = rest;
        if (!input && msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            input = quoted.body || '';
        }

        const { lang, text } = tts.parseLang(input);
        if (!text) {
            return msg.reply(
                `Uso: ${prefixes[0]}playaudio <texto> (o responde a un mensaje)\n` +
                    `Otro idioma: ${prefixes[0]}playaudio en: hello everyone`
            );
        }
        if (text.length > cfg.tts.maxChars) {
            return msg.reply(`El texto es demasiado largo (máximo ${cfg.tts.maxChars} caracteres).`);
        }

        return guarded(ctx, { key: 'tts', cooldownMs: cfg.tts.cooldownMs }, async () => {
            await media.withTempDir(async (dir) => {
                const file = await tts.synthesize(text, lang, dir);
                await sendVoice(chat, file, { quotedMessageId: msg.id._serialized });
            });
        });
    }
};
