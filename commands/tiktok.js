const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { sendFile } = require('../lib/send');
const { prefixes, media: cfg } = require('../config');

module.exports = {
    name: 'tiktok',
    aliases: ['tk'],
    async run(ctx) {
        const { msg, chat, args } = ctx;
        const url = args.find((a) => media.isAllowedUrl(a, media.HOSTS.tiktok));

        if (!url) {
            return msg.reply(`Uso: ${prefixes[0]}tiktok <enlace de TikTok>`);
        }

        return guarded(ctx, { status: '⏳ Descargando el video de TikTok...' }, async () => {
            const info = await media.getInfo(url);
            media.assertDuration(info, cfg.maxVideoMin, { allowUnknown: true });

            await media.withTempDir(async (dir) => {
                let file = await media.downloadTikTok(url, dir);
                file = await media.ensureH264(file, dir);
                await media.assertSize(file, cfg.maxVideoMB);
                await sendFile(chat, file, {
                    caption: `🎬 ${info.title.slice(0, 150)}`,
                    quotedMessageId: msg.id._serialized
                });
            });
        });
    }
};
