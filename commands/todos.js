// Mención oculta: los participantes van solo en "mentions", sin @numero en el texto.
const { neutralize } = require('../lib/utils');

// WhatsApp pone en negrita lo que va entre asteriscos, pero cada línea por separado y sin espacios pegados.
// Si el texto empieza con algo que parezca un comando, se neutraliza DENTRO de los asteriscos.
function bold(text) {
    return text
        .split('\n')
        .map((line, i) => {
            let t = line.replace(/\*/g, '').trim();
            if (!t) return '';
            if (i === 0) t = neutralize(t);
            return `*${t}*`;
        })
        .join('\n');
}

module.exports = {
    name: 'todos',
    aliases: ['all', 'tagall', 'tag'],
    adminOnly: true, // cámbialo a false si quieres que cualquiera lo use
    groupOnly: true,
    async run({ chat, rest }) {
        const text = rest !== '' ? rest : '📢 Atención a todos';
        const mentions = chat.participants.map((p) => p.id._serialized);
        await chat.sendMessage(bold(text), { mentions });
    },
    bold
};
