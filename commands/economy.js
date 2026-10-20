const db = require('../lib/db');
const eco = require('../lib/economy');
const { resolveTargets } = require('../lib/targets');
const { sameUser, botExtra } = require('../lib/identity');
const { prefixes } = require('../config');
const p = prefixes[0];

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const say = (ctx, text, mentions = []) =>
    ctx.chat.sendMessage(text, { quotedMessageId: ctx.msg.id._serialized, mentions });

const saldo = {
    name: 'saldo',
    aliases: ['bal', 'balance'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, settings } = ctx;
        const targets = await resolveTargets(msg);

        let u, title;
        if (targets.length) {
            u = await eco.getUser(client, gidOf(ctx), targets[0]);
            title = `💼 *Saldo de ${await eco.nameOf(client, targets[0])}*`;
        } else {
            u = await me(ctx);
            title = '💼 *Tu saldo*';
        }

        return msg.reply(
            `${title}\n` +
                `💵 Efectivo: *${eco.money(u.cash, settings)}*\n` +
                `🏦 Banco: *${eco.money(u.bank, settings)}*\n` +
                `📊 Total: *${eco.money(u.cash + u.bank, settings)}*`
        );
    }
};

const deposit = {
    name: 'deposit',
    aliases: ['dep', 'depositar'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await me(ctx);

        if (!args[0]) return msg.reply(`Uso: ${p}deposit <monto|all|half>\nEjemplo: ${p}deposit 5000`);
        const amount = eco.parseAmount(args[0], u.cash);
        if (!amount) {
            return msg.reply(u.cash === 0 && ['all', 'half'].includes(args[0].toLowerCase())
                ? '💵 No tienes efectivo para depositar.'
                : 'Monto inválido. Usa un número, *all* o *half*.');
        }
        if (amount > u.cash) {
            return msg.reply(`❌ No tienes tanto efectivo. Tienes *${eco.money(u.cash, settings)}*.`);
        }

        u.cash -= amount;
        u.bank += amount;
        eco.save();
        return msg.reply(
            `🏦 Depositaste *${eco.money(amount, settings)}*. Ahora están a salvo de los ladrones.\n` +
                `💵 Efectivo: ${eco.fmt(u.cash)} · 🏦 Banco: ${eco.fmt(u.bank)}`
        );
    }
};

const retirar = {
    name: 'retirar',
    aliases: ['withdraw'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await me(ctx);

        if (!args[0]) return msg.reply(`Uso: ${p}retirar <monto|all|half>\nEjemplo: ${p}retirar 5000`);
        const amount = eco.parseAmount(args[0], u.bank);
        if (!amount) {
            return msg.reply(u.bank === 0 && ['all', 'half'].includes(args[0].toLowerCase())
                ? '🏦 No tienes nada en el banco.'
                : 'Monto inválido. Usa un número, *all* o *half*.');
        }
        if (amount > u.bank) {
            return msg.reply(`❌ No tienes tanto en el banco. Tienes *${eco.money(u.bank, settings)}*.`);
        }

        u.bank -= amount;
        u.cash += amount;
        eco.save();
        return msg.reply(
            `💵 Retiraste *${eco.money(amount, settings)}*. Ojo: el efectivo se puede robar.\n` +
                `💵 Efectivo: ${eco.fmt(u.cash)} · 🏦 Banco: ${eco.fmt(u.bank)}`
        );
    }
};

const pay = {
    name: 'pay',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, args, settings, sender, senderExtra } = ctx;
        const targets = await resolveTargets(msg);
        const usage = `Uso: ${p}pay <monto> @usuario (o responde a un mensaje suyo)`;

        if (!targets.length) return msg.reply(usage);
        const giver = await me(ctx);

        // El monto es el primer argumento que no sea una mención
        const token = args.find((a) => !a.startsWith('@'));
        const amount = eco.parseAmount(token, giver.cash);
        if (!amount) return msg.reply(usage);

        const targetId = targets[0];
        if (await sameUser(client, targetId, [], sender, senderExtra)) {
            return msg.reply('No puedes pagarte a ti mismo 😅');
        }
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) {
            return msg.reply('Gracias, pero yo no necesito coins 🤖');
        }

        const receiver = await eco.getUser(client, gidOf(ctx), targetId);
        if (amount > giver.cash) {
            return msg.reply(`❌ No tienes tanto efectivo. Tienes *${eco.money(giver.cash, settings)}*.`);
        }

        giver.cash -= amount;
        receiver.cash += amount;
        eco.save();
        return say(
            ctx,
            `💸 Enviaste *${eco.money(amount, settings)}* a @${targetId.split('@')[0]}.\n` +
                `💵 Te quedan ${eco.fmt(giver.cash)} en efectivo.`,
            [targetId]
        );
    }
};

const baltop = {
    name: 'baltop',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, settings } = ctx;
        const mine = await me(ctx);

        const ranked = eco
            .allUsers(gidOf(ctx))
            .map(([key, u]) => ({ key, u, total: u.cash + u.bank }))
            .filter((x) => x.total > 0)
            .sort((a, b) => b.total - a.total);

        if (!ranked.length) {
            return msg.reply(`Todavía nadie tiene ${eco.coinName(settings)} en este grupo. Prueba con ${p}daily o ${p}work`);
        }

        const medals = ['🥇', '🥈', '🥉'];
        const top = ranked.slice(0, 10);
        const names = await Promise.all(top.map((x) => eco.nameOf(client, x.key)));
        const lines = top.map((x, i) => `${medals[i] || `${i + 1}.`} ${names[i]} — ${eco.money(x.total, settings)}`);

        const pos = ranked.findIndex((x) => x.u === mine);
        let text = `🏆 *Top ${eco.coinName(settings)} del grupo*\n\n${lines.join('\n')}`;
        if (pos >= 10) text += `\n\n📍 Tu posición: #${pos + 1} (${eco.money(mine.cash + mine.bank, settings)})`;
        return msg.reply(text);
    }
};

const setcoins = {
    name: 'setcoins',
    adminOnly: true,
    groupOnly: true,
    async run({ msg, rest, settings }) {
        if (!rest) {
            return msg.reply(`Moneda actual: *${eco.coinName(settings)}*\nUso: ${p}setcoins <nombre> (o *reset*)`);
        }
        if (rest.toLowerCase() === 'reset') {
            settings.coinName = null;
            db.save();
            return msg.reply(`✅ La moneda vuelve a llamarse *${eco.coinName(settings)}*.`);
        }

        const name = rest.replace(/\s+/g, ' ').trim();
        if (name.length > 20 || /[\n@]/.test(rest)) {
            return msg.reply('El nombre debe tener máximo 20 caracteres y no incluir @.');
        }

        settings.coinName = name;
        db.save();
        return msg.reply(`✅ Ahora la moneda de este grupo se llama *${name}*.`);
    }
};

// Pide confirmación antes de borrar la economía del grupo
const pending = new Map();
const CONFIRM_MS = 60000;

const reseteconomy = {
    name: 'reseteconomy',
    adminOnly: true,
    groupOnly: true,
    async run(ctx) {
        const { msg, args, settings, sender } = ctx;
        const key = `${gidOf(ctx)}:${sender}`;
        const confirming = ['confirmar', 'confirm'].includes((args[0] || '').toLowerCase());

        if (!confirming) {
            pending.set(key, Date.now());
            return msg.reply(
                `⚠️ Esto dejará a *todos* con 0 ${eco.coinName(settings)} (efectivo y banco) y reiniciará rachas y esperas.\n` +
                    `Para confirmar escribe *${p}reseteconomy confirmar* en los próximos 60 segundos.`
            );
        }

        const at = pending.get(key);
        if (!at || Date.now() - at > CONFIRM_MS) {
            pending.delete(key);
            return msg.reply(`No hay una confirmación pendiente. Escribe primero *${p}reseteconomy*.`);
        }

        pending.delete(key);
        eco.resetGroup(gidOf(ctx));
        return msg.reply(`🧹 Economía reiniciada: todos quedaron con 0 ${eco.coinName(settings)}.`);
    }
};

module.exports = [saldo, deposit, retirar, pay, baltop, setcoins, reseteconomy];
