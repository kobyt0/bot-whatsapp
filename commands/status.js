const { formatUptime } = require('../lib/utils');
const { prefixes } = require('../config');

function libVersion() {
    try {
        return require('whatsapp-web.js/package.json').version;
    } catch (_) {
        return 'desconocida';
    }
}

const status = {
    name: 'status',
    async run({ client, msg }) {
        const commands = require('./index');
        let wweb = 'desconocida';
        try {
            wweb = await client.getWWebVersion();
        } catch (_) {}

        const mb = (process.memoryUsage().rss / 1048576).toFixed(0);
        return msg.reply(
            [
                '🤖 *Estado del bot*',
                `⏱️ Activo desde hace: ${formatUptime(process.uptime())}`,
                `💾 Memoria: ${mb} MB`,
                `🟢 Node ${process.version}`,
                `📚 whatsapp-web.js ${libVersion()}`,
                `🌐 WhatsApp Web ${wweb}`,
                `🧩 Comandos cargados: ${new Set(commands.values()).size}`
            ].join('\n')
        );
    }
};

const ping = {
    name: 'ping',
    async run({ client, msg }) {
        // Segundos de diferencia entre que se envió el mensaje y que el bot lo procesó
        const incoming = Math.max(0, Date.now() - msg.timestamp * 1000);

        let browser = 'no disponible';
        try {
            const t0 = Date.now();
            await client.pupPage.evaluate(() => 1);
            browser = `${Date.now() - t0} ms`;
        } catch (_) {}

        return msg.reply(`🏓 Pong!\n📨 Mensaje → bot: ${incoming} ms\n🌐 Navegador interno: ${browser}`);
    }
};

const infobots = {
    name: 'infobots',
    async run({ client, msg, chat, settings }) {
        const commands = require('./index');
        const info = client.info || {};
        const onoff = (v) => (v ? 'activado' : 'desactivado');

        const lines = [
            '🤖 *Información del bot*',
            `👤 Nombre: ${info.pushname || 'desconocido'}`,
            `📱 Número: ${info.wid ? info.wid.user : 'desconocido'}`,
            `🖥️ Plataforma: ${info.platform || 'desconocida'}`,
            `🔣 Prefijos: ${prefixes.join('  ')}`,
            `🧩 Comandos: ${new Set(commands.values()).size}`
        ];

        if (chat.isGroup && settings) {
            const activeMutes = Object.values(settings.mutes).filter((t) => t > Date.now()).length;
            lines.push(
                '',
                '⚙️ *Este grupo*',
                `• Bot: ${onoff(settings.botEnabled)}`,
                `• Solo admins: ${onoff(settings.onlyAdmin)}`,
                `• Antilink: ${onoff(settings.antilink)}`,
                `• Bienvenida: ${onoff(settings.welcome)}`,
                `• Despedida: ${onoff(settings.goodbye)}`,
                `• Banner: ${settings.bannerFile ? 'sí' : 'no'}`,
                `• Silenciados: ${activeMutes}`,
                `• Comandos desactivados: ${settings.disabledCommands.length ? settings.disabledCommands.join(', ') : 'ninguno'}`
            );
        }

        return msg.reply(lines.join('\n'));
    }
};

module.exports = [status, ping, infobots];
