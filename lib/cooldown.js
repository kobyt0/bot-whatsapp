const last = new Map();

function prune(now) {
    if (last.size > 2000) {
        for (const [k, t] of last) if (now - t > 600000) last.delete(k);
    }
}

// Devuelve true si ya pasó "ms" desde la última vez que se usó esta clave
function ready(key, ms) {
    const now = Date.now();
    prune(now);
    const t = last.get(key);
    if (ms > 0 && t && now - t < ms) return false;
    last.set(key, now);
    return true;
}

// Devuelve 0 si se puede (y registra el uso) o los ms que faltan
function check(key, ms) {
    const now = Date.now();
    prune(now);
    const t = last.get(key);
    if (ms > 0 && t && now - t < ms) return ms - (now - t);
    last.set(key, now);
    return 0;
}

module.exports = { ready, check };
