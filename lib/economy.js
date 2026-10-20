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
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(obj));
        fs.renameSync(tmp, file);
    } catch (err) {
        console.error(`No pude guardar ${path.basename(file)}:`, err.message);
    }
}

const save = () => writeJson(FILE, data);

let actDirty = false;
function flushActivity() {
    if (!actDirty) return;
    actDirty = false;
    writeJson(ACT_FILE, activity);
}
setInterval(flushActivity, 60000).unref();

// ---------- usuarios ----------
const group = (gid) => data[gid] || (data[gid] = { users: {} });

function index(gid) {
    let idx = indexes.get(gid);
    if (!idx) {
        idx = new Map();
        for (const [key, u] of Object.entries(group(gid).users)) {
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
    u.aliases = [...new Set([id, ...aliases])];
    g.users[id] = u;
    for (const x of u.aliases) idx.set(x, id);
    save();
    return u;
}

const allUsers = (gid) => Object.entries(group(gid).users);

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

function resetGroup(gid) {
    for (const u of Object.values(group(gid).users)) {
        u.cash = 0;
        u.bank = 0;
        u.streak = 0;
        u.cd = {};
    }
    save();
}

module.exports = {
    rng, randInt, chance, pick, nice,
    getUser, allUsers, save, resetGroup,
    touch, lastActive, flushActivity,
    remaining, stamp,
    fmt, coinName, money, parseAmount, nameOf,
    cfg
};
