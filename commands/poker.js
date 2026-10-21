const eco = require('../lib/economy');
const C = require('../lib/casino');
const K = require('../lib/cards');

const { cfg, p } = C;
const seconds = () => Math.round(cfg.poker.timeoutMs / 1000);
const cards3 = (hand, sep = ' | ') => hand.map(K.show).join(sep);

async function resolvePlay(send, u, settings, note = '') {
    const g = u.game;
    C.clearTimer(u);
    delete u.game;

    const mine = K.pokerEval(g.player);
    const dealer = K.pokerEval(g.dealer);
    const cmp = K.pokerCompare(mine, dealer);

    let line;
    if (cmp > 0) {
        u.cash += g.paid * 2;
        line = `✅ Ganas (total): *${eco.money(g.paid * 2, settings)}*`;
    } else if (cmp === 0) {
        u.cash += g.paid;
        line = `🤝 Empate: te devolvemos *${eco.money(g.paid, settings)}*.`;
    } else {
        line = `❌ Pierdes *${eco.money(g.paid, settings)}* (ANTE + PLAY).`;
    }
    eco.save();

    await send(
        `${note}🃏 *Poker 3 Cartas — ${g.name}*\n——————————————\n` +
            `🎴 Tu mano: *${mine.name}*\n    | ${cards3(g.player)} |\n` +
            `🏦 Crupier: *${dealer.name}*\n    | ${cards3(g.dealer)} |\n\n${line}`
    );
}

async function doFold(send, u, settings, note = '') {
    const g = u.game;
    C.clearTimer(u);
    delete u.game;
    eco.save();
    await send(`${note}🚪 Te retiraste del poker y perdiste solo el ANTE: *${eco.money(g.paid, settings)}*.`);
}

function armTimer(ctx, u) {
    C.setTimer(u, cfg.poker.timeoutMs, async () => {
        if (!u.game || u.game.type !== 'poker') return;
        await doFold((t) => ctx.chat.sendMessage(t), u, ctx.settings, '⏱️ Tiempo agotado: fold automático.\n');
    });
}

const noGame = (msg) => msg.reply(`No tienes una partida de poker. Empieza con ${p}poker <monto>`);

const poker = {
    name: 'poker',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, args, settings, sender } = ctx;
        const u = await C.wallet(ctx);
        if (await C.busy(ctx, u)) return;

        const ante = await C.checkBet(ctx, u, args[0], {
            usage: `Uso: ${p}poker <monto|all|half>\nEjemplo: ${p}poker 1000\nReglas: ${p}infopoker`
        });
        if (!ante) return;
        if (ante * 2 > u.cash) {
            return msg.reply(
                `❌ Necesitas tener al menos el doble del ante para poder igualar (ANTE + PLAY = *${eco.money(ante * 2, settings)}*).`
            );
        }

        u.cash -= ante;
        const deck = K.newDeck();
        const g = {
            type: 'poker',
            paid: ante,
            ante,
            name: await eco.nameOf(client, sender),
            player: [deck.pop(), deck.pop(), deck.pop()],
            dealer: [deck.pop(), deck.pop(), deck.pop()]
        };
        u.game = g;
        eco.save();
        armTimer(ctx, u);

        return msg.reply(
            `🃏 *Poker 3 Cartas — ${g.name}*\n——————————————\n` +
                `🎴 Tus cartas: | ${cards3(g.player, ' , ')} |\n` +
                `🏦 Crupier: | ❓ , ❓ , ❓ |\n` +
                `💰 ANTE: *${eco.money(ante, settings)}*\n\n` +
                `▶️ Para seguir: escribe *${p}play* → apostarás otro ${eco.money(ante, settings)}\n` +
                `🚪 Para salir: escribe *${p}fold* → pierdes solo el ANTE\n\n` +
                `⏳ Tienes ${seconds()}s para decidir (si no, se hace fold automático).`
        );
    }
};

const play = {
    name: 'play',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        const g = u.game && u.game.type === 'poker' ? u.game : null;
        if (!g) return noGame(msg);

        if (u.cash < g.ante) {
            return msg.reply(
                `❌ No tienes suficiente efectivo para igualar el ANTE (necesitas *${eco.money(g.ante, settings)}*). Usa ${p}fold para salir.`
            );
        }

        u.cash -= g.ante;
        g.paid = g.ante * 2;
        return resolvePlay((t) => msg.reply(t), u, settings);
    }
};

const fold = {
    name: 'fold',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        if (!(u.game && u.game.type === 'poker')) return noGame(msg);
        return doFold((t) => msg.reply(t), u, settings);
    }
};

const infopoker = {
    name: 'infopoker',
    async run({ msg }) {
        return msg.reply(
            `🃏 *Reglas del Poker de 3 cartas*\n\n` +
                `• Apuestas el ANTE y recibes 3 cartas. El crupier también, pero boca abajo.\n` +
                `• Decides en ${seconds()} s: *${p}play* (apuestas otro ANTE igual) o *${p}fold* (te retiras y pierdes solo el ANTE). Si no decides, es fold.\n` +
                `• Se comparan las manos. De mejor a peor:\n` +
                `   1. Escalera de color\n   2. Trío\n   3. Escalera (A-2-3 es la más baja)\n   4. Color\n   5. Par\n   6. Carta alta\n` +
                `• Ganas: recibes el doble de lo apostado (ANTE + PLAY).\n` +
                `• Empate: te devolvemos todo.\n` +
                `• Necesitas tener al menos el doble del ANTE para empezar.`
        );
    }
};

module.exports = [poker, play, fold, infopoker];
