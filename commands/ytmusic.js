const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { sendFile, safeFilename } = require('../lib/send');
const { fmtClock } = require('../lib/utils');
const { prefixes, media: cfg } = require('../config');

module.exports = {
    name: 'ytmusic',
    aliases: ['ytmp3', 'music'],
    async run(ctx) {
        const { msg, chat, rest } = ctx;

        if (!rest) {
            return msg.reply(
                `Uso: ${prefixes[0]}ytmusic <nombre de la canción o enlace de YouTube>\n` +
                    `Ejemplo: ${prefixes[0]}ytmusic Bad Bunny Monaco`
            );
        }

        return guarded(ctx, { status: '🔎 Buscando y descargando el audio...' }, async () => {
            const target = media.toTarget(rest, media.HOSTS.youtube);
            const info = await media.getInfo(target);
            media.assertDuration(info, cfg.maxAudioMin);

            await media.withTempDir(async (dir) => {
                const file = await media.downloadAudio(info.url, dir);
                await media.assertSize(file, cfg.maxAudioMB);
                await sendFile(chat, file, {
                    filename: safeFilename(info.title, 'mp3'),
                    quotedMessageId: msg.id._serialized
                });
            });

            await chat.sendMessage(`🎵 ${info.title} (${fmtClock(info.duration)})`);
        });
    }
};
