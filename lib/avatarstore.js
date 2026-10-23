const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'avatars');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

// Ruta de la foto de esa persona (null si no tiene o el archivo ya no existe)
function getPath(u) {
    if (!u || !u.avatar) return null;
    const p = path.join(DIR, u.avatar);
    return fs.existsSync(p) ? p : null;
}

// media: { mimetype, data (base64) } -> nombre del archivo guardado
function save(gid, key, media) {
    const ext = EXT[(media.mimetype || '').split(';')[0].toLowerCase()];
    if (!ext) throw new Error('FORMATO');
    const buf = Buffer.from(media.data, 'base64');
    if (buf.length > MAX_BYTES) throw new Error('TAMANO');

    fs.mkdirSync(DIR, { recursive: true });
    const base = `${gid}__${key}`.replace(/[^0-9a-z_-]/gi, '_');
    // Si antes tenía una foto con otra extensión, se borra para no dejar archivos sueltos
    for (const other of Object.values(EXT)) {
        const old = path.join(DIR, `${base}.${other}`);
        if (other !== ext && fs.existsSync(old)) fs.unlinkSync(old);
    }
    const name = `${base}.${ext}`;
    fs.writeFileSync(path.join(DIR, name), buf);
    return name;
}

function remove(u) {
    const p = getPath(u);
    if (p) fs.unlinkSync(p);
    delete u.avatar;
}

module.exports = { getPath, save, remove };
