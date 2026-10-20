// Texto a voz con el servicio de Google Translate (gratuito, sin clave, no oficial).
const fs = require('fs');
const path = require('path');
const media = require('./media');
const { media: cfg } = require('../config');

const LANGS = new Set(['es', 'en', 'pt', 'fr', 'it', 'de', 'ja', 'ko', 'ru', 'ca', 'nl', 'tr', 'ar', 'hi', 'pl', 'zh-CN']);

// "en: hello" -> { lang: 'en', text: 'hello' }; sin prefijo usa el idioma por defecto
function parseLang(input) {
    const m = /^([A-Za-z]{2}(?:-[A-Za-z]{2})?)\s*:\s*([\s\S]+)$/.exec((input || '').trim());
    if (m) {
        const raw = m[1];
        const lang = raw.includes('-') ? raw.slice(0, 2).toLowerCase() + '-' + raw.slice(3).toUpperCase() : raw.toLowerCase();
        if (LANGS.has(lang)) return { lang, text: m[2].trim() };
    }
    return { lang: cfg.tts.defaultLang, text: (input || '').trim() };
}

// Google acepta unos 200 caracteres por petición: se corta en frases o palabras
function splitText(text, max = 190) {
    let rest = text.replace(/\s+/g, ' ').trim();
    const out = [];
    while (rest.length > max) {
        const window = rest.slice(0, max + 1);
        let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '), window.lastIndexOf(', '));
        if (cut < max * 0.5) cut = window.lastIndexOf(' ');
        if (cut < max * 0.3) cut = max - 1;
        out.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
    return out;
}

async function fetchChunk(text, lang) {
    const url =
        'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
        encodeURIComponent(lang) +
        '&q=' +
        encodeURIComponent(text);

    let res;
    try {
        res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://translate.google.com/' },
            signal: AbortSignal.timeout(20000)
        });
    } catch (err) {
        throw media.userError('No pude conectar con el servicio de voz. Revisa tu conexión a internet.');
    }

    if (res.status === 429) {
        throw media.userError('El servicio de voz limitó las solicitudes. Inténtalo de nuevo en unos minutos.');
    }
    if (!res.ok) throw media.userError(`El servicio de voz respondió con error (${res.status}).`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw media.userError('El servicio de voz no devolvió audio.');
    return buf;
}

// Devuelve la ruta de un .ogg (opus) listo para enviarse como nota de voz
async function synthesize(text, lang, dir) {
    const chunks = splitText(text);
    const files = [];
    for (let i = 0; i < chunks.length; i++) {
        const f = path.join(dir, `c${i}.mp3`);
        await fs.promises.writeFile(f, await fetchChunk(chunks[i], lang));
        files.push(f);
    }

    const out = path.join(dir, 'voice.ogg');
    const args = ['-y', '-loglevel', 'error'];
    if (files.length === 1) {
        args.push('-i', files[0]);
    } else {
        const list = path.join(dir, 'list.txt');
        await fs.promises.writeFile(
            list,
            files.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n')
        );
        args.push('-f', 'concat', '-safe', '0', '-i', list);
    }
    args.push('-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', out);

    await media.runBin(cfg.ffmpegPath, args, { timeout: 120000 });
    return out;
}

module.exports = { parseLang, splitText, synthesize, LANGS };
