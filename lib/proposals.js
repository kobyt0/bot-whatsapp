// Propuestas pendientes entre dos personas (matrimonio, intercambios...).
// Cada persona puede tener una sola a la vez y se responde con !acepto / !rechazo.
const C = require('./casino');

const pending = new Map(); // grupo|clave de quien recibe -> propuesta
const kinds = new Map(); // tipo -> { accept(ctx, prop), reject(ctx, prop) }

const pkey = (gid, u) => `${gid}|${u.key}`;

const register = (type, handlers) => kinds.set(type, handlers);
const get = (gid, u) => pending.get(pkey(gid, u)) || null;

function outstandingFrom(gid, u) {
    for (const prop of pending.values()) if (prop.gid === gid && prop.from === u) return prop;
    return null;
}

// prop: { gid, type, from, fromId, to, toId, chat, expireText, ... }
function create(prop, ms) {
    const key = pkey(prop.gid, prop.to);
    pending.set(key, prop);
    C.setTimer(prop, ms, async () => {
        if (pending.get(key) !== prop) return;
        pending.delete(key);
        await prop.chat.sendMessage(prop.expireText, { mentions: [prop.fromId, prop.toId] });
    });
}

function drop(prop) {
    C.clearTimer(prop);
    pending.delete(pkey(prop.gid, prop.to));
}

module.exports = { register, kinds, get, outstandingFrom, create, drop };
