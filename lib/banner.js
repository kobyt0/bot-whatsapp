const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'banners');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

// Ruta del banner del grupo, o null si no hay (o el archivo ya no existe)
function getPath(settings) {
    if (!settings.bannerFile) return null;
    const p = path.join(DIR, settings.bannerFile);
    return fs.existsSync(p) ? p : null;
}

// media: { mimetype, data (base64) } -> nombre de archivo guardado
function save(groupId, media) {
    const ext = EXT[(media.mimetype || '').split(';')[0].toLowerCase()];
    if (!ext) throw new Error('FORMATO');
    const buf = Buffer.from(media.data, 'base64');
    if (buf.length > MAX_BYTES) throw new Error('TAMANO');

    fs.mkdirSync(DIR, { recursive: true });
    const name = `${groupId.replace(/[^0-9a-z-]/gi, '_')}.${ext}`;
    fs.writeFileSync(path.join(DIR, name), buf);
    return name;
}

function remove(settings) {
    const p = getPath(settings);
    if (p) fs.unlinkSync(p);
    settings.bannerFile = null;
}

module.exports = { getPath, save, remove };
