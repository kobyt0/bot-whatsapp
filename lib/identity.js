// WhatsApp está migrando de IDs con número (@c.us) a IDs anónimos (@lid).
// Un mismo usuario puede aparecer con formatos distintos según el evento,
// así que en vez de comparar IDs exactos, comparamos "alias" (todos los IDs
// conocidos de esa persona).
const { owners } = require('../config');

const cache = new Map();
const TTL = 10 * 60 * 1000;

function addTo(set, value) {
    if (!value) return;
    const s = typeof value === 'string' ? value : value._serialized;
    if (!s) return;
    set.add(s);
    set.add(s.split('@')[0]);
}

async function resolveBase(client, id) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < TTL) return hit.set;

    const set = new Set();
    addTo(set, id);

    // Disponible en versiones recientes de whatsapp-web.js
    try {
        if (typeof client.getContactLidAndPhone === 'function') {
            const res = await client.getContactLidAndPhone([id]);
            for (const r of res || []) {
                addTo(set, r.lid);
                addTo(set, r.pn);
            }
        }
    } catch (_) {}

    try {
        const contact = await client.getContactById(id);
        if (contact) {
            addTo(set, contact.id);
            if (contact.number) addTo(set, `${contact.number}@c.us`);
        }
    } catch (_) {}

    cache.set(id, { at: Date.now(), set });
    return set;
}

async function aliasesOf(client, id, extra = []) {
    const set = new Set(await resolveBase(client, id));
    for (const e of extra) addTo(set, e);
    return set;
}

function intersects(a, b) {
    for (const x of a) if (b.has(x)) return true;
    return false;
}

async function matchGroupAdmin(client, chat, mine) {
    for (const p of chat.participants || []) {
        if (!(p.isAdmin || p.isSuperAdmin)) continue;
        const theirs = await aliasesOf(client, p.id._serialized);
        if (intersects(mine, theirs)) return true;
    }
    return false;
}

// ¿Es admin real del grupo? (sin contar la lista "owners" de config.js)
async function isGroupAdmin(client, chat, id, extra = []) {
    return matchGroupAdmin(client, chat, await aliasesOf(client, id, extra));
}

// Admin del grupo o dueño del bot definido en config.js
async function isAdmin(client, chat, id, extra = []) {
    const mine = await aliasesOf(client, id, extra);

    if (owners.some((o) => mine.has(String(o)) || mine.has(String(o).split('@')[0]))) {
        return true;
    }
    return matchGroupAdmin(client, chat, mine);
}

function botExtra(client) {
    return client.info && client.info.lid ? [client.info.lid] : [];
}

async function isBotAdmin(client, chat) {
    return isAdmin(client, chat, client.info.wid._serialized, botExtra(client));
}

// ¿Es "a" la misma persona que "b"?
async function sameUser(client, a, extraA, b, extraB = []) {
    if (a === b) return true;
    const [sa, sb] = await Promise.all([aliasesOf(client, a, extraA), aliasesOf(client, b, extraB)]);
    return intersects(sa, sb);
}

// Busca si "id" tiene un mute activo y devuelve la clave guardada (o null)
async function findMuteKey(client, settings, id, extra = []) {
    if (settings.mutes[id]) return id;
    const keys = Object.keys(settings.mutes);
    if (!keys.length) return null;
    const mine = await aliasesOf(client, id, extra);
    for (const key of keys) {
        const theirs = await aliasesOf(client, key);
        if (intersects(mine, theirs)) return key;
    }
    return null;
}

module.exports = { aliasesOf, isAdmin, isGroupAdmin, isBotAdmin, botExtra, sameUser, findMuteKey };
