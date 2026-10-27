const { MessageMedia } = require('whatsapp-web.js');
const db = require('../lib/db');
const eco = require('../lib/economy');
const banner = require('../lib/banner');
const cooldown = require('../lib/cooldown');
const { render, DEFAULT_WELCOME, DEFAULT_GOODBYE } = require('../lib/welcome');
const { sameUser, botExtra } = require('../lib/identity');
const { neutralize } = require('../lib/utils');

async function displayName(client, id) {
    try {
        const c = await client.getContactById(id);
        return c.pushname || c.name || c.number || id.split('@')[0];
    } catch (_) {
        return id.split('@')[0];
    }
}

// kind: 'welcome' (alguien entra) o 'goodbye' (alguien se va o lo expulsan)
async function handle(client, notification, kind) {
    const chatId = notification.chatId || (notification.id && notification.id.remote);
    const ids = notification.recipientIds || [];
    if (!chatId || !ids.length) return;

    const chat = await client.getChatById(chatId);
    if (!chat.isGroup) return;

    const settings = db.getGroup(chatId);
    if (!settings.botEnabled || !settings[kind]) return;

    // Ignorar cuando quien entra o sale es el propio bot
    const botId = client.info.wid._serialized;
    const people = [];
    for (const id of ids) {
        if (!(await sameUser(client, id, [], botId, botExtra(client)))) people.push(id);
    }
    if (!people.length) return;

    // Evita duplicados si WhatsApp avisa dos veces del mismo evento
    if (!cooldown.ready(`${kind}:${chatId}:${people.join(',')}`, 5000)) return;

    // Al entrar se menciona (ya están en el grupo); al salir se usa el nombre,
    // porque mencionar a alguien que ya no está se vería como un número suelto.
    let user;
    let mentions = [];
    if (kind === 'welcome') {
        user = people.map((id) => '@' + id.split('@')[0]).join(', ');
        mentions = people;
    } else {
        user = (await Promise.all(people.map((id) => displayName(client, id)))).join(', ');
    }

    const template =
        (kind === 'welcome' ? settings.welcomeText : settings.goodbyeText) ||
        (kind === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE);

    const text = neutralize(
        render(template, { user, group: chat.name || '', count: (chat.participants || []).length })
    );

    const bannerPath = banner.getPath(settings);
    if (bannerPath) {
        try {
            await chat.sendMessage(MessageMedia.fromFilePath(bannerPath), { caption: text, mentions });
            return;
        } catch (err) {
            console.error('[grupo] no pude enviar el banner, envío solo texto:', err.message);
        }
    }
    await chat.sendMessage(text, { mentions });
}

// Anota cuándo entra cada persona (sirve para no expulsar por inactividad a quien acaba de llegar)
async function recordJoins(client, notification) {
    const chatId = notification.chatId || (notification.id && notification.id.remote);
    if (!chatId) return;
    const botId = client.info.wid._serialized;
    for (const id of notification.recipientIds || []) {
        if (await sameUser(client, id, [], botId, botExtra(client))) continue;
        const u = await eco.getUser(client, chatId, id);
        u.joinedAt = Date.now();
        eco.markDirty();
    }
}

module.exports = (client) => ({
    onJoin: async (n) => {
        try {
            await recordJoins(client, n);
        } catch (e) {
            console.error('[entrada]', e.message);
        }
        return handle(client, n, 'welcome').catch((e) => console.error('[bienvenida]', e.message));
    },
    onLeave: (n) => handle(client, n, 'goodbye').catch((e) => console.error('[despedida]', e.message))
});
