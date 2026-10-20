// Usuarios objetivo de un comando: menciones, o el autor del mensaje citado
async function resolveTargets(msg) {
    const ids = [];
    for (const m of msg.mentionedIds || []) ids.push(typeof m === 'string' ? m : m._serialized);

    if (!ids.length && msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        const id = quoted.author || quoted.from;
        if (id) ids.push(id);
    }
    return [...new Set(ids.filter(Boolean))];
}

const mention = (id) => `@${id.split('@')[0]}`;

module.exports = { resolveTargets, mention };
