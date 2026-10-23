const db = require('../lib/db');
const eco = require('../lib/economy');
const P = require('../lib/profile');
const { resolveTargets } = require('../lib/targets');
const { isAdmin, sameUser, botExtra } = require('../lib/identity');
const { prefixes, warns: cfg } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const mention = (id) => `@${id.split('@')[0]}`;
const limitText = (settings) => (settings.warnLimit ? String(settings.warnLimit) : '∞');
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const warnsOf = (u) => u.warns || (u.warns = []);

const say = (ctx, text, mentions = []) =>
    ctx.chat.sendMessage(text, { quotedMessageId: ctx.msg.id._serialized, mentions });

// ---------- límite ----------
const setwarnlimit = {
    name: 'setwarnlimit',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, args, settings, isBotAdmin }) {
        const arg = (args[0] || '').toLowerCase();
        const current = settings.warnLimit ? `${settings.warnLimit} warns` : 'desactivado';

        if (!arg) {
            return msg.reply(`Límite actual de warns: *${current}*\nUso: ${p}setwarnlimit <número de 1 a 20 | off>`);
        }

        if (['off', 'desactivar', 'no'].includes(arg)) {
            settings.warnLimit = null;
            db.save();
            return msg.reply('✅ Límite de warns desactivado: los warns se acumulan pero nadie será expulsado automáticamente.');
        }

        const n = /^\d+$/.test(arg) ? parseInt(arg, 10) : 0;
        if (n < 1 || n > 20) return msg.reply(`El límite debe ser un número de 1 a 20, o *off*.\nEjemplo: ${p}setwarnlimit 3`);

        settings.warnLimit = n;
        db.save();
        let text = `✅ Límite de warns: *${n}*. Quien llegue a ${n} warns será expulsado automáticamente (sus warns se conservan para que los admins decidan).`;
        if (!isBotAdmin) text += '\n⚠️ Ahora mismo no soy admin del grupo, así que no podré expulsar.';
        return msg.reply(text);
    }
};

// ---------- warn (con expulsión automática) ----------
async function autoKick(ctx, u, targetId, count) {
    const { chat, settings } = ctx;
    const tag = mention(targetId);

    if (!ctx.isBotAdmin) {
        return say(ctx, `🚨 ${tag} llegó al límite de warns (${count}/${settings.warnLimit}), pero no puedo expulsarlo porque no soy admin del grupo.`, [targetId]);
    }

    try {
        await chat.removeParticipants([targetId]);
    } catch (err) {
        console.error('[warns] no pude expulsar:', err.message);
        return say(ctx, `🚨 ${tag} llegó al límite de warns (${count}/${settings.warnLimit}), pero WhatsApp rechazó la expulsión.`, [targetId]);
    }

    // Los warns se CONSERVAN: los admins pueden revisarlos con !warns y decidir si quitarlos
    (u.warnKicks = u.warnKicks || []).push(Date.now());
    eco.save();
    return say(
        ctx,
        `🚪 ${tag} llegó al límite de warns (${count}/${settings.warnLimit}) y fue *expulsado automáticamente*.\n` +
            `📋 Sus warns se conservan: revísalos con ${p}warns y quítalos con ${p}resetwarn si fue un error.`,
        [targetId]
    );
}

const warn = {
    name: 'warn',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { client, msg, rest, settings, sender, senderExtra } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}warn @usuario [motivo] (o responde a un mensaje suyo)`);
        const targetId = targets[0];

        if (await sameUser(client, targetId, [], sender, senderExtra)) return msg.reply('No puedes ponerte un warn a ti mismo 😅');
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) {
            return msg.reply('No puedes ponerle un warn al bot 🤖');
        }
        if (await isAdmin(client, ctx.chat, targetId)) {
            return msg.reply('⛔ No se puede poner un warn a un admin. Quítale el rol con !demote si hace falta.');
        }

        const reason = rest.replace(/@\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, cfg.maxReason);
        const u = await eco.getUser(client, gidOf(ctx), targetId);
        u.warnName = await eco.nameOf(client, targetId);
        warnsOf(u).push({ at: Date.now(), by: sender, reason });
        eco.save();

        const count = u.warns.length;
        await say(
            ctx,
            `⚠️ ${mention(targetId)} recibió una advertencia (*${count}/${limitText(settings)}*)` +
                (reason ? `\n📝 Motivo: ${reason}` : ''),
            [targetId]
        );

        if (settings.warnLimit && count >= settings.warnLimit) return autoKick(ctx, u, targetId, count);
    }
};

const unwarn = {
    name: 'unwarn',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { client, msg, settings } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}unwarn @usuario (o responde a un mensaje suyo)`);

        const u = await eco.getUser(client, gidOf(ctx), targets[0]);
        if (!warnsOf(u).length) return say(ctx, `ℹ️ ${mention(targets[0])} no tiene warns.`, [targets[0]]);

        u.warns.pop(); // quita el más reciente
        eco.save();
        return say(ctx, `✅ Se quitó un warn a ${mention(targets[0])}. Ahora tiene *${u.warns.length}/${limitText(settings)}*.`, [targets[0]]);
    }
};

const resetwarn = {
    name: 'resetwarn',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { client, msg } = ctx;
        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}resetwarn @usuario (o responde a un mensaje suyo)`);

        const u = await eco.getUser(client, gidOf(ctx), targets[0]);
        if (!warnsOf(u).length) return say(ctx, `ℹ️ ${mention(targets[0])} no tiene warns.`, [targets[0]]);

        const had = u.warns.length;
        u.warns = [];
        eco.save();
        return say(ctx, `🧹 Se reiniciaron los ${had} warn(s) de ${mention(targets[0])}.`, [targets[0]]);
    }
};

// ---------- consultas (las puede usar cualquiera) ----------
function detail(u) {
    return u.warns.map((w, i) => `${i + 1}. ${dateStr(w.at)} — ${w.reason || 'sin motivo'}`).join('\n');
}

async function show(ctx, id, extra, self) {
    const { client, settings } = ctx;
    const u = await eco.getUser(client, gidOf(ctx), id, extra);
    const who = self ? 'Tus warns' : `Warns de ${mention(id)}`;

    if (!warnsOf(u).length) {
        return say(ctx, `✅ ${self ? 'No tienes' : `${mention(id)} no tiene`} warns.`, self ? [] : [id]);
    }
    const kicks = (u.warnKicks || []).length
        ? `\n\n🚪 Expulsado automáticamente por warns: ${u.warnKicks.map(dateStr).join(', ')}`
        : '';
    return say(ctx, `⚠️ *${who}* (${u.warns.length}/${limitText(settings)})\n\n${detail(u)}${kicks}`, self ? [] : [id]);
}

const warns = {
    name: 'warns',
    groupOnly: true,
    async run(ctx) {
        const targets = await resolveTargets(ctx.msg);
        if (!targets.length) return ctx.msg.reply(`Uso: ${p}warns @usuario (o responde a un mensaje suyo). Para ver los tuyos: ${p}mywarns`);
        return show(ctx, targets[0], [], false);
    }
};

const mywarns = {
    name: 'mywarns',
    groupOnly: true,
    async run(ctx) {
        return show(ctx, ctx.sender, ctx.senderExtra, true);
    }
};

const allwarns = {
    name: 'allwarns',
    groupOnly: true,
    async run(ctx) {
        const { client, msg, chat, settings } = ctx;

        // Se incluye también a quien ya no está en el grupo: los admins pueden querer ver por qué se fue
        const list = eco
            .allUsers(gidOf(ctx))
            .filter(([, u]) => u.warns && u.warns.length)
            .map(([key, u]) => ({ key, u, member: P.isMember(u, chat) }))
            .sort((a, b) => b.u.warns.length - a.u.warns.length);

        if (!list.length) return msg.reply('✅ Nadie tiene warns en este grupo.');

        const shown = list.slice(0, cfg.listLimit);
        const names = await Promise.all(shown.map((x) => (x.member ? eco.nameOf(client, x.key) : x.u.warnName || eco.nameOf(client, x.key))));
        const lines = shown.map(
            (x, i) => `⚠️ ${names[i]} — ${x.u.warns.length}/${limitText(settings)}${x.member ? '' : ' · 🚪 fuera del grupo'}`
        );
        if (list.length > shown.length) lines.push('', `…y ${list.length - shown.length} más.`);

        return msg.reply(`📋 *Usuarios con warns*\n\n${lines.join('\n')}\n\nDetalle: ${p}warns @usuario`);
    }
};

module.exports = [setwarnlimit, warn, unwarn, resetwarn, warns, mywarns, allwarns];
