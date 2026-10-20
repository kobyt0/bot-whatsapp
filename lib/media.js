// Envoltorio de yt-dlp y ffmpeg: descargas, límites, cola y limpieza.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { media: cfg } = require('../config');
const { fmtClock } = require('./utils');

const HOSTS = {
    youtube: ['youtube.com', 'youtu.be'],
    tiktok: ['tiktok.com']
};

// Error con un mensaje listo para mostrar al usuario
function userError(message) {
    const e = new Error(message);
    e.userMessage = message;
    return e;
}

function runBin(bin, args, { timeout = 300000 } = {}) {
    return new Promise((resolve, reject) => {
        // execFile sin shell: los argumentos no se interpretan, no hay inyección de comandos
        execFile(
            bin,
            args,
            {
                timeout,
                maxBuffer: 20 * 1024 * 1024,
                windowsHide: true,
                // Que Python (yt-dlp) escriba en UTF-8 aunque la consola de Windows use otra codificación
                env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
            },
            (err, stdout, stderr) => {
                if (err) {
                    err.stdout = stdout;
                    err.stderr = stderr;
                    return reject(err);
                }
                resolve({ stdout, stderr });
            }
        );
    });
}

// ---------- URLs ----------
function isHttpUrl(text) {
    try {
        const u = new URL(text);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isAllowedUrl(text, domains) {
    if (!isHttpUrl(text)) return false;
    const host = new URL(text).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith('.' + d));
}

// URL permitida o texto de búsqueda -> argumento para yt-dlp
function toTarget(text, domains) {
    const t = (text || '').trim();
    if (isHttpUrl(t)) {
        if (!isAllowedUrl(t, domains)) throw userError('Ese enlace no es de un sitio compatible.');
        return t;
    }
    return `ytsearch1:${t.replace(/\s+/g, ' ').slice(0, 150)}`;
}

// ---------- yt-dlp ----------
function baseArgs(withJs) {
    const a = ['--no-playlist', '--no-warnings', '--no-progress', '--ignore-config', '--restrict-filenames'];
    if (withJs && cfg.jsRuntimes) a.push('--js-runtimes', cfg.jsRuntimes);
    if (cfg.cookiesFile) a.push('--cookies', cfg.cookiesFile);
    if (cfg.ffmpegPath && cfg.ffmpegPath !== 'ffmpeg') a.push('--ffmpeg-location', cfg.ffmpegPath);
    return a;
}

async function ytdlp(args, timeout) {
    try {
        return await runBin(cfg.ytdlpPath, [...baseArgs(true), ...args], { timeout });
    } catch (err) {
        // yt-dlp antiguo que no conoce --js-runtimes: reintenta sin él
        if (cfg.jsRuntimes && /js-runtimes/i.test(err.stderr || '') && /no such option|unrecognized/i.test(err.stderr || '')) {
            return runBin(cfg.ytdlpPath, [...baseArgs(false), ...args], { timeout });
        }
        throw err;
    }
}

function friendlyError(err) {
    const s = `${err.stderr || ''} ${err.message || ''}`;
    if (err.code === 'ENOENT') {
        return /ffmpeg/i.test(err.path || '')
            ? 'Falta ffmpeg en el equipo donde corre el bot.'
            : 'Falta yt-dlp en el equipo donde corre el bot.';
    }
    if (err.killed || err.signal === 'SIGTERM') return 'La descarga tardó demasiado y se canceló.';
    if (/ffmpeg|ffprobe/i.test(s) && /not found|not installed|requires/i.test(s)) {
        return 'Falta ffmpeg en el equipo donde corre el bot.';
    }
    if (/confirm your age|age.restricted/i.test(s)) return 'El video tiene restricción de edad.';
    if (/not a bot|Sign in to confirm/i.test(s)) {
        return 'YouTube pidió verificación anti-bots. El dueño del bot debe configurar cookies.';
    }
    if (/Private video/i.test(s)) return 'El video es privado.';
    if (/Video unavailable|not available|has been removed|no longer available/i.test(s)) {
        return 'El video no está disponible.';
    }
    if (/Unsupported URL/i.test(s)) return 'Ese enlace no es compatible.';
    if (/HTTP Error 403|\b403\b/.test(s)) {
        return 'El sitio rechazó la descarga (403). El dueño del bot debería actualizar yt-dlp.';
    }
    if (/No video formats|no suitable|Requested format is not available/i.test(s)) {
        return 'No encontré un formato descargable (puede ser una publicación de fotos).';
    }
    return 'No pude descargarlo. Inténtalo de nuevo más tarde.';
}

async function checkTools() {
    const out = { ytdlp: null, ffmpeg: null };
    try {
        out.ytdlp = (await runBin(cfg.ytdlpPath, ['--version'], { timeout: 15000 })).stdout.trim();
    } catch (_) {}
    try {
        out.ffmpeg = (await runBin(cfg.ffmpegPath, ['-version'], { timeout: 15000 })).stdout.split('\n')[0];
    } catch (_) {}
    return out;
}

// Título, URL canónica y duración (segundos o null si es directo / desconocida)
async function getInfo(target) {
    // %(title)j devuelve el título como JSON con escapes (\u00e9), así los acentos
    // sobreviven aunque la consola de Windows use otra codificación.
    const { stdout } = await ytdlp(
        ['--skip-download', '--print', '%(title)j|||%(webpage_url)s|||%(duration)s', '--', target],
        60000
    );
    const line = stdout.split('\n').map((l) => l.trim()).find(Boolean);
    const m = line && /^(.*)\|\|\|(.*)\|\|\|(.*)$/.exec(line);
    if (!m) throw userError('No encontré resultados.');

    let title = m[1];
    try {
        const parsed = JSON.parse(title);
        title = typeof parsed === 'string' ? parsed : '';
    } catch (_) {}

    const duration = parseFloat(m[3]);
    return {
        title: title || 'Sin título',
        url: m[2],
        duration: Number.isFinite(duration) ? duration : null
    };
}

function assertDuration(info, maxMin, { allowUnknown = false } = {}) {
    if (info.duration == null) {
        if (allowUnknown) return;
        throw userError('No puedo descargar transmisiones en vivo ni contenido sin duración.');
    }
    if (info.duration > maxMin * 60) {
        throw userError(`Es demasiado largo (${fmtClock(info.duration)}). El máximo es ${maxMin} min.`);
    }
}

async function assertSize(file, maxMB) {
    const { size } = await fs.promises.stat(file);
    if (size > maxMB * 1024 * 1024) {
        throw userError(`El archivo pesa ${(size / 1048576).toFixed(1)} MB y el máximo es ${maxMB} MB.`);
    }
}

function pickFile(files, exts) {
    for (const e of exts) {
        const f = files.find((x) => x.toLowerCase().endsWith(e));
        if (f) return f;
    }
    return files[0];
}

async function download(target, dir, extraArgs, exts, maxMB) {
    await ytdlp(
        [...extraArgs, '--max-filesize', `${maxMB}M`, '-o', path.join(dir, '%(id)s.%(ext)s'), '--', target],
        300000
    );
    const files = (await fs.promises.readdir(dir)).filter((f) => !/\.(part|ytdl|temp)$/i.test(f));
    if (!files.length) {
        throw userError('No se generó ningún archivo (puede superar el tamaño máximo o no estar disponible).');
    }
    return path.join(dir, pickFile(files, exts));
}

const VIDEO_FORMATS = {
    360: 'b[height<=360][ext=mp4]/bv*[height<=360][vcodec^=avc1]+ba[ext=m4a]/b[height<=360]',
    720: 'bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[height<=720]'
};

function downloadVideo(url, dir, quality = 360) {
    const fmt = VIDEO_FORMATS[quality] || VIDEO_FORMATS[360];
    return download(url, dir, ['-f', fmt, '--merge-output-format', 'mp4'], ['.mp4', '.mkv', '.webm'], cfg.maxVideoMB);
}

// TikTok: se deja la selección de formato por defecto de yt-dlp
function downloadTikTok(url, dir) {
    return download(url, dir, ['--merge-output-format', 'mp4'], ['.mp4', '.mkv', '.webm'], cfg.maxVideoMB);
}

function downloadAudio(url, dir) {
    return download(url, dir, ['-x', '--audio-format', 'mp3', '--audio-quality', '5'], ['.mp3'], cfg.maxAudioMB);
}

function ffprobeBin() {
    if (cfg.ffprobePath) return cfg.ffprobePath;
    if (cfg.ffmpegPath === 'ffmpeg') return 'ffprobe';
    return path.join(path.dirname(cfg.ffmpegPath), 'ffprobe' + path.extname(cfg.ffmpegPath));
}

// WhatsApp solo reproduce bien mp4 con video H.264. Si el archivo es otro códec
// (TikTok a veces usa HEVC) o no es mp4, se recodifica.
async function ensureH264(file, dir) {
    let codec;
    try {
        const { stdout } = await runBin(
            ffprobeBin(),
            ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file],
            { timeout: 30000 }
        );
        codec = stdout.trim().split(/\s+/)[0];
    } catch (_) {
        return file; // sin ffprobe no se puede comprobar: se envía tal cual
    }

    if (codec === 'h264' && file.toLowerCase().endsWith('.mp4')) return file;

    const out = path.join(dir, 'h264.mp4');
    await runBin(
        cfg.ffmpegPath,
        ['-y', '-loglevel', 'error', '-i', file, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out],
        { timeout: 600000 }
    );
    return out;
}

// Une varios mp3 en uno solo (se recodifica para evitar problemas entre distintas frecuencias)
async function mixAudio(files, dir) {
    const listPath = path.join(dir, 'list.txt');
    const lines = files.map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    await fs.promises.writeFile(listPath, lines.join('\n'));

    const out = path.join(dir, 'mix.mp3');
    await runBin(
        cfg.ffmpegPath,
        ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath,
            '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', out],
        { timeout: 600000 }
    );
    return out;
}

// ---------- carpetas temporales ----------
async function withTempDir(fn) {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nimebot-'));
    try {
        return await fn(dir);
    } finally {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

// ---------- cola de descargas ----------
let active = 0;
const waiting = [];

async function withSlot(fn) {
    if (active >= cfg.maxConcurrent) {
        if (waiting.length >= cfg.maxQueue) {
            throw userError('Hay demasiadas descargas en cola. Inténtalo en un momento.');
        }
        await new Promise((resolve) => waiting.push(resolve)); // el hueco se transfiere al despertar
    } else {
        active++;
    }
    try {
        return await fn();
    } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
    }
}

module.exports = {
    runBin,
    HOSTS,
    userError,
    isHttpUrl,
    isAllowedUrl,
    toTarget,
    friendlyError,
    checkTools,
    getInfo,
    assertDuration,
    assertSize,
    downloadVideo,
    downloadTikTok,
    downloadAudio,
    mixAudio,
    ensureH264,
    withTempDir,
    withSlot
};
