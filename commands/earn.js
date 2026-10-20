const eco = require('../lib/economy');
const S = require('../lib/situations');
const { resolveTargets } = require('../lib/targets');
const { sameUser, botExtra } = require('../lib/identity');
const { formatWait } = require('../lib/utils');
const { prefixes } = require('../config');
const p = prefixes[0];
const cfg = eco.cfg;

const gidOf = (ctx) => ctx.chat.id._serialized;
const me = (ctx) => eco.getUser(ctx.client, gidOf(ctx), ctx.sender, ctx.senderExtra);
const say = (ctx, text, mentions = []) =>
    ctx.chat.sendMessage(text, { quotedMessageId: ctx.msg.id._serialized, mentions });
const waitMsg = (name, left) => `⏳ Debes esperar *${formatWait(left)}* para volver a usar ${p}${name}.`;

// ---------- daily ----------
const daily = {
    name: 'daily',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await me(ctx);

        const left = eco.remaining(u, 'daily', cfg.daily.cooldownMs);
        if (left) {
            return msg.reply(`⏳ Ya reclamaste tu daily. Vuelve en *${formatWait(left)}*.\n🔥 Racha actual: día ${u.streak}`);
        }

        const last = u.cd.daily || 0;
        u.streak = !last || Date.now() - last > cfg.daily.maxGapMs ? 1 : u.streak + 1;

        const table = cfg.daily.table;
        const amount = table[Math.min(u.streak, table.length) - 1];
        u.cash += amount;
        eco.stamp(u, 'daily');
        eco.save();

        let text = `🎁 *Daily* — día ${u.streak} de racha\n💰 Ganaste *${eco.money(amount, settings)}*`;
        if (u.streak >= table.length) {
            text += `\n🔥 ¡Racha máxima! Tu daily se queda en ${eco.money(table[table.length - 1], settings)}.`;
        } else {
            text += `\n📈 Mañana: ${eco.money(table[u.streak], settings)}`;
        }
        text += `\n⚠️ Si pasas más de ${Math.round(cfg.daily.maxGapMs / 3600e3)} h sin reclamar, la racha vuelve al día 1.`;
        return msg.reply(text);
    }
};

// ---------- work (siempre sale bien) ----------
const work = {
    name: 'work',
    aliases: ['trabajar', 'w'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await me(ctx);

        const left = eco.remaining(u, 'work', cfg.work.cooldownMs);
        if (left) return msg.reply(waitMsg('work', left));

        const amount = eco.nice(eco.randInt(cfg.work.min, cfg.work.max));
        u.cash += amount;
        eco.stamp(u, 'work');
        eco.save();

        return msg.reply(`💼 *Trabajo*\n${eco.pick(S.work)}\n💰 Ganaste *${eco.money(amount, settings)}*.`);
    }
};

// ---------- slut y crime (pueden fallar) ----------
function risky({ name, emoji, title, c, win, fail }) {
    return {
        name,
        groupOnly: true,
        economy: true,
        async run(ctx) {
            const { msg, settings } = ctx;
            const u = await me(ctx);

            const left = eco.remaining(u, name, c.cooldownMs);
            if (left) return msg.reply(waitMsg(name, left));
            eco.stamp(u, name);

            if (eco.chance(c.failChance)) {
                const fine = Math.min(u.cash, eco.nice(eco.randInt(c.fineMin, c.fineMax)));
                u.cash -= fine;
                eco.save();
                const loss = fine > 0
                    ? `💸 Perdiste *${eco.money(fine, settings)}*.`
                    : '😮‍💨 No tenías efectivo, así que no perdiste nada.';
                return msg.reply(`${emoji} *${title}* — ❌ ¡Salió mal!\n${eco.pick(fail)}\n${loss}`);
            }

            const amount = eco.nice(eco.randInt(c.min, c.max));
            u.cash += amount;
            eco.save();
            return msg.reply(`${emoji} *${title}*\n${eco.pick(win)}\n💰 Ganaste *${eco.money(amount, settings)}*.`);
        }
    };
}

const slut = risky({ name: 'slut', emoji: '💃', title: 'Encanto', c: cfg.slut, win: S.slutWin, fail: S.slutFail });
const crime = risky({ name: 'crime', emoji: '🦹', title: 'Crimen', c: cfg.crime, win: S.crimeWin, fail: S.crimeFail });

// ---------- robar ----------
const robar = {
    name: 'robar',
    aliases: ['rob'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, settings, sender, senderExtra } = ctx;
        const r = cfg.rob;

        const targets = await resolveTargets(msg);
        if (!targets.length) return msg.reply(`Uso: ${p}robar @usuario (o responde a un mensaje suyo)`);
        const targetId = targets[0];

        if (await sameUser(client, targetId, [], sender, senderExtra)) {
            return msg.reply('No puedes robarte a ti mismo 🤨');
        }
        if (await sameUser(client, targetId, [], client.info.wid._serialized, botExtra(client))) {
            return msg.reply('A mí no me robas: mis coins están en una bóveda 🔒');
        }

        const thief = await me(ctx);
        const left = eco.remaining(thief, 'rob', r.cooldownMs);
        if (left) return msg.reply(waitMsg('robar', left));

        const victim = await eco.getUser(client, gidOf(ctx), targetId);
        const mention = `@${targetId.split('@')[0]}`;

        if (victim.cash < r.minTargetCash) {
            return say(ctx, `🔒 ${mention} no tiene efectivo que valga la pena robar (su dinero está en el banco o es muy poco).`, [targetId]);
        }

        const last = await eco.lastActive(client, gidOf(ctx), targetId);
        if (last !== null && Date.now() - last < r.inactiveMs) {
            return say(
                ctx,
                `👀 ${mention} estuvo activo hace ${formatWait(Date.now() - last)}. ` +
                    `Solo puedes robar a quien lleva más de ${Math.round(r.inactiveMs / 3600e3)} h sin escribir.`,
                [targetId]
            );
        }

        // Desde aquí el intento cuenta (y activa la espera)
        eco.stamp(thief, 'rob');

        if (eco.chance(r.failChance)) {
            const fine = Math.min(thief.cash, eco.nice(eco.randInt(r.fineMin, r.fineMax)));
            thief.cash -= fine;
            eco.save();
            const loss = fine > 0
                ? `💸 Perdiste *${eco.money(fine, settings)}*.`
                : '😮‍💨 No tenías efectivo, así que no perdiste nada.';
            return say(ctx, `🕵️ *Robo* — ❌ ¡Salió mal!\n${eco.pick(S.robFail).replace(/\{user\}/g, mention)}\n${loss}`, [targetId]);
        }

        let amount = Math.floor(victim.cash * r.percent);
        if (r.maxSteal) amount = Math.min(amount, r.maxSteal);
        amount = Math.max(1, amount);

        victim.cash -= amount;
        thief.cash += amount;
        eco.save();

        return say(
            ctx,
            `🕵️ *Robo*\n${eco.pick(S.robWin).replace(/\{user\}/g, mention)}\n` +
                `💰 Le quitaste *${eco.money(amount, settings)}* (${Math.round(r.percent * 100)}% de su efectivo).`,
            [targetId]
        );
    }
};

module.exports = [daily, work, slut, crime, robar];
