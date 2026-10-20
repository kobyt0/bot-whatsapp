const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { sendFile } = require('../lib/send');
const { prefixes, media: cfg } = require('../config');

module.exports = {
    name: 'youtube',
    aliases: ['yt'],
    async run(ctx) {
        const { msg, chat, args } = ctx;
        const url = args.find((a) => media.isAllowedUrl(a, media.HOSTS.youtube));
        const quality = (args.find((a) => /^(360|720)p?$/i.test(a)) || '360').replace(/p/i, '');

        if (!url) {
            return msg.reply(
                `Uso: ${prefixes[0]}yt <enlace de YouTube> [360|720]\nEjemplo: ${prefixes[0]}yt https://youtu.be/xxxx 720`
            );
        }

        return guarded(ctx, { status: `⏳ Descargando el video en ${quality}p...` }, async () => {
            const info = await media.getInfo(url);
            media.assertDuration(info, cfg.maxVideoMin);

            await media.withTempDir(async (dir) => {
                let file = await media.downloadVideo(url, dir, Number(quality));
                file = await media.ensureH264(file, dir);
                await media.assertSize(file, cfg.maxVideoMB);
                await sendFile(chat, file, {
                    caption: `🎬 ${info.title}`,
                    quotedMessageId: msg.id._serialized
                });
            });
        });
    }
};
