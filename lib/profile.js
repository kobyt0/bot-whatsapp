const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Reloj sustituible en las pruebas
const clock = { fn: () => new Date() };

const pad = (n) => String(n).padStart(2, '0');

const GENRES = {
    hombre: { label: '♂️ Hombre', words: ['hombre', 'masculino', 'male', 'man', 'h'] },
    mujer: { label: '♀️ Mujer', words: ['mujer', 'femenino', 'female', 'woman', 'm'] },
    otro: { label: '⚧️ Otro', words: ['otro', 'otra', 'other', 'nobinario', 'no-binario', 'nb'] }
};

function parseGenre(raw) {
    const w = String(raw || '').toLowerCase().replace(/\s+/g, '');
    return Object.keys(GENRES).find((k) => GENRES[k].words.includes(w)) || null;
}

// "2000-5-9" -> { value: "2000-05-09" } o { error: 'formato' | 'fecha' | 'anio' | 'futura' }
function parseBirth(raw) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(raw || '').trim());
    if (!m) return { error: 'formato' };
    const [y, mo, d] = [+m[1], +m[2], +m[3]];

    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: 'fecha' };
    if (y < 1900) return { error: 'anio' };

    const t = clock.fn();
    const today = t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
    if (y * 10000 + mo * 100 + d > today) return { error: 'futura' };

    return { value: `${y}-${pad(mo)}-${pad(d)}` };
}

const split = (birth) => {
    const [y, m, d] = birth.split('-').map(Number);
    return { y, m, d };
};

function age(birth) {
    const { y, m, d } = split(birth);
    const t = clock.fn();
    let a = t.getFullYear() - y;
    if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--;
    return a;
}

const isToday = (birth) => {
    const { m, d } = split(birth);
    const t = clock.fn();
    return t.getMonth() + 1 === m && t.getDate() === d;
};

const dayMonth = (birth) => {
    const { m, d } = split(birth);
    return `${d} de ${MONTHS[m - 1]}`;
};

// Pertenece a alguien que sigue en el grupo?
function isMember(user, chat) {
    const ids = new Set();
    for (const p of chat.participants || []) {
        ids.add(p.id._serialized);
        ids.add(p.id._serialized.split('@')[0]);
    }
    return (user.aliases || []).some((a) => ids.has(a));
}

module.exports = { MONTHS, clock, GENRES, parseGenre, parseBirth, split, age, isToday, dayMonth, isMember };
