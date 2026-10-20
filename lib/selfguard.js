// Evita que el bot ejecute como comando un texto que él mismo envió.
// Sin esto, "!say !kick @alguien" haría que el bot enviara "!kick @alguien" y,
// como ese mensaje sale de su propia cuenta (que se trata como admin), lo ejecutaría.
const recent = new Map(); // texto -> momento en que el bot lo envió
const TTL = 60000;

function remember(text) {
    if (typeof text !== 'string') return;
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    if (recent.size > 500) {
        for (const [k, at] of recent) if (now - at > TTL) recent.delete(k);
    }
    recent.set(t, now);
}

// Envuelve client.sendMessage: se registra el texto ANTES de enviarlo, porque el evento
// message_create puede llegar antes de que la promesa de envío se resuelva.
// "transform(chatId, texto)" permite ajustar el texto antes de enviarlo (p. ej. el prefijo del grupo).
function install(client, transform) {
    const original = client.sendMessage.bind(client);
    client.sendMessage = (chatId, content, options) => {
        if (transform) {
            if (typeof content === 'string') content = transform(chatId, content);
            if (options && typeof options.caption === 'string') {
                options = { ...options, caption: transform(chatId, options.caption) };
            }
        }
        remember(content);
        if (options && options.caption) remember(options.caption);
        return original(chatId, content, options);
    };
}

function isOwnOutput(msg) {
    if (!msg.fromMe) return false;
    const at = recent.get((msg.body || '').trim());
    return at !== undefined && Date.now() - at < TTL;
}

module.exports = { install, isOwnOutput, remember };
