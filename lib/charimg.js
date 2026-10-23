const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const DIR = path.join(__dirname, '..', 'data', 'char-images');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Imagen del personaje lista para enviar (se guarda en caché al descargarla). null si falla.
async function charImage(c) {
    try {
        fs.mkdirSync(DIR, { recursive: true });
        for (const ext of Object.values(EXT)) {
            const cached = path.join(DIR, `${c.id}.${ext}`);
            if (fs.existsSync(cached)) return MessageMedia.fromFilePath(cached);
        }

        const media = await Promise.race([
            MessageMedia.fromUrl(c.image, { unsafeMime: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo agotado')), 12000))
        ]);
        const ext = EXT[(media.mimetype || '').split(';')[0]] || 'jpg';
        try {
            fs.writeFileSync(path.join(DIR, `${c.id}.${ext}`), Buffer.from(media.data, 'base64'));
        } catch (_) {}
        return media;
    } catch (err) {
        console.error(`[gacha] no pude obtener la imagen de ${c.name}:`, err.message);
        return null;
    }
}

module.exports = { charImage };
