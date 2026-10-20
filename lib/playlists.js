const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'playlists.json');

// { [usuario]: { [nombreEnMinúsculas]: { name, songs: [{title, url, duration}], createdAt } } }
let data = {};

function load() {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        if (fs.existsSync(FILE)) data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (err) {
        console.error('No pude leer playlists.json, empiezo vacío:', err.message);
        data = {};
    }
}

function save() {
    try {
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, FILE);
    } catch (err) {
        console.error('No pude guardar playlists.json:', err.message);
    }
}

const userKey = (ctx) => ctx.sender.split('@')[0];

function getUser(key) {
    if (!data[key]) data[key] = {};
    return data[key];
}

function cleanName(raw) {
    return String(raw || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
}

const keyOf = (name) => cleanName(name).toLowerCase();

function find(lists, name) {
    return lists[keyOf(name)] || null;
}

const totalSeconds = (pl) => pl.songs.reduce((sum, s) => sum + (s.duration || 0), 0);

load();

module.exports = { userKey, getUser, cleanName, keyOf, find, totalSeconds, save };
