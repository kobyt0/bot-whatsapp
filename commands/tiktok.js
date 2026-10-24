const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { sendFile, safeFilename } = require('../lib/send');
const { fmtClock } = require('../lib/utils');
const { prefixes, media: cfg } = require('../config');
const p = prefixes[0];

const AUDIO_WORDS = ['audio', 'mp3', 'musica', 'música', 'sonido'];

// Descarga solo el audio (mp3) del video de TikTok
async function sendAudio(ctx, url) {
    const { msg, chat } = ctx;
    return guarded(ctx, { status: '⏳ Extrayendo el audio del TikTok...' }, async () => {
        const info = await media.getInfo(url);
        media.assertDuration(info, cfg.maxAudioMin, { allowUnknown: true });

        await media.withTempDir(async (dir) => {
            const file = await media.downloadAudio(url, dir);
            await media.assertSize(file, cfg.maxAudioMB);
            await sendFile(chat, file, {
                filename: safeFilename((info.title || 'TikTok').slice(0, 60), 'mp3'),
                quotedMessageId: msg.id._serialized
            });
        });

        const duration = info.duration ? ` (${fmtClock(info.duration)})` : '';
        await chat.sendMessage(`🎵 Audio de TikTok${duration}\n${(info.title || '').slice(0, 120)}`.trim());
    });
}

const tiktok = {
    name: 'tiktok',
    aliases: ['tk'],
    async run(ctx) {
        const { msg, chat, args } = ctx;
        const url = args.find((a) => media.isAllowedUrl(a, media.HOSTS.tiktok));
        const wantsAudio = args.some((a) => AUDIO_WORDS.includes(a.toLowerCase()));

        if (!url) {
            return msg.reply(
                `Uso: ${p}tiktok <enlace de TikTok>\nSolo el audio: ${p}tiktok <enlace> audio  (o ${p}tkaudio <enlace>)`
            );
        }
        if (wantsAudio) return sendAudio(ctx, url);

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

const tkaudio = {
    name: 'tkaudio',
    aliases: ['tiktokaudio', 'tkmp3', 'tiktokmp3'],
    async run(ctx) {
        const url = ctx.args.find((a) => media.isAllowedUrl(a, media.HOSTS.tiktok));
        if (!url) return ctx.msg.reply(`Uso: ${p}tkaudio <enlace de TikTok>`);
        return sendAudio(ctx, url);
    }
};

module.exports = [tiktok, tkaudio];
