// Actividad e inactividad de los miembros. Solo se usan números: cuántos mensajes envió cada
// persona por día y cuándo fue el último. Nunca se guarda el contenido de los mensajes.
const eco = require('./economy');
const db = require('./db');
const { isAdmin, isBotAdmin, sameUser, botExtra } = require('./identity');
const { inactivity: cfg } = require('../config');

const DAY = 86400e3;

// Estado de cada miembro actual del grupo en una ventana de N días:
//  active   -> escribió dentro de la ventana
//  inactive -> lleva más de N días sin escribir
//  unknown  -> aún no hay datos suficientes (el seguimiento o su llegada es más reciente que la ventana)
async function classify(client, chat, settings, days, now = Date.now()) {
    const gid = chat.id._serialized;
    const botId = client.info.wid._serialized;
    const members = [];

    for (const p of chat.participants || []) {
        const id = p.id._serialized;
        if (await sameUser(client, id, [], botId, botExtra(client))) continue;

        const u = await eco.findUser(client, gid, id);
        const last = (u && u.act && u.act.last) || 0;
        const joined = (u && u.joinedAt) || 0;
        const ref = Math.max(last, joined, settings.trackedSince || 0);

        let status;
        if (last && now - last < days * DAY) status = 'active';
        else if (ref && now - ref >= days * DAY) status = 'inactive';
        else status = 'unknown';

        members.push({
            id, user: u, last, joined, ref, status,
            isAdmin: !!(p.isAdmin || p.isSuperAdmin),
            count: u ? eco.messagesIn(u, days) : 0
        });
    }
    return members;
}

const clampDays = (n, fallback) => {
    const v = parseInt(n, 10);
    if (!Number.isFinite(v) || v < 1) return fallback;
    return Math.min(v, cfg.maxDays);
};

function ago(ms) {
    const d = Math.floor(ms / DAY);
    if (d >= 1) return `${d} día${d === 1 ? '' : 's'}`;
    const h = Math.max(1, Math.floor(ms / 3600e3));
    return `${h} hora${h === 1 ? '' : 's'}`;
}

// ---------- expulsión automática ----------
async function sweepGroup(client, chat, settings, now = Date.now()) {
    const days = settings.inactivityDays;
    if (!days) return { kicked: [] };
    if (!(await isBotAdmin(client, chat))) return { kicked: [], reason: 'bot-not-admin' };

    const enabledAt = settings.inactivityEnabledAt || now;
    const members = await classify(client, chat, settings, days, now);

    // El plazo cuenta desde el último mensaje, desde que entró, o desde que se activó la función
    // (lo que sea más reciente): activarla nunca expulsa a nadie al instante.
    const due = [];
    for (const m of members) {
        if (m.isAdmin) continue;
        const ref = Math.max(m.last, m.joined, settings.trackedSince || 0, enabledAt);
        if (now - ref < days * DAY) continue;
        if (await isAdmin(client, chat, m.id)) continue; // dueños del bot (config.owners)
        due.push({ ...m, ref, real: Math.max(m.last, m.joined, settings.trackedSince || 0) });
    }
    if (!due.length) return { kicked: [] };

    due.sort((a, b) => a.real - b.real); // primero los que llevan más tiempo sin escribir
    const batch = due.slice(0, cfg.maxPerSweep);

    try {
        await chat.removeParticipants(batch.map((m) => m.id));
    } catch (err) {
        console.error('[inactividad] no pude expulsar:', err.message);
        return { kicked: [], reason: 'failed' };
    }

    const names = await Promise.all(batch.map((m) => eco.nameOf(client, m.id)));
    const pending = due.length - batch.length;
    await chat.sendMessage(
        `🚪 *Expulsados por inactividad* (${days} día${days === 1 ? '' : 's'} sin enviar mensajes):\n${names.map((n) => `• ${n}`).join('\n')}` +
            (pending > 0 ? `\n\n⏳ Quedan ${pending} más por revisar en la próxima ronda.` : '')
    );
    return { kicked: batch.map((m) => m.id), pending };
}

async function sweepAll(client) {
    let total = 0;
    for (const gid of db.groupIds()) {
        const settings = db.getGroup(gid);
        if (!settings.inactivityDays || !settings.botEnabled) continue;
        try {
            const chat = await client.getChatById(gid);
            if (!chat || !chat.isGroup) continue;
            total += (await sweepGroup(client, chat, settings)).kicked.length;
        } catch (err) {
            console.error(`[inactividad] error en ${gid}:`, err.message);
        }
    }
    return total;
}

module.exports = { classify, clampDays, ago, sweepGroup, sweepAll, DAY };
