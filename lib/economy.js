const fs = require('fs');
const path = require('path');
const { aliasesOf } = require('./identity');
const { economy: cfg } = require('../config');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'economy.json');
const ACT_FILE = path.join(DIR, 'activity.json');

let data = {}; // { [grupo]: { users: { [clave]: usuario } } }
let activity = {}; // { [grupo]: { [id]: momento } } última vez que escribió cada persona
const indexes = new Map(); // grupo -> Map(alias -> clave)

// Aleatoriedad (se puede sustituir en las pruebas)
const rng = { fn: Math.random };
const randInt = (min, max) => Math.floor(rng.fn() * (max - min + 1)) + min;
const chance = (p) => rng.fn() < p;
const pick = (arr) => arr[Math.floor(rng.fn() * arr.length)];
const nice = (n) => (n >= 100 ? Math.round(n / 10) * 10 : n); // montos "redondos"

// ---------- persistencia ----------
function readJson(file, fallback) {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`No pude leer ${path.basename(file)}, empiezo vacío:`, err.message);
    }
    return fallback;
}

function writeJson(file, obj) {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(obj));
        fs.renameSync(tmp, file);
    } catch (err) {
        console.error(`No pude guardar ${path.basename(file)}:`, err.message);
    }
}

// Guardar toda la economía en cada mensaje sería excesivo: los contadores de mensajes se marcan
// como "pendientes" y se escriben cada pocos segundos (y al cerrar el bot).
let dirty = false;
const save = () => {
    dirty = false;
    writeJson(FILE, data);
};
const markDirty = () => {
    dirty = true;
};
function flush() {
    if (dirty) save();
}
setInterval(flush, 15000).unref();
process.on('exit', flush);

// Carga lo guardado la última vez
data = readJson(FILE, {});
activity = readJson(ACT_FILE, {});

// Si el bot se cerró en mitad de una partida, la apuesta ya descontada se devuelve
(function recoverGames() {
    let count = 0;
    for (const g of Object.values(data)) {
        for (const u of Object.values((g && g.users) || {})) {
            if (u.game) {
                u.cash += u.game.paid || 0;
                delete u.game;
                count++;
            }
        }
    }
    if (count) {
        writeJson(FILE, data);
        console.log(`[economía] ${count} partida(s) interrumpida(s): se devolvieron las apuestas.`);
    }
})();

let actDirty = false;
function flushActivity() {
    if (!actDirty) return;
    actDirty = false;
    writeJson(ACT_FILE, activity);
}
setInterval(flushActivity, 60000).unref();
process.on('exit', flushActivity);

// ---------- usuarios ----------
const group = (gid) => data[gid] || (data[gid] = { users: {} });

function index(gid) {
    let idx = indexes.get(gid);
    if (!idx) {
        idx = new Map();
        for (const [key, u] of Object.entries(group(gid).users)) {
            u.key = key; // cada registro conoce su propia clave (la usan parejas, etc.)
            idx.set(key, key);
            for (const a of u.aliases || []) idx.set(a, key);
        }
        indexes.set(gid, idx);
    }
    return idx;
}

const newUser = () => ({ cash: 0, bank: 0, streak: 0, cd: {}, aliases: [] });

// Devuelve (y crea si hace falta) el registro de una persona en un grupo.
// Una misma persona puede llegar como @lid o como @c.us: se reconoce por sus alias.
async function getUser(client, gid, id, extra = []) {
    const g = group(gid);
    const idx = index(gid);
    if (idx.has(id)) return g.users[idx.get(id)];

    const aliases = await aliasesOf(client, id, extra);
    for (const a of aliases) {
        if (idx.has(a)) {
            const key = idx.get(a);
            const u = g.users[key];
            u.aliases = [...new Set([...(u.aliases || []), id, ...aliases])];
            for (const x of u.aliases) idx.set(x, key);
            save();
            return u;
        }
    }

    const u = newUser();
    u.key = id;
    u.aliases = [...new Set([id, ...aliases])];
    g.users[id] = u;
    for (const x of u.aliases) idx.set(x, id);
    save();
    return u;
}

const allUsers = (gid) => Object.entries(group(gid).users);
const groupData = (gid) => group(gid); // datos del grupo (personajes, mercado...)

// Como getUser, pero sin crear nada: devuelve null si esa persona no tiene registro
async function findUser(client, gid, id, extra = []) {
    const g = group(gid);
    const idx = index(gid);
    if (idx.has(id)) return g.users[idx.get(id)];
    for (const a of await aliasesOf(client, id, extra)) {
        if (idx.has(a)) return g.users[idx.get(a)];
    }
    return null;
}

const byKey = (gid, key) => group(gid).users[key] || null;

// ---------- contador de mensajes (solo números: nunca el contenido) ----------
const pad2 = (n) => String(n).padStart(2, '0');
function dayKey(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
const KEEP_DAYS = 60;

// u.act = { total, last, days: { 'AAAA-MM-DD': cantidad } }
async function countMessage(client, gid, id, extra = []) {
    const u = await getUser(client, gid, id, extra);
    const a = u.act || (u.act = { total: 0, last: 0, days: {} });
    const now = Date.now();
    const key = dayKey(now);

    a.total++;
    a.last = now;
    a.days[key] = (a.days[key] || 0) + 1;

    if (a.pruned !== key) {
        a.pruned = key; // una vez al día se borran los días de hace más de 60
        const cutoff = dayKey(now - KEEP_DAYS * 86400e3);
        for (const d of Object.keys(a.days)) if (d < cutoff) delete a.days[d];
    }
    dirty = true;
    return u;
}

// Mensajes enviados en los últimos N días (contando hoy)
function messagesIn(u, days) {
    if (!u.act) return 0;
    const since = dayKey(Date.now() - (days - 1) * 86400e3);
    let n = 0;
    for (const [d, c] of Object.entries(u.act.days)) if (d >= since) n += c;
    return n;
}

// ---------- actividad (para la regla de inactividad de !robar) ----------
function touch(gid, ids) {
    const a = activity[gid] || (activity[gid] = {});
    const now = Date.now();
    for (const raw of ids) {
        const s = typeof raw === 'string' ? raw : raw && raw._serialized;
        if (!s) continue;
        a[s] = now;
        a[s.split('@')[0]] = now;
    }
    actDirty = true;
}

// Último momento en que escribió esa persona, o null si no se sabe
async function lastActive(client, gid, id) {
    const a = activity[gid];
    if (!a) return null;
    let best = null;
    for (const alias of await aliasesOf(client, id)) {
        if (a[alias] && (best === null || a[alias] > best)) best = a[alias];
    }
    return best;
}

// ---------- tiempos de espera ----------
function remaining(u, key, ms) {
    const left = (u.cd[key] || 0) + ms - Date.now();
    return left > 0 ? left : 0;
}
const stamp = (u, key) => {
    u.cd[key] = Date.now();
};

// ---------- formato ----------
const fmt = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const coinName = (settings) => (settings && settings.coinName) || cfg.currencyDefault;
const money = (n, settings) => `${fmt(n)} ${coinName(settings)}`;

// "all", "half", "1500", "10.000", "10k", "1.5k", "2m" -> número entero o null
function parseAmount(raw, available = 0) {
    const t = String(raw || '').toLowerCase().replace(/\s/g, '');
    if (['all', 'todo', 'todos'].includes(t)) return available;
    if (['half', 'mitad'].includes(t)) return Math.floor(available / 2);

    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return parseInt(t.replace(/[.,]/g, ''), 10);

    const m = /^(\d+(?:[.,]\d+)?)(k|m)?$/.exec(t);
    if (!m) return null;
    if (!m[2] && /[.,]/.test(m[1])) return null; // decimales sin k/m no tienen sentido
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] === 'k') n *= 1e3;
    if (m[2] === 'm') n *= 1e6;
    n = Math.floor(n);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// Nombre para mostrar de alguien (sin mencionarlo)
async function nameOf(client, id) {
    try {
        const c = await client.getContactById(id);
        const n = c.pushname || c.name;
        if (n) return n;
        if (c.number) return '+' + c.number;
    } catch (_) {}
    return id.endsWith('@c.us') ? '+' + id.split('@')[0] : 'Usuario ' + id.split('@')[0].slice(-4);
}

const resetHooks = [];
const onReset = (fn) => resetHooks.push(fn);

function resetGroup(gid) {
    for (const u of Object.values(group(gid).users)) {
        u.cash = 0;
        u.bank = 0;
        u.streak = 0;
        u.cd = {};
        delete u.game;
        delete u.raspa;
    }
    for (const fn of resetHooks) fn(gid);
    save();
}

module.exports = {
    rng, randInt, chance, pick, nice,
    getUser, findUser, byKey, allUsers, groupData, save, resetGroup, onReset,
    touch, lastActive, flushActivity,
    countMessage, messagesIn, dayKey, markDirty, flush,
    remaining, stamp,
    fmt, coinName, money, parseAmount, nameOf,
    cfg
};
