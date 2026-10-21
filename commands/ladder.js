const eco = require('../lib/economy');
const C = require('../lib/casino');

const { cfg, p } = C;
const steps = () => cfg.ladder.steps;
const cashValue = (g) => (g.step === 0 ? g.stake : Math.floor(g.stake * steps()[g.step - 1].mult));

function view(g, settings) {
    const list = steps();
    const rows = [];
    for (let i = list.length - 1; i >= 0; i--) {
        const mark = i < g.step ? '✅' : i === g.step ? '🎯' : '⬜';
        rows.push(`${mark} Escalón ${i + 1} · x${list[i].mult} (${Math.round(list[i].chance * 100)}% de lograrlo)`);
    }
    return (
        `🪜 *Escalera del riesgo — ${g.name}*\n` +
        `💰 Apuesta: ${eco.money(g.stake, settings)}\n\n${rows.join('\n')}\n\n` +
        `📍 Escalón ${g.step}/${list.length} — ahora vale *${eco.money(cashValue(g), settings)}*`
    );
}

async function cashOut(send, u, settings, note = '') {
    const g = u.game;
    C.clearTimer(u);
    delete u.game;

    const value = cashValue(g);
    u.cash += value;
    eco.save();

    const text =
        g.step === 0
            ? `🚪 Te retiraste sin subir: te devolvemos *${eco.money(value, settings)}*.`
            : `💰 ¡Cobraste *${eco.money(value, settings)}*! (ganancia: ${eco.money(value - g.stake, settings)})`;
    await send(`${note}${text}`);
}

function armTimer(ctx, u) {
    C.setTimer(u, cfg.ladder.timeoutMs, async () => {
        if (!u.game || u.game.type !== 'ladder') return;
        await cashOut((t) => ctx.chat.sendMessage(t), u, ctx.settings, '⏱️ Sin actividad: se cobra automáticamente lo que llevas.\n');
    });
}

const noGame = (msg) => msg.reply(`No tienes una escalera en curso. Empieza con ${p}ladder <monto>`);

const ladder = {
    name: 'ladder',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, args, settings, sender } = ctx;
        const u = await C.wallet(ctx);
        if (await C.busy(ctx, u)) return;

        const stake = await C.checkBet(ctx, u, args[0], {
            usage: `Uso: ${p}ladder <monto|all|half>\nEjemplo: ${p}ladder 1000`
        });
        if (!stake) return;

        u.cash -= stake;
        const g = { type: 'ladder', paid: stake, stake, step: 0, name: await eco.nameOf(client, sender) };
        u.game = g;
        eco.save();
        armTimer(ctx, u);

        return msg.reply(
            `${view(g, settings)}\n\n⬆️ *${p}subir* (${Math.round(steps()[0].chance * 100)}% de lograrlo) · 💰 *${p}cobrar*\n` +
                `⚠️ Si caes, pierdes todo.`
        );
    }
};

const subir = {
    name: 'subir',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        const g = u.game && u.game.type === 'ladder' ? u.game : null;
        if (!g) return noGame(msg);

        const list = steps();
        const target = list[g.step];

        if (!eco.chance(target.chance)) {
            C.clearTimer(u);
            delete u.game;
            eco.save();
            return msg.reply(
                `💥 *¡Caíste del escalón ${g.step + 1}!* Perdiste *${eco.money(g.stake, settings)}*.\n` +
                    `(Tenías ${Math.round(target.chance * 100)}% de lograrlo)`
            );
        }

        g.step++;
        if (g.step === list.length) {
            return cashOut((t) => msg.reply(t), u, settings, `🏆 *¡LLEGASTE A LA CIMA!*\n\n`);
        }

        eco.save();
        armTimer(ctx, u);
        const next = list[g.step];
        return msg.reply(
            `⬆️ ¡Subiste al escalón ${g.step}!\n\n${view(g, settings)}\n\n` +
                `Siguiente: x${next.mult} con ${Math.round(next.chance * 100)}% de lograrlo.\n` +
                `⬆️ *${p}subir* · 💰 *${p}cobrar*`
        );
    }
};

const cobrar = {
    name: 'cobrar',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        if (!(u.game && u.game.type === 'ladder')) return noGame(msg);
        return cashOut((t) => msg.reply(t), u, settings);
    }
};

module.exports = [ladder, subir, cobrar];
