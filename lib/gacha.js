const eco = require('./economy');
const chars = require('./characters');
const C = require('./casino');
const { gacha: cfg } = require('../config');

const NOT_READY =
    '📭 Todavía no hay personajes cargados. En la carpeta del bot ejecuta *node tools/seed-characters.js* y reinicia el bot.';

// ---------- estado por grupo (se guarda con la economía) ----------
function state(gid) {
    const g = eco.groupData(gid);
    if (!g.chars) g.chars = {}; // { idPersonaje: { owner: claveUsuario, at } }
    if (!g.market) g.market = { next: 1, items: {} }; // items: { id: { id, charId, seller, sellerId, price, at } }
    return g;
}

const ownerKey = (gid, id) => (state(gid).chars[id] || {}).owner || null;
const setOwner = (gid, id, key) => (state(gid).chars[id] = { owner: key, at: Date.now() });

function listingOf(gid, charId) {
    return Object.values(state(gid).market.items).find((it) => it.charId === charId) || null;
}

function unlist(gid, charId) {
    const items = state(gid).market.items;
    for (const [k, it] of Object.entries(items)) if (it.charId === charId) delete items[k];
}

function release(gid, charId) {
    delete state(gid).chars[charId];
    unlist(gid, charId);
}

// Personajes de una persona, de más a menos valioso
function ownedBy(gid, key) {
    return Object.entries(state(gid).chars)
        .filter(([, o]) => o.owner === key)
        .map(([id]) => chars.get(Number(id)))
        .filter(Boolean)
        .sort((a, b) => b.value - a.value || a.rank - b.rank);
}

const totalValue = (list) => list.reduce((s, c) => s + c.value, 0);
const tierIcon = (c) => chars.label(c).split(' ')[0];

// ---------- tiradas pendientes de reclamar ----------
const pending = new Map(); // gid -> [propuestas]
const pendingList = (gid) => pending.get(gid) || [];
const reservedIds = (gid) => new Set(pendingList(gid).map((p) => p.char.id));

function addPending(prop, ms, onExpire) {
    if (!pending.has(prop.gid)) pending.set(prop.gid, []);
    pending.get(prop.gid).push(prop);
    C.setTimer(prop, ms, async () => {
        if (!pendingList(prop.gid).includes(prop)) return;
        removePending(prop);
        await onExpire();
    });
}

function removePending(prop) {
    C.clearTimer(prop);
    const list = pendingList(prop.gid).filter((p) => p !== prop);
    if (list.length) pending.set(prop.gid, list);
    else pending.delete(prop.gid);
}

// ---------- tirar y reclamar ----------
// Elige un personaje libre: primero el nivel (según los pesos) y luego uno de ese nivel
function pick(gid) {
    const owned = state(gid).chars;
    const reserved = reservedIds(gid);
    const free = chars.all().filter((c) => !owned[c.id] && !reserved.has(c.id));
    if (!free.length) return null;

    const byTier = {};
    for (const c of free) (byTier[c.tier] = byTier[c.tier] || []).push(c);

    const tiers = Object.keys(byTier);
    const total = tiers.reduce((s, t) => s + cfg.tiers[t].weight, 0);
    let r = eco.rng.fn() * total;
    let chosen = tiers[tiers.length - 1];
    for (const t of tiers) {
        r -= cfg.tiers[t].weight;
        if (r < 0) {
            chosen = t;
            break;
        }
    }
    const group = byTier[chosen];
    return group[Math.floor(eco.rng.fn() * group.length)];
}

const gstate = (u) => u.gacha || (u.gacha = {});

function rollWait(u) {
    const g = gstate(u);
    const w = cfg.roll;
    const now = Date.now();
    if (!g.rollStart || now - g.rollStart >= w.windowMs) return 0;
    return g.rolls >= w.max ? g.rollStart + w.windowMs - now : 0;
}

function useRoll(u) {
    const g = gstate(u);
    const now = Date.now();
    if (!g.rollStart || now - g.rollStart >= cfg.roll.windowMs) {
        g.rollStart = now;
        g.rolls = 0;
    }
    g.rolls++;
}

function refundRoll(u) {
    const g = gstate(u);
    if (g.rolls > 0) g.rolls--;
}

const claimWait = (u) => Math.max(0, (gstate(u).claimAt || 0) + cfg.claim.cooldownMs - Date.now());
const stampClaim = (u) => (gstate(u).claimAt = Date.now());

// ---------- búsqueda de personajes con respuesta al usuario ----------
async function resolve(ctx, query, among, whenEmpty) {
    const r = chars.find(query, among);
    if (r.match) return r.match;
    if (!r.candidates.length) {
        await ctx.msg.reply(whenEmpty || 'No encontré ese personaje.');
        return null;
    }
    await ctx.msg.reply(
        'Encontré varios, sé más específico:\n' + r.candidates.map((c) => `• ${c.name} (${c.anime})`).join('\n')
    );
    return null;
}

module.exports = {
    NOT_READY, state, ownerKey, setOwner, listingOf, unlist, release, ownedBy, totalValue, tierIcon,
    pendingList, addPending, removePending, pick, rollWait, useRoll, refundRoll, claimWait, stampClaim, resolve
};
