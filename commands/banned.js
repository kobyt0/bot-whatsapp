// Vetar a una persona: no podrá usar NINGÚN comando del bot (en ningún grupo ni en privado).
// Solo los dueños del bot (config.owners) o la propia cuenta del bot pueden vetar y quitar vetos.
const banned = require('../lib/banned');
const eco = require('../lib/economy');
const { resolveTargets } = require('../lib/targets');
const { isOwner, sameUser, botExtra } = require('../lib/identity');
const { prefixes } = require('../config');
const p = prefixes[0];

// Objetivo: mención, mensaje citado o número escrito (ej: 573001234567 o +57 300 123 4567)
async function resolveTarget(msg, args) {
    const [first] = await resolveTargets(msg);
    if (first) return first;
    for (const a of args) {
        const digits = a.replace(/[\s+()-]/g, '');
        if (/^\d{7,15}$/.test(digits)) return `${digits}@c.us`;
    }
    return null;
}

const label = (e) => {
    const num = (e.ids.find((i) => i.endsWith('@c.us')) || e.ids[0] || '').split('@')[0];
    return `${e.name}${num ? ` (+${num})` : ''}`;
};

const ban = {
    name: 'banuser',
    ownerOnly: true,
    async run(ctx) {
        const { client, msg, args, sender, senderExtra } = ctx;
        const target = await resolveTarget(msg, args);
        if (!target) {
            return msg.reply(
                `Uso: ${p}vetar @usuario [motivo] (o responde a un mensaje suyo, o escribe su número)\n` +
                    `Quitar el veto: ${p}desvetar @usuario\nVer la lista: ${p}vetados`
            );
        }

        if (await sameUser(client, target, [], client.info.wid._serialized, botExtra(client))) {
            return msg.reply('No puedo vetarme a mí mismo 😅');
        }
        if (await isOwner(client, target, [], false)) {
            return msg.reply('⛔ No se puede vetar a un dueño del bot.');
        }

        // El motivo es el texto que sobra (sin la mención ni el número)
        const reason = args.filter((a) => !a.startsWith('@') && !/^[+\d()-]{7,}$/.test(a)).join(' ').slice(0, 100);
        const name = await eco.nameOf(client, target);
        const by = await eco.nameOf(client, sender).catch(() => '');

        const added = await banned.add(client, target, { name, reason, by });
        if (!added) return msg.reply(`${name} ya estaba vetado.`);
        return msg.reply(`🚫 *${name}* ya no puede usar el bot.${reason ? `\nMotivo: ${reason}` : ''}\nPara quitarlo: ${p}desvetar`);
    }
};

const unban = {
    name: 'unbanuser',
    ownerOnly: true,
    async run({ client, msg, args }) {
        const target = await resolveTarget(msg, args);
        if (!target) return msg.reply(`Uso: ${p}desvetar @usuario (o responde a un mensaje suyo, o escribe su número)`);

        const entry = await banned.remove(client, target);
        if (!entry) return msg.reply('Esa persona no está vetada.');
        return msg.reply(`✅ *${entry.name}* ya puede usar el bot de nuevo.`);
    }
};

const list = {
    name: 'banlist',
    ownerOnly: true,
    async run({ msg }) {
        const all = banned.all();
        if (!all.length) return msg.reply('No hay personas vetadas.');

        const lines = all.map((e, i) => {
            const date = new Date(e.at).toLocaleDateString('es-CO');
            return `${i + 1}. ${label(e)} — ${date}${e.reason ? `\n    Motivo: ${e.reason}` : ''}`;
        });
        return msg.reply(`🚫 *Personas vetadas* (${all.length})\n\n${lines.join('\n')}`);
    }
};

module.exports = [ban, unban, list];
