const eco = require('../lib/economy');
const P = require('../lib/profile');
const { MessageMedia } = require('whatsapp-web.js');
const { profilePic } = require('../lib/avatar');
const avatarStore = require('../lib/avatarstore');
const { resolveTargets } = require('../lib/targets');
const { prefixes, profile: cfg } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const prof = (u) => u.profile || (u.profile = {});
const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

// ---------- setters ----------
function textSetter({ name, aliases, field, max, label, example }) {
    return {
        name,
        aliases,
        groupOnly: true,
        async run(ctx) {
            const text = clean(ctx.rest);
            if (!text) return ctx.msg.reply(`Uso: ${p}${name} <texto>\nEjemplo: ${p}${name} ${example}`);
            if (text.length > max) return ctx.msg.reply(`Es demasiado largo (máximo ${max} caracteres).`);

            prof(await me(ctx))[field] = text;
            eco.save();
            return ctx.msg.reply(`✅ ${label} guardado: *${text}*`);
        }
    };
}

const setfav = textSetter({ name: 'setfav', aliases: ['setfavourite'], field: 'fav', max: cfg.maxFav, label: 'Personaje favorito', example: 'Gojo Satoru' });
const setdesc = textSetter({ name: 'setdesc', aliases: ['setdescription'], field: 'desc', max: cfg.maxDesc, label: 'Descripción', example: 'Me encanta el café y el anime' });

const setgenre = {
    name: 'setgenre',
    groupOnly: true,
    async run(ctx) {
        const g = P.parseGenre(ctx.args[0]);
        if (!g) return ctx.msg.reply(`Uso: ${p}setgenre <hombre|mujer|otro>`);
        prof(await me(ctx)).genre = g;
        eco.save();
        return ctx.msg.reply(`✅ Género guardado: *${P.GENRES[g].label}*`);
    }
};

const BIRTH_ERRORS = {
    formato: `Usa el formato AAAA-MM-DD. Ejemplo: ${p}setbirth 2000-05-15`,
    fecha: 'Esa fecha no existe. Revisa el día y el mes.',
    anio: 'El año debe ser 1900 o posterior.',
    futura: 'La fecha no puede ser futura.'
};

const setbirth = {
    name: 'setbirth',
    groupOnly: true,
    async run(ctx) {
        const r = P.parseBirth(ctx.args[0]);
        if (r.error) return ctx.msg.reply(`❌ ${BIRTH_ERRORS[r.error]}`);
        prof(await me(ctx)).birth = r.value;
        eco.save();
        return ctx.msg.reply(`🎂 Cumpleaños guardado: *${P.dayMonth(r.value)}* (${P.age(r.value)} años)`);
    }
};

// ---------- borrar ----------
function deleter({ name, aliases, field, label, store }) {
    return {
        name,
        aliases,
        groupOnly: true,
        async run(ctx) {
            const u = await me(ctx);
            const holder = store === 'stickerMeta' ? u : u.profile || {};
            const key = store === 'stickerMeta' ? 'stickerMeta' : field;
            if (!holder[key]) return ctx.msg.reply(`No tienes ${label} guardado.`);
            delete holder[key];
            eco.save();
            return ctx.msg.reply(`🗑️ ${label[0].toUpperCase() + label.slice(1)} eliminado.`);
        }
    };
}

const delfav = deleter({ name: 'delfavourite', aliases: ['delfav'], field: 'fav', label: 'personaje favorito' });
const deldesc = deleter({ name: 'deldescription', aliases: ['deldesc'], field: 'desc', label: 'descripción' });
const delgenre = deleter({ name: 'delgenre', field: 'genre', label: 'género' });
const delbirth = deleter({ name: 'delbirth', field: 'birth', label: 'cumpleaños' });
const delstickermeta = deleter({ name: 'delstickermeta', aliases: ['delmeta'], store: 'stickerMeta', label: 'autor y pack de stickers' });

// ---------- meta de stickers ----------
const setmeta = {
    name: 'setmeta',
    aliases: ['setstickermeta'],
    groupOnly: true,
    async run(ctx) {
        const [authorRaw, packRaw] = ctx.rest.split('|');
        const author = clean(authorRaw || '');
        const pack = clean(packRaw || '');
        if (!author && !pack) {
            return ctx.msg.reply(`Uso: ${p}setmeta <autor> | <pack>\nEjemplo: ${p}setmeta Ana | Mis stickers`);
        }
        if (author.length > cfg.maxMeta || pack.length > cfg.maxMeta) {
            return ctx.msg.reply(`El autor y el pack pueden tener máximo ${cfg.maxMeta} caracteres cada uno.`);
        }

        const u = await me(ctx);
        u.stickerMeta = { author, pack };
        eco.save();
        return ctx.msg.reply(
            `✅ Tus stickers saldrán con:\n✍️ Autor: *${author || '(por defecto)'}*\n📦 Pack: *${pack || '(por defecto)'}*`
        );
    }
};

// La foto que subió la persona con !setpic; si no hay, la de su WhatsApp
async function picFor(client, u, id, extra) {
    const custom = avatarStore.getPath(u);
    if (custom) {
        try {
            return MessageMedia.fromFilePath(custom);
        } catch (err) {
            console.error('[perfil] no pude leer la foto guardada:', err.message);
        }
    }
    return profilePic(client, id, extra);
}

// ---------- perfil ----------
async function target(ctx) {
    const targets = await resolveTargets(ctx.msg);
    const id = targets[0] || ctx.sender;
    const extra = targets[0] ? [] : ctx.senderExtra;
    return { id, extra, user: await eco.getUser(ctx.client, gidOf(ctx), id, extra), self: !targets[0] };
}

const profile = {
    name: 'profile',
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, settings } = ctx;
        const t = await target(ctx);
        const u = t.user;
        const pr = u.profile || {};
        const name = await eco.nameOf(client, t.id);
        const none = '_sin definir_';

        const lines = [`👤 *Perfil de ${name}*`, ''];
        lines.push(`📝 Descripción: ${pr.desc || none}`);
        lines.push(`⚧️ Género: ${pr.genre ? P.GENRES[pr.genre].label : none}`);
        if (pr.birth) {
            lines.push(`🎂 Cumpleaños: ${P.dayMonth(pr.birth)} (${P.age(pr.birth)} años)${P.isToday(pr.birth) ? ' 🎉 ¡es hoy!' : ''}`);
        } else lines.push(`🎂 Cumpleaños: ${none}`);
        lines.push(`⭐ Favorito: ${pr.fav || none}`);

        const mentions = [];
        if (u.partner) {
            const days = Math.floor((Date.now() - u.partner.since) / 86400e3);
            lines.push(`💍 Pareja: @${u.partner.id.split('@')[0]} (${days < 1 ? 'desde hoy' : `hace ${days} día${days === 1 ? '' : 's'}`})`);
            mentions.push(u.partner.id);
        } else lines.push(`💍 Pareja: ${none}`);

        if (settings.economy) {
            lines.push('', `💵 Efectivo: ${eco.money(u.cash, settings)}`, `🏦 Banco: ${eco.money(u.bank, settings)}`);
            if (u.streak) lines.push(`🔥 Racha daily: día ${u.streak}`);
        }

        const caption = lines.join('\n');
        const opts = { quotedMessageId: msg.id._serialized, mentions };

        const pic = await picFor(client, u, t.id, t.extra);
        if (pic) {
            try {
                return await chat.sendMessage(pic, { ...opts, caption });
            } catch (err) {
                console.error('[perfil] no pude enviar la foto:', err.message);
            }
        }
        return chat.sendMessage(caption, opts);
    }
};

const getpic = {
    name: 'getpic',
    aliases: ['pfp'],
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat } = ctx;
        const targets = await resolveTargets(msg);
        const id = targets[0] || ctx.sender;
        const name = await eco.nameOf(client, id);
        const extra = targets[0] ? [] : ctx.senderExtra;
        const u = await eco.getUser(client, gidOf(ctx), id, extra);

        const pic = await picFor(client, u, id, extra);
        if (!pic) return msg.reply(`📷 No pude obtener la foto de ${name}: no tiene o la tiene privada.`);
        return chat.sendMessage(pic, { caption: `📸 Foto de perfil de ${name}`, quotedMessageId: msg.id._serialized });
    }
};

// ---------- cumpleaños ----------
function members(ctx) {
    return eco
        .allUsers(gidOf(ctx))
        .map(([key, u]) => ({ key, u, birth: u.profile && u.profile.birth }))
        .filter((x) => x.birth && P.isMember(x.u, ctx.chat));
}

const birthdays = {
    name: 'birthdays',
    groupOnly: true,
    async run(ctx) {
        const { client, msg } = ctx;
        const now = P.clock.fn();
        const month = now.getMonth() + 1;

        const list = members(ctx)
            .filter((x) => P.split(x.birth).m === month)
            .sort((a, b) => P.split(a.birth).d - P.split(b.birth).d);

        if (!list.length) {
            return msg.reply(`🎂 Nadie ha registrado su cumpleaños en ${P.MONTHS[month - 1]}.\nRegistra el tuyo con ${p}setbirth AAAA-MM-DD`);
        }

        const names = await Promise.all(list.map((x) => eco.nameOf(client, x.key)));
        const today = now.getDate();
        const lines = list.map((x, i) => {
            const d = P.split(x.birth).d;
            const when = d === today ? '🎉 ¡hoy!' : d < today ? 'ya pasó' : `en ${d - today} día${d - today === 1 ? '' : 's'}`;
            return `🎂 ${d} — ${names[i]} (${P.age(x.birth) + (d > today ? 1 : 0)} años) · ${when}`;
        });
        return msg.reply(`🎈 *Cumpleaños de ${P.MONTHS[month - 1]}*\n\n${lines.join('\n')}`);
    }
};

const allbirthdays = {
    name: 'allbirthdays',
    groupOnly: true,
    async run(ctx) {
        const { client, msg } = ctx;
        const list = members(ctx).sort((a, b) => {
            const x = P.split(a.birth);
            const y = P.split(b.birth);
            return x.m - y.m || x.d - y.d;
        });

        if (!list.length) return msg.reply(`🎂 Nadie ha registrado su cumpleaños todavía.\nRegistra el tuyo con ${p}setbirth AAAA-MM-DD`);

        const shown = list.slice(0, cfg.listLimit);
        const names = await Promise.all(shown.map((x) => eco.nameOf(client, x.key)));

        const out = ['🎈 *Todos los cumpleaños*'];
        let month = 0;
        shown.forEach((x, i) => {
            const { m, d } = P.split(x.birth);
            if (m !== month) {
                month = m;
                out.push('', `📅 *${P.MONTHS[m - 1][0].toUpperCase() + P.MONTHS[m - 1].slice(1)}*`);
            }
            out.push(`🎂 ${d} — ${names[i]}`);
        });
        if (list.length > shown.length) out.push('', `…y ${list.length - shown.length} más.`);
        return msg.reply(out.join('\n'));
    }
};

module.exports = [
    profile, getpic,
    setfav, setdesc, setgenre, setbirth, setmeta,
    delfav, deldesc, delgenre, delbirth, delstickermeta,
    birthdays, allbirthdays
];
