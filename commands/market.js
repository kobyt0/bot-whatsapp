const eco = require('../lib/economy');
const chars = require('../lib/characters');
const G = require('../lib/gacha');
const proposals = require('../lib/proposals');
const { resolveTargets } = require('../lib/targets');
const { sameUser, botExtra } = require('../lib/identity');
const { prefixes, gacha: cfg } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const mention = (id) => `@${id.split('@')[0]}`;
const say = (ctx, text, mentions = []) => ctx.chat.sendMessage(text, { quotedMessageId: ctx.msg.id._serialized, mentions });
const noMentions = (rest) => rest.replace(/@\d+/g, '').replace(/\s+/g, ' ').trim();

const base = { groupOnly: true, gacha: true };
const needsData = (run) => async (ctx) => (chars.available() ? run(ctx) : ctx.msg.reply(G.NOT_READY));

// ---------- sell ----------
const sell = {
    ...base,
    name: 'sell',
    economy: true,
    run: needsData(async (ctx) => {
        const { msg, rest, settings } = ctx;
        const usage = `Uso: ${p}sell <personaje> [precio]\nEjemplo: ${p}sell Gojo 50k\nRetirarlo de la venta: ${p}unsell <personaje>`;
        if (!rest) return msg.reply(usage);

        const gid = gidOf(ctx);
        const u = await me(ctx);
        const tokens = rest.split(/\s+/);
        const last = tokens[tokens.length - 1].toLowerCase();

        let mode = 'default';
        let price = null;
        if (tokens.length > 1 && ['cancel', 'cancelar', 'off'].includes(last)) mode = 'cancel';
        else if (tokens.length > 1 && eco.parseAmount(last, 0)) {
            mode = 'price';
            price = eco.parseAmount(last, 0);
        }
        const query = mode === 'default' ? rest : tokens.slice(0, -1).join(' ');

        const c = await G.resolve(ctx, query, G.ownedBy(gid, u.key), 'No tienes un personaje con ese nombre.');
        if (!c) return;

        const sale = G.listingOf(gid, c.id);
        if (mode === 'cancel') {
            if (!sale) return msg.reply(`*${c.name}* no está en venta.`);
            G.unlist(gid, c.id);
            eco.save();
            return msg.reply(`✅ *${c.name}* ya no está en venta.`);
        }

        price = price || c.value;
        const market = G.state(gid).market;
        if (sale) {
            sale.price = price;
            eco.save();
            return msg.reply(`🏷️ Actualizaste el precio de *${c.name}*: ${eco.money(price, settings)} (#${sale.id})`);
        }

        const id = market.next++;
        market.items[id] = { id, charId: c.id, seller: u.key, sellerId: ctx.sender, price, at: Date.now() };
        eco.save();
        return msg.reply(
            `🏷️ *${c.name}* está en venta por *${eco.money(price, settings)}* (#${id}). Se ve con ${p}market\n` +
                `Para retirarlo de la venta: ${p}unsell ${c.name}`
        );
    })
};

// ---------- unsell: retirar un personaje de la venta ----------
const unsell = {
    ...base,
    name: 'unsell',
    aliases: ['cancelsell'],
    economy: true,
    run: needsData(async (ctx) => {
        const { msg, rest } = ctx;
        if (!rest) return msg.reply(`Uso: ${p}unsell <personaje>\nEjemplo: ${p}unsell Gojo`);

        const gid = gidOf(ctx);
        const u = await me(ctx);
        const c = await G.resolve(ctx, rest, G.ownedBy(gid, u.key), 'No tienes un personaje con ese nombre.');
        if (!c) return;

        if (!G.listingOf(gid, c.id)) return msg.reply(`*${c.name}* no está en venta.`);
        G.unlist(gid, c.id);
        eco.save();
        return msg.reply(`✅ *${c.name}* ya no está en venta. Vuelve a tu colección.`);
    })
};

// ---------- market ----------
const market = {
    ...base,
    name: 'market',
    economy: true,
    run: needsData(async (ctx) => {
        const { client, msg, args, settings } = ctx;
        const gid = gidOf(ctx);

        // Se descartan ventas de personajes que ya no son del vendedor
        const state = G.state(gid);
        const items = Object.values(state.market.items).filter((it) => G.ownerKey(gid, it.charId) === it.seller);
        items.sort((a, b) => b.id - a.id);
        if (!items.length) return msg.reply(`🏪 El mercado está vacío. Pon un personaje en venta con ${p}sell <personaje> [precio]`);

        const total = Math.max(1, Math.ceil(items.length / cfg.pageSize));
        const n = Math.min(total, Math.max(1, parseInt(args[0], 10) || 1));
        const slice = items.slice((n - 1) * cfg.pageSize, n * cfg.pageSize);
        const sellers = await Promise.all(slice.map((it) => eco.nameOf(client, it.seller)));

        const lines = slice.map((it, i) => {
            const c = chars.get(it.charId);
            return `#${it.id} · ${G.tierIcon(c)} ${c.name} — ${c.anime}\n   💰 ${eco.money(it.price, settings)} · vendedor: ${sellers[i]}`;
        });
        return msg.reply(
            `🏪 *Mercado* (${items.length} en venta)\n\n${lines.join('\n')}\n\nPágina ${n}/${total}\nComprar: ${p}buycharacter <#número o nombre>`
        );
    })
};

// ---------- buycharacter ----------
const buycharacter = {
    ...base,
    name: 'buycharacter',
    aliases: ['buychar'],
    economy: true,
    run: needsData(async (ctx) => {
        const { client, msg, chat, rest, settings } = ctx;
        if (!rest) return msg.reply(`Uso: ${p}buycharacter <#número o nombre>\nMira lo que hay con ${p}market`);

        const gid = gidOf(ctx);
        const state = G.state(gid);
        const valid = Object.values(state.market.items).filter((it) => G.ownerKey(gid, it.charId) === it.seller);

        let item = null;
        const num = /^#?(\d+)$/.exec(rest.trim());
        if (num) item = valid.find((it) => it.id === Number(num[1])) || null;
        else {
            const c = await G.resolve(ctx, rest, valid.map((it) => chars.get(it.charId)), 'Ese personaje no está en venta.');
            if (!c) return;
            item = valid.find((it) => it.charId === c.id);
        }
        if (!item) return msg.reply('Ese personaje no está en venta. Mira lo que hay con ' + p + 'market');

        const buyer = await me(ctx);
        const c = chars.get(item.charId);
        if (item.seller === buyer.key) return msg.reply('No puedes comprar tu propio personaje. Para quitarlo de la venta usa ' + p + 'sell <personaje> cancel');
        if (buyer.cash < item.price) {
            return msg.reply(`❌ No tienes suficiente efectivo. *${c.name}* cuesta ${eco.money(item.price, settings)} y tienes ${eco.money(buyer.cash, settings)}.`);
        }

        const seller = eco.byKey(gid, item.seller);
        buyer.cash -= item.price;
        if (seller) seller.cash += item.price;
        G.setOwner(gid, c.id, buyer.key);
        G.unlist(gid, c.id);
        eco.save();

        return say(
            ctx,
            `🛒 ${mention(ctx.sender)} compró a *${c.name}* por *${eco.money(item.price, settings)}*.\n💰 ${mention(item.sellerId)} recibió el pago.`,
            [ctx.sender, item.sellerId]
        );
    })
};

// ---------- givechar ----------
const givechar = {
    ...base,
    name: 'givechar',
    run: needsData(async (ctx) => {
        const { client, msg, rest, sender, senderExtra } = ctx;
        const usage = `Uso: ${p}givechar <personaje> @usuario (o responde a un mensaje suyo)`;
        const targets = await resolveTargets(msg);
        const query = noMentions(rest);
        if (!targets.length || !query) return msg.reply(usage);
        const targetId = targets[0];

        if (await sameUser(client, targetId, [], sender, senderExtra)) return msg.reply('No puedes regalarte un personaje a ti mismo 😅');
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) return msg.reply('Gracias, pero soy un bot 🤖');

        const gid = gidOf(ctx);
        const giver = await me(ctx);
        const c = await G.resolve(ctx, query, G.ownedBy(gid, giver.key), 'No tienes un personaje con ese nombre.');
        if (!c) return;
        if (G.listingOf(gid, c.id)) return msg.reply(`*${c.name}* está en venta. Quítalo primero con ${p}sell ${c.name} cancel`);

        const receiver = await eco.getUser(client, gid, targetId);
        G.setOwner(gid, c.id, receiver.key);
        eco.save();
        return say(ctx, `🎁 ${mention(sender)} le regaló a *${c.name}* a ${mention(targetId)}.`, [sender, targetId]);
    })
};

// ---------- trade (se responde con !acepto / !rechazo) ----------
const trade = {
    ...base,
    name: 'trade',
    run: needsData(async (ctx) => {
        const { client, msg, chat, rest, sender, senderExtra } = ctx;
        const usage = `Uso: ${p}trade @usuario <mi personaje> | <su personaje>\nEjemplo: ${p}trade @ana Gojo | Nezuko`;
        const targets = await resolveTargets(msg);
        const parts = noMentions(rest).split('|').map((s) => s.trim());
        if (!targets.length || parts.length !== 2 || !parts[0] || !parts[1]) return msg.reply(usage);
        const targetId = targets[0];

        if (await sameUser(client, targetId, [], sender, senderExtra)) return msg.reply('No puedes intercambiar contigo mismo 😅');
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) return msg.reply('Soy un bot: no coleccionó personajes 🤖');

        const gid = gidOf(ctx);
        const from = await me(ctx);
        const to = await eco.getUser(client, gid, targetId);

        const give = await G.resolve(ctx, parts[0], G.ownedBy(gid, from.key), 'No tienes un personaje con ese nombre.');
        if (!give) return;
        const get = await G.resolve(ctx, parts[1], G.ownedBy(gid, to.key), 'Esa persona no tiene un personaje con ese nombre.');
        if (!get) return;

        for (const c of [give, get]) {
            if (G.listingOf(gid, c.id)) return msg.reply(`*${c.name}* está en venta. Hay que quitarlo de la venta antes de intercambiarlo.`);
        }
        if (proposals.get(gid, to)) return msg.reply('Esa persona ya tiene una propuesta pendiente. Espera a que responda.');
        if (proposals.outstandingFrom(gid, from)) return msg.reply('Ya tienes una propuesta pendiente. Espera la respuesta.');

        proposals.create(
            {
                gid, type: 'trade', from, fromId: sender, to, toId: targetId, chat, give, get,
                expireText: `⌛ La propuesta de intercambio de ${mention(sender)} a ${mention(targetId)} expiró sin respuesta.`
            },
            cfg.tradeMs
        );

        return chat.sendMessage(
            `🔄 *Propuesta de intercambio*\n${mention(sender)} ofrece a *${give.name}* (${chars.label(give)}) por *${get.name}* (${chars.label(get)}) de ${mention(targetId)}.\n\n` +
                `${mention(targetId)}, responde con *${p}acepto* o *${p}rechazo* (tienes ${Math.round(cfg.tradeMs / 1000)} segundos).`,
            { quotedMessageId: msg.id._serialized, mentions: [sender, targetId] }
        );
    })
};

proposals.register('trade', {
    async accept(ctx, prop) {
        const { msg, chat } = ctx;
        const { gid, give, get } = prop;

        // Se vuelve a comprobar todo: pudo cambiar mientras tanto
        const valid =
            G.ownerKey(gid, give.id) === prop.from.key &&
            G.ownerKey(gid, get.id) === prop.to.key &&
            !G.listingOf(gid, give.id) &&
            !G.listingOf(gid, get.id);
        if (!valid) return msg.reply('💔 El intercambio ya no es válido: alguno de los personajes cambió de dueño o está en venta.');

        G.setOwner(gid, give.id, prop.to.key);
        G.setOwner(gid, get.id, prop.from.key);
        eco.save();

        return chat.sendMessage(
            `🤝 ¡Intercambio hecho! ${mention(prop.fromId)} recibe a *${get.name}* y ${mention(prop.toId)} recibe a *${give.name}*.`,
            { quotedMessageId: msg.id._serialized, mentions: [prop.fromId, prop.toId] }
        );
    },
    async reject(ctx, prop) {
        return ctx.chat.sendMessage(`💔 ${mention(prop.toId)} rechazó el intercambio de ${mention(prop.fromId)}.`, {
            quotedMessageId: ctx.msg.id._serialized,
            mentions: [prop.toId, prop.fromId]
        });
    }
});

module.exports = [sell, unsell, market, buycharacter, givechar, trade];
