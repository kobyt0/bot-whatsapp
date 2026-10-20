const { MessageMedia } = require('whatsapp-web.js');

// Envía un archivo; si el envío normal falla (p. ej. Chromium sin códec de video),
// lo reintenta como documento.
async function sendFile(chat, filePath, { filename, caption, quotedMessageId } = {}) {
    const media = MessageMedia.fromFilePath(filePath);
    if (filename) media.filename = filename;

    const options = {};
    if (caption) options.caption = caption;
    if (quotedMessageId) options.quotedMessageId = quotedMessageId;

    try {
        return await chat.sendMessage(media, options);
    } catch (err) {
        console.error('Falló el envío normal, reintento como documento:', err.message);
        return chat.sendMessage(media, { ...options, sendMediaAsDocument: true });
    }
}

// Envía un .ogg (opus) como nota de voz
async function sendVoice(chat, filePath, { quotedMessageId } = {}) {
    const media = MessageMedia.fromFilePath(filePath);
    media.mimetype = 'audio/ogg; codecs=opus';
    const options = quotedMessageId ? { quotedMessageId } : {};

    try {
        return await chat.sendMessage(media, { ...options, sendAudioAsVoice: true });
    } catch (err) {
        console.error('Falló el envío como nota de voz, reintento como archivo de audio:', err.message);
        return chat.sendMessage(media, { ...options, sendMediaAsDocument: true });
    }
}

function safeFilename(title, ext) {
    const clean = String(title).replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return `${clean || 'audio'}.${ext}`;
}

module.exports = { sendFile, sendVoice, safeFilename };
