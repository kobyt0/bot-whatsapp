const { prefixes } = require('../config');

// "Cumpleaños" -> "cumpleanos" (sin acentos ni mayúsculas): así se escriba como se escriba, es el mismo comando
const normalizeName = (s) =>
    String(s)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

// Símbolos permitidos como prefijo de comandos
const PREFIX_CHARS = '!#$%&*+-./:;<=>?^_~,|';

// "!mute 1h @user" -> { name: 'mute', args: ['1h', '@user'], rest: '1h @user' }
function parseCommand(body, list = prefixes) {
    const text = (body || '').trim();
    const prefix = list.find((p) => text.startsWith(p));
    if (!prefix) return null;

    const withoutPrefix = text.slice(prefix.length);
    const [rawName, ...args] = withoutPrefix.split(/\s+/);
    if (!rawName) return null;

    return {
        name: normalizeName(rawName),
        args,
        rest: withoutPrefix.slice(rawName.length).trim()
    };
}

function getSenderId(client, msg) {
    if (msg.fromMe) return client.info.wid._serialized;
    return msg.author || msg.from;
}

// on/off -> true/false, cualquier otra cosa -> null
function parseOnOff(value) {
    const v = (value || '').toLowerCase();
    if (['on', '1', 'true', 'activar', 'enable'].includes(v)) return true;
    if (['off', '0', 'false', 'desactivar', 'disable'].includes(v)) return false;
    return null;
}

// "30m", "1h", "1d", "1w" -> milisegundos
function parseDuration(str) {
    const m = /^(\d+)(m|h|d|w)$/i.exec(str || '');
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n <= 0) return null;
    const unit = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 }[m[2].toLowerCase()];
    return n * unit;
}

function formatDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '<1m';
}

// 215 -> "3:35", 3725 -> "1:02:05"
function fmtClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// 93784 -> "1d 2h 3m 4s"
function formatUptime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(' ');
}

// Si un texto empieza con un prefijo de comando, antepone un carácter invisible para que
// el bot nunca ejecute como comando lo que él mismo envía.
function neutralize(text) {
    const t = String(text);
    const first = t.trimStart()[0];
    const looksLikeCommand = first && (PREFIX_CHARS.includes(first) || prefixes.some((p) => t.trimStart().startsWith(p)));
    return looksLikeCommand ? '\u200B' + t : t;
}

// 4980000 -> "1h 23m 0s" (tiempos de espera, con segundos)
function formatWait(ms) {
    const s = Math.max(1, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h && `${h}h`, (h || m) && `${m}m`, `${sec}s`].filter(Boolean).join(' ');
}

module.exports = {
    parseCommand,
    getSenderId,
    parseOnOff,
    parseDuration,
    formatDuration,
    fmtClock,
    formatUptime,
    formatWait,
    neutralize,
    normalizeName,
    PREFIX_CHARS
};
