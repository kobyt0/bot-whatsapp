const { MessageMedia } = require('whatsapp-web.js');
const { aliasesOf } = require('./identity');

// URL de la foto de perfil de alguien (null si no tiene o es privada)
async function profilePicUrl(client, id, extra = []) {
    const candidates = [id];
    try {
        for (const a of await aliasesOf(client, id, extra)) if (a.includes('@')) candidates.push(a);
    } catch (_) {}

    for (const c of new Set(candidates)) {
        try {
            const url = await client.getProfilePicUrl(c);
            if (url) return url;
        } catch (_) {}
    }
    return null;
}

// La foto lista para enviar (null si no se pudo)
async function profilePic(client, id, extra = []) {
    const url = await profilePicUrl(client, id, extra);
    if (!url) return null;
    try {
        return await Promise.race([
            MessageMedia.fromUrl(url, { unsafeMime: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo agotado')), 10000))
        ]);
    } catch (err) {
        console.error('[perfil] no pude descargar la foto:', err.message);
        return null;
    }
}

module.exports = { profilePicUrl, profilePic };
