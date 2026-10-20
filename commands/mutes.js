const { formatDuration } = require('../lib/utils');

// Lista los usuarios silenciados que siguen activos
module.exports = {
    name: 'mutes',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, chat, settings }) {
        const now = Date.now();
        const entries = Object.entries(settings.mutes).filter(([, until]) => until > now);

        if (!entries.length) {
            return msg.reply('No hay usuarios silenciados en este grupo.');
        }

        const lines = entries.map(
            ([id, until]) => `• @${id.split('@')[0]} — quedan ${formatDuration(until - now)}`
        );
        return chat.sendMessage(`🔇 Usuarios silenciados:\n${lines.join('\n')}`, {
            mentions: entries.map(([id]) => id)
        });
    }
};
