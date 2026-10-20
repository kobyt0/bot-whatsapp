const config = require('../config');
const db = require('./db');
const { PREFIX_CHARS } = require('./utils');

function isValidPrefix(p) {
    return typeof p === 'string' && p.length >= 1 && p.length <= 2 && [...p].every((c) => PREFIX_CHARS.includes(c));
}

// Prefijos válidos en un grupo: el propio del grupo, o los de config.js
function prefixesFor(settings) {
    return settings && settings.prefix ? [settings.prefix] : config.prefixes;
}

let nameRe = null;
function nameRegex() {
    if (!nameRe) {
        const names = [...require('../commands').keys()]
            .sort((a, b) => b.length - a.length)
            .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        nameRe = new RegExp(`(?<![\\w])!(?=(?:${names.join('|')})(?![\\w]))`, 'g');
    }
    return nameRe;
}

// Los textos del bot usan "!" en sus ayudas ("Uso: !mute ..."); en un grupo con otro
// prefijo, se cambian por el prefijo del grupo (solo cuando van seguidos de un comando real).
function localize(text, settings) {
    const p = settings && settings.prefix;
    if (!p || p === '!') return text;
    return text.replace(nameRegex(), () => p);
}

function outgoing(chatId, text) {
    if (typeof chatId !== 'string' || !chatId.endsWith('@g.us')) return text;
    return localize(text, db.getGroup(chatId));
}

module.exports = { isValidPrefix, prefixesFor, localize, outgoing };
