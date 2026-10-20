const fs = require('fs');
const path = require('path');
const P = require('../lib/playlists');
const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { sendFile, safeFilename } = require('../lib/send');
const { fmtClock } = require('../lib/utils');
const { prefixes, media: cfg } = require('../config');

module.exports = {
    name: 'listen',
    async run(ctx) {
        const { msg, chat, rest } = ctx;
        const name = P.cleanName(rest);

        if (!name) return msg.reply(`Uso: ${prefixes[0]}listen <playlist>`);

        const pl = P.find(P.getUser(P.userKey(ctx)), name);
        if (!pl) return msg.reply(`No tienes ninguna playlist llamada *${name}*.`);
        if (!pl.songs.length) return msg.reply(`La playlist *${pl.name}* está vacía.`);

        const songs = [...pl.songs]; // copia por si la editan mientras se descarga

        return guarded(
            ctx,
            { status: `⏳ Preparando el mix de *${pl.name}* (${songs.length} canciones). Puede tardar unos minutos...` },
            async () => {
                await media.withTempDir(async (dir) => {
                    const files = [];
                    const included = [];
                    const failed = [];

                    for (let i = 0; i < songs.length; i++) {
                        const sub = path.join(dir, String(i + 1));
                        await fs.promises.mkdir(sub);
                        try {
                            files.push(await media.downloadAudio(songs[i].url, sub));
                            included.push(songs[i]);
                        } catch (err) {
                            console.error(`[listen] falló "${songs[i].title}":`, err.userMessage || err.stderr || err.message);
                            failed.push(songs[i].title);
                        }
                    }

                    if (!files.length) throw media.userError('No pude descargar ninguna canción de la playlist.');

                    const out = files.length === 1 ? files[0] : await media.mixAudio(files, dir);
                    await media.assertSize(out, cfg.maxAudioMB);

                    await sendFile(chat, out, {
                        filename: safeFilename(pl.name, 'mp3'),
                        quotedMessageId: msg.id._serialized
                    });

                    const lines = included.map((s, i) => `${i + 1}. ${s.title} (${fmtClock(s.duration)})`);
                    let text = `🎧 *${pl.name}* — ${included.length} canción(es)\n\n${lines.join('\n')}`;
                    if (failed.length) text += `\n\n⚠️ No pude incluir: ${failed.join(', ')}`;
                    await chat.sendMessage(text);
                });
            }
        );
    }
};
