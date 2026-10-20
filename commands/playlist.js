const P = require('../lib/playlists');
const media = require('../lib/media');
const { guarded } = require('../lib/downloader');
const { fmtClock } = require('../lib/utils');
const { prefixes, media: cfg } = require('../config');
const p = prefixes[0];

const summary = (pl) => {
    const total = P.totalSeconds(pl);
    return `${pl.songs.length} canción(es)${total ? ' · ' + fmtClock(total) : ''}`;
};

// "nombre | texto" -> ['nombre', 'texto'] (texto es null si no hay "|")
function split(rest) {
    const i = rest.indexOf('|');
    return i === -1 ? [rest.trim(), null] : [rest.slice(0, i).trim(), rest.slice(i + 1).trim()];
}

function showAll(msg, lists) {
    const all = Object.values(lists);
    if (!all.length) {
        return msg.reply(`No tienes playlists todavía. Crea una con ${p}playlist <nombre>`);
    }
    const lines = all.map((pl) => `• *${pl.name}* — ${summary(pl)}`);
    return msg.reply(`🎶 *Tus playlists*\n${lines.join('\n')}\n\nVer una: ${p}viewlist <nombre>`);
}

const playlist = {
    name: 'playlist',
    async run(ctx) {
        const { msg, rest } = ctx;
        const lists = P.getUser(P.userKey(ctx));
        const name = P.cleanName(rest);

        if (!name) return showAll(msg, lists);

        const existing = P.find(lists, name);
        if (existing) {
            return msg.reply(`Ya tienes una playlist llamada *${existing.name}*. Añade canciones con ${p}addlist ${existing.name} | canción`);
        }
        if (Object.keys(lists).length >= cfg.playlists.maxPerUser) {
            return msg.reply(`Llegaste al máximo de ${cfg.playlists.maxPerUser} playlists. Borra una con ${p}delplaylist <nombre>`);
        }

        lists[P.keyOf(name)] = { name, songs: [], createdAt: Date.now() };
        P.save();
        return msg.reply(
            `✅ Playlist *${name}* creada.\n` +
                `Añade canciones: ${p}addlist ${name} | nombre o enlace\n` +
                `Escúchala completa: ${p}listen ${name}`
        );
    }
};

const addlist = {
    name: 'addlist',
    async run(ctx) {
        const { msg } = ctx;
        const [rawName, songText] = split(ctx.rest);
        const name = P.cleanName(rawName);

        if (!name || !songText) {
            return msg.reply(`Uso: ${p}addlist <playlist> | <canción o enlace>\nEjemplo: ${p}addlist favoritas | Bad Bunny Monaco`);
        }

        const lists = P.getUser(P.userKey(ctx));
        const pl = P.find(lists, name);
        if (!pl) {
            return msg.reply(`No tienes ninguna playlist llamada *${name}*. Créala con ${p}playlist ${name}`);
        }
        if (pl.songs.length >= cfg.playlists.maxSongs) {
            return msg.reply(`Esa playlist ya tiene el máximo de ${cfg.playlists.maxSongs} canciones.`);
        }

        return guarded(ctx, { status: '🔎 Buscando la canción...', key: 'add', cooldownMs: cfg.addCooldownMs }, async () => {
            const target = media.toTarget(songText, media.HOSTS.youtube);
            const info = await media.getInfo(target);
            media.assertDuration(info, cfg.maxAudioMin);

            if (pl.songs.some((s) => s.url === info.url)) {
                throw media.userError('Esa canción ya está en la playlist.');
            }
            if (P.totalSeconds(pl) + info.duration > cfg.playlists.maxMixMin * 60) {
                throw media.userError(`La playlist superaría el máximo de ${cfg.playlists.maxMixMin} minutos.`);
            }

            pl.songs.push({ title: info.title, url: info.url, duration: info.duration });
            P.save();
            await msg.reply(`✅ Añadida a *${pl.name}* (#${pl.songs.length}): ${info.title} (${fmtClock(info.duration)})`);
        });
    }
};

const dellist = {
    name: 'dellist',
    async run(ctx) {
        const { msg } = ctx;
        const [rawName, arg] = split(ctx.rest);
        const name = P.cleanName(rawName);

        if (!name || !arg) {
            return msg.reply(`Uso: ${p}dellist <playlist> | <texto o número>\nEjemplo: ${p}dellist favoritas | 2`);
        }

        const pl = P.find(P.getUser(P.userKey(ctx)), name);
        if (!pl) return msg.reply(`No tienes ninguna playlist llamada *${name}*.`);
        if (!pl.songs.length) return msg.reply(`La playlist *${pl.name}* está vacía.`);

        let matches;
        if (/^\d+$/.test(arg)) {
            const idx = parseInt(arg, 10) - 1;
            if (idx < 0 || idx >= pl.songs.length) {
                return msg.reply(`Número inválido. La playlist tiene ${pl.songs.length} canción(es).`);
            }
            matches = [idx];
        } else {
            const q = arg.toLowerCase();
            matches = pl.songs.map((s, i) => (s.title.toLowerCase().includes(q) ? i : -1)).filter((i) => i >= 0);
        }

        if (!matches.length) return msg.reply('No encontré ninguna canción con ese texto.');
        if (matches.length > 1) {
            const lines = matches.map((i) => `${i + 1}. ${pl.songs[i].title}`);
            return msg.reply(`Hay varias coincidencias, usa el número:\n${lines.join('\n')}\n\nEjemplo: ${p}dellist ${pl.name} | ${matches[0] + 1}`);
        }

        const [removed] = pl.songs.splice(matches[0], 1);
        P.save();
        return msg.reply(`🗑️ Eliminada de *${pl.name}*: ${removed.title}`);
    }
};

const viewlist = {
    name: 'viewlist',
    async run(ctx) {
        const { msg, rest } = ctx;
        const lists = P.getUser(P.userKey(ctx));
        const name = P.cleanName(rest);

        if (!name) return showAll(msg, lists);

        const pl = P.find(lists, name);
        if (!pl) return msg.reply(`No tienes ninguna playlist llamada *${name}*.`);
        if (!pl.songs.length) {
            return msg.reply(`La playlist *${pl.name}* está vacía. Añade canciones con ${p}addlist ${pl.name} | canción`);
        }

        const lines = pl.songs.map((s, i) => `${i + 1}. ${s.title} (${fmtClock(s.duration)})`);
        return msg.reply(`🎶 *${pl.name}* — ${summary(pl)}\n\n${lines.join('\n')}\n\nEscúchala: ${p}listen ${pl.name}`);
    }
};

const delplaylist = {
    name: 'delplaylist',
    async run(ctx) {
        const { msg, rest } = ctx;
        const lists = P.getUser(P.userKey(ctx));
        const name = P.cleanName(rest);

        if (!name) return msg.reply(`Uso: ${p}delplaylist <playlist>`);

        const pl = P.find(lists, name);
        if (!pl) return msg.reply(`No tienes ninguna playlist llamada *${name}*.`);

        delete lists[P.keyOf(name)];
        P.save();
        return msg.reply(`🗑️ Playlist *${pl.name}* eliminada.`);
    }
};

module.exports = [playlist, addlist, dellist, viewlist, delplaylist];
