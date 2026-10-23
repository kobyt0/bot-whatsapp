const eco = require('../lib/economy');
const chars = require('../lib/characters');
const G = require('../lib/gacha');
const { charImage } = require('../lib/charimg');
const { resolveTargets } = require('../lib/targets');
const { formatWait } = require('../lib/utils');
const { prefixes, gacha: cfg } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const mention = (id) => `@${id.split('@')[0]}`;
const pages = (n) => Math.max(1, Math.ceil(n / cfg.pageSize));

const gacha = (cmd) => ({ groupOnly: true, gacha: true, ...cmd });

// Los comandos de consulta avisan si falta la base de personajes
const needsData = (run) =>
    async function (ctx) {
        if (!chars.available()) return ctx.msg.reply(G.NOT_READY);
        return run(ctx);
    };

// ---------- roll ----------
const roll = gacha({
    name: 'roll',
    aliases: ['rw'],
    run: needsData(async (ctx) => {
        const { msg, chat, settings, sender } = ctx;
        const gid = gidOf(ctx);
        const u = await me(ctx);

        const left = G.rollWait(u);
        if (left) return msg.reply(`⏳ Ya hiciste tu roll. Podrás volver a tirar en *${formatWait(left)}*.`);

        const c = G.pick(gid);
        if (!c) return msg.reply('🫥 No quedan personajes libres en este grupo.');

        G.useRoll(u);
        eco.save();

        // Se reserva ya, para que nadie más reciba el mismo personaje mientras se envía la imagen
        const prop = { gid, char: c, rollerKey: u.key, rollerId: sender, msgId: null, chat, settings };
        G.addPending(prop, cfg.claim.windowMs, () =>
            chat.sendMessage(`⌛ Nadie reclamó a *${c.name}*. Vuelve a estar libre.`)
        );

        const caption =
            `🎴 *${c.name}*\n📺 ${c.anime}\n${chars.label(c)} · 💰 ${eco.money(c.value, settings)}\n` +
            `❤️ Popularidad: #${c.rank}\n\n` +
            `⏳ Reclámalo con *${p}claim* (respondiendo a este mensaje). Tienes ${Math.round(cfg.claim.windowMs / 1000)} s.`;
        const opts = { quotedMessageId: msg.id._serialized };

        let sent;
        try {
            const media = await charImage(c);
            sent = media ? await chat.sendMessage(media, { ...opts, caption }) : await chat.sendMessage(caption, opts);
        } catch (err) {
            try {
                sent = await chat.sendMessage(caption, opts);
            } catch (err2) {
                console.error('[gacha] no pude enviar el roll:', err2.message);
                G.removePending(prop);
                G.refundRoll(u);
                eco.save();
                return;
            }
        }
        prop.msgId = sent && sent.id && sent.id._serialized;
    })
});

// ---------- claim ----------
const claim = gacha({
    name: 'claim',
    aliases: ['c', 'reclamar'],
    run: needsData(async (ctx) => {
        const { msg, chat, settings, sender, rest } = ctx;
        const gid = gidOf(ctx);
        const u = await me(ctx);

        const left = G.claimWait(u);
        if (left) return msg.reply(`⏳ Ya reclamaste un personaje. Podrás reclamar otro en *${formatWait(left)}*.`);

        const list = G.pendingList(gid);
        if (!list.length) return msg.reply(`No hay ningún personaje esperando ser reclamado. Usa ${p}roll`);

        let prop = null;
        if (msg.hasQuotedMsg) {
            const q = await msg.getQuotedMessage();
            const qid = q && q.id && q.id._serialized;
            prop = list.find((x) => x.msgId && x.msgId === qid) || null;
        }
        if (!prop && rest) {
            const r = chars.find(rest, list.map((x) => x.char));
            if (r.match) prop = list.find((x) => x.char === r.match);
            else if (r.candidates.length) {
                return msg.reply('Encontré varios, sé más específico:\n' + r.candidates.map((c) => `• ${c.name}`).join('\n'));
            } else return msg.reply('Ese personaje no está esperando ser reclamado.');
        }
        if (!prop) {
            if (list.length === 1) prop = list[0];
            else {
                return msg.reply(
                    `Hay varios personajes esperando. Responde al mensaje del que quieres con ${p}claim o escribe su nombre:\n` +
                        list.map((x) => `• ${x.char.name}`).join('\n')
                );
            }
        }

        G.removePending(prop);
        G.setOwner(gid, prop.char.id, u.key);
        G.stampClaim(u);
        eco.save();

        return chat.sendMessage(
            `💖 ${mention(sender)} reclamó a *${prop.char.name}*\n${chars.label(prop.char)} · 💰 ${eco.money(prop.char.value, settings)}`,
            { quotedMessageId: msg.id._serialized, mentions: [sender] }
        );
    })
});

// ---------- ginfo ----------
const ginfo = gacha({
    name: 'ginfo',
    run: async (ctx) => {
        const { msg, settings } = ctx;
        const gid = gidOf(ctx);
        const u = await me(ctx);

        const rollLeft = G.rollWait(u);
        const claimLeft = G.claimWait(u);
        const mine = G.ownedBy(gid, u.key);
        const free = chars.available() ? chars.all().length - Object.keys(G.state(gid).chars).length : 0;

        return msg.reply(
            `🎴 *Sistema gacha*\n` +
                `🎲 Roll: ${rollLeft ? `en *${formatWait(rollLeft)}*` : '*disponible* ✅'}\n` +
                `💖 Claim: ${claimLeft ? `en *${formatWait(claimLeft)}*` : '*disponible* ✅'}\n` +
                `📚 Tu colección: ${mine.length} personaje(s) · valor ${eco.money(G.totalValue(mine), settings)}\n` +
                `🌐 Personajes libres en el grupo: ${free}`
        );
    }
});

// ---------- harem ----------
const harem = gacha({
    name: 'harem',
    aliases: ['libro'],
    run: needsData(async (ctx) => {
        const { client, msg, args, settings } = ctx;
        const gid = gidOf(ctx);

        const targets = await resolveTargets(msg);
        const id = targets[0] || ctx.sender;
        const owner = await eco.getUser(client, gid, id, targets[0] ? [] : ctx.senderExtra);
        const name = await eco.nameOf(client, id);

        const list = G.ownedBy(gid, owner.key);
        if (!list.length) {
            return msg.reply(targets[0] ? `📚 ${name} todavía no tiene personajes.` : `📚 Todavía no tienes personajes. Prueba con ${p}roll`);
        }

        const total = pages(list.length);
        const n = Math.min(total, Math.max(1, parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 1));
        const slice = list.slice((n - 1) * cfg.pageSize, n * cfg.pageSize);

        const lines = slice.map((c, i) => {
            const sale = G.listingOf(gid, c.id);
            return `${(n - 1) * cfg.pageSize + i + 1}. ${G.tierIcon(c)} ${c.name} — ${c.anime} · ${eco.money(c.value, settings)}${sale ? ` · 🏷️ en venta #${sale.id}` : ''}`;
        });

        return msg.reply(
            `📚 *Colección de ${name}*\n${list.length} personaje(s) · valor total ${eco.money(G.totalValue(list), settings)}\n\n` +
                `${lines.join('\n')}\n\nPágina ${n}/${total}${total > 1 ? ` · ${p}harem ${n < total ? n + 1 : 1}` : ''}`
        );
    })
});

// ---------- delchar y delallharem ----------
const delchar = gacha({
    name: 'delchar',
    run: needsData(async (ctx) => {
        const { msg, rest } = ctx;
        if (!rest) return msg.reply(`Uso: ${p}delchar <nombre del personaje>`);

        const gid = gidOf(ctx);
        const u = await me(ctx);
        const c = await G.resolve(ctx, rest, G.ownedBy(gid, u.key), 'No tienes un personaje con ese nombre.');
        if (!c) return;

        G.release(gid, c.id);
        eco.save();
        return msg.reply(`🗑️ Liberaste a *${c.name}*. Ahora vuelve a estar libre en el grupo.`);
    })
});

const pendingDelAll = new Map();

const delallharem = gacha({
    name: 'delallharem',
    run: needsData(async (ctx) => {
        const { msg, args } = ctx;
        const gid = gidOf(ctx);
        const u = await me(ctx);
        const mine = G.ownedBy(gid, u.key);
        if (!mine.length) return msg.reply('No tienes personajes que liberar.');

        const key = `${gid}|${u.key}`;
        const confirming = ['confirmar', 'confirm'].includes((args[0] || '').toLowerCase());
        if (!confirming) {
            pendingDelAll.set(key, Date.now());
            return msg.reply(
                `⚠️ Esto liberará a tus *${mine.length}* personaje(s) y es *irreversible*.\n` +
                    `Para confirmar escribe *${p}delallharem confirmar* en los próximos 60 segundos.`
            );
        }

        const at = pendingDelAll.get(key);
        if (!at || Date.now() - at > 60000) {
            pendingDelAll.delete(key);
            return msg.reply(`No hay una confirmación pendiente. Escribe primero *${p}delallharem*.`);
        }

        pendingDelAll.delete(key);
        for (const c of mine) G.release(gid, c.id);
        eco.save();
        return msg.reply(`🧹 Liberaste a tus ${mine.length} personaje(s).`);
    })
});

// ---------- ainfo, slist y wimage ----------
const ainfo = gacha({
    name: 'ainfo',
    run: needsData(async (ctx) => {
        const { client, msg, rest } = ctx;
        if (!rest) return msg.reply(`Uso: ${p}ainfo <anime>\nEjemplo: ${p}ainfo jujutsu kaisen\nVer los animes disponibles: ${p}slist`);

        const gid = gidOf(ctx);
        const r = chars.findAnime(rest);
        if (!r.match) {
            if (!r.candidates.length) return msg.reply(`No encontré ese anime. Mira los disponibles con ${p}slist`);
            return msg.reply('Encontré varios, sé más específico:\n' + r.candidates.map((a) => `• ${a.title}`).join('\n'));
        }

        const state = G.state(gid);
        const shown = r.match.chars.slice(0, 25);
        const owners = await Promise.all(
            shown.map((c) => (state.chars[c.id] ? eco.nameOf(client, state.chars[c.id].owner) : null))
        );
        const lines = shown.map((c, i) => `• ${G.tierIcon(c)} ${c.name} — ${owners[i] ? `🔒 ${owners[i]}` : '✅ libre'}`);
        const more = r.match.chars.length - shown.length;

        return msg.reply(`📺 *${r.match.title}* (${r.match.chars.length} personajes)\n\n${lines.join('\n')}${more > 0 ? `\n…y ${more} más.` : ''}`);
    })
});

const slist = gacha({
    name: 'slist',
    run: needsData(async (ctx) => {
        const { msg, args } = ctx;
        const list = chars.animeList();
        const size = 15;
        const total = Math.max(1, Math.ceil(list.length / size));
        const n = Math.min(total, Math.max(1, parseInt(args[0], 10) || 1));

        const lines = list.slice((n - 1) * size, n * size).map((a) => `• ${a.title} (${a.chars.length})`);
        return msg.reply(
            `📺 *Animes disponibles* (${list.length})\n\n${lines.join('\n')}\n\nPágina ${n}/${total}${total > 1 ? ` · ${p}slist ${n < total ? n + 1 : 1}` : ''}\nVer uno: ${p}ainfo <anime>`
        );
    })
});

const wimage = gacha({
    name: 'wimage',
    run: needsData(async (ctx) => {
        const { client, msg, chat, rest, settings } = ctx;
        if (!rest) return msg.reply(`Uso: ${p}wimage <nombre del personaje>`);

        const c = await G.resolve(ctx, rest, null, `No encontré ese personaje. Busca por anime con ${p}ainfo`);
        if (!c) return;

        const gid = gidOf(ctx);
        const ownerKey = G.ownerKey(gid, c.id);
        const owner = ownerKey ? await eco.nameOf(client, ownerKey) : null;
        const sale = G.listingOf(gid, c.id);

        const caption =
            `🎴 *${c.name}*${c.native ? ` (${c.native})` : ''}\n📺 ${c.anime}\n${chars.label(c)} · 💰 ${eco.money(c.value, settings)}\n` +
            `❤️ Popularidad: #${c.rank}\n` +
            (owner ? `🔒 Pertenece a ${owner}${sale ? ` · 🏷️ en venta por ${eco.money(sale.price, settings)} (#${sale.id})` : ''}` : '✅ Libre en este grupo');

        const opts = { quotedMessageId: msg.id._serialized };
        const media = await charImage(c);
        return media ? chat.sendMessage(media, { ...opts, caption }) : chat.sendMessage(caption, opts);
    })
});

module.exports = [roll, claim, ginfo, harem, delchar, delallharem, ainfo, slist, wimage];
