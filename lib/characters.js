// Base de personajes (data/characters.json, creada con tools/seed-characters.js)
const fs = require('fs');
const path = require('path');
const { tiers: TIERS } = require('../config').gacha;

let FILE = path.join(__dirname, '..', 'data', 'characters.json');
let list = []; // ordenados por popularidad (rank 1 = el más popular)
let byId = new Map();
let animes = new Map(); // título normalizado -> { title, chars: [] }

const norm = (s) =>
    String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

function tierFor(rank, total) {
    const f = rank / total;
    return Object.keys(TIERS).find((t) => f <= TIERS[t].cut) || 'comun';
}

function load(file) {
    if (file) FILE = file;
    list = [];
    byId = new Map();
    animes = new Map();

    let raw = [];
    try {
        raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (_) {
        return 0; // sin archivo: el sistema avisa que falta ejecutar el script
    }

    list = raw
        .filter((c) => c && c.id && c.name && c.anime && c.image)
        .sort((a, b) => (b.fav || 0) - (a.fav || 0))
        .map((c, i) => ({ ...c, rank: i + 1, alt: c.alt || [], native: c.native || '' }));

    // Nivel y valor según la popularidad
    const members = {};
    for (const c of list) {
        c.tier = tierFor(c.rank, list.length);
        (members[c.tier] = members[c.tier] || []).push(c);
    }
    for (const [t, group] of Object.entries(members)) {
        group.forEach((c, p) => {
            const factor = 1.2 - 0.4 * (group.length > 1 ? p / (group.length - 1) : 0.5);
            c.value = Math.max(100, Math.round((TIERS[t].base * factor) / 100) * 100);
        });
    }

    for (const c of list) {
        byId.set(c.id, c);
        c.search = norm([c.name, c.native, ...c.alt].join(' '));
        c.nameNorm = norm(c.name);
        const key = norm(c.anime);
        if (!animes.has(key)) animes.set(key, { title: c.anime, chars: [] });
        animes.get(key).chars.push(c);
    }
    return list.length;
}

load();

const available = () => list.length > 0;
const all = () => list;
const get = (id) => byId.get(id) || null;
const label = (c) => TIERS[c.tier].label;

// Busca por nombre (sin acentos ni mayúsculas). among: lista opcional para restringir.
// -> { match } si hay uno solo, o { candidates } si hay varios / ninguno
function find(query, among) {
    const pool = among || list;
    const q = norm(query);
    if (!q) return { candidates: [] };

    const exact = pool.filter((c) => c.nameNorm === q || norm(c.native) === q);
    if (exact.length === 1) return { match: exact[0] };

    const tokens = q.split(' ');
    const found = pool.filter((c) => tokens.every((t) => c.search.includes(t)));
    if (found.length === 1) return { match: found[0] };
    return { candidates: (exact.length ? exact : found).slice(0, 6) };
}

function findAnime(query) {
    const q = norm(query);
    if (!q) return { candidates: [] };
    if (animes.has(q)) return { match: animes.get(q) };

    const tokens = q.split(' ');
    const found = [...animes.entries()].filter(([k]) => tokens.every((t) => k.includes(t))).map(([, v]) => v);
    if (found.length === 1) return { match: found[0] };
    return { candidates: found.slice(0, 8) };
}

const animeList = () => [...animes.values()].sort((a, b) => b.chars.length - a.chars.length || a.title.localeCompare(b.title));

module.exports = { load, available, all, get, label, find, findAnime, animeList, norm };
