// Vetos: personas que NO pueden usar ninguna función del bot (en ningún grupo ni en privado).
// Se guardan en data/banned.json. De cada persona se guardan todos sus IDs conocidos
// (@c.us, @lid, número) para reconocerla aunque WhatsApp la muestre con otro formato.
const fs = require('fs');
const path = require('path');
const { aliasesOf } = require('./identity');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'banned.json');

let list = []; // [{ ids: [..], name, reason, by, at }]
try {
    if (fs.existsSync(FILE)) list = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
    console.error('No pude leer banned.json, empiezo sin vetados:', err.message);
    list = [];
}

function save() {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
        fs.renameSync(tmp, FILE);
    } catch (err) {
        console.error('No pude guardar banned.json:', err.message);
    }
}

const hits = (entry, set) => entry.ids.some((id) => set.has(id));

// Devuelve el registro de veto de esa persona, o null
async function find(client, id, extra = []) {
    if (!list.length) return null; // lo habitual: sin vetados, sin trabajo extra
    const mine = await aliasesOf(client, id, extra);
    const entry = list.find((e) => hits(e, mine));
    if (!entry) return null;

    // Si ahora aparece con un ID nuevo, se añade para reconocerla mejor la próxima vez
    const fresh = [...mine].filter((x) => !entry.ids.includes(x));
    if (fresh.length) {
        entry.ids.push(...fresh);
        save();
    }
    return entry;
}

// Veta a una persona. Devuelve false si ya estaba vetada.
async function add(client, id, { name, reason, by } = {}) {
    if (await find(client, id)) return false;
    const ids = [...(await aliasesOf(client, id))];
    list.push({ ids, name: name || id.split('@')[0], reason: reason || '', by: by || '', at: Date.now() });
    save();
    return true;
}

// Quita el veto. Devuelve el registro quitado, o null si no estaba vetada.
async function remove(client, id) {
    const entry = await find(client, id);
    if (!entry) return null;
    list = list.filter((e) => e !== entry);
    save();
    return entry;
}

const all = () => list.slice();

module.exports = { find, add, remove, all };
