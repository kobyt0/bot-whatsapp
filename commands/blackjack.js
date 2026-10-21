const eco = require('../lib/economy');
const C = require('../lib/casino');
const K = require('../lib/cards');

const { cfg, p } = C;
const seconds = () => Math.round(cfg.bj.timeoutMs / 1000);

function view(g, reveal) {
    const mine = g.player.map(K.show).join(' | ');
    const dealer = reveal ? g.dealer.map(K.show).join(' | ') : `${K.show(g.dealer[0])} | ❓`;
    return (
        `🃏 *Blackjack de ${g.name}*\n\n` +
        `🧑 Tu mano: | ${mine} | (${K.bjValue(g.player)})\n` +
        `🎰 Dealer: | ${dealer} |${reveal ? ` (${K.bjValue(g.dealer)})` : ''}`
    );
}

// Termina la partida y paga. kind: natural | win | push | lose
async function settle(send, u, g, settings, kind, note = '') {
    C.clearTimer(u);
    delete u.game;

    const stake = g.stake;
    let line;
    if (kind === 'natural') {
        const gain = Math.floor(stake * cfg.bj.naturalPayout);
        u.cash += stake + gain;
        line = `🎉 *¡BLACKJACK!* Ganaste *${eco.money(gain, settings)}*`;
    } else if (kind === 'win') {
        u.cash += stake * 2;
        line = `✅ ¡Ganaste *${eco.money(stake, settings)}*!`;
    } else if (kind === 'push') {
        u.cash += stake;
        line = `🤝 Empate: te devolvemos *${eco.money(stake, settings)}*.`;
    } else {
        line = `❌ Perdiste *${eco.money(stake, settings)}*.`;
    }
    eco.save();
    await send(`${note}${view(g, true)}\n\n${line}`);
}

// El dealer descubre su carta y pide hasta llegar a 17
async function doStand(send, u, settings, note = '') {
    const g = u.game;
    while (K.bjValue(g.dealer) < 17) g.dealer.push(g.deck.pop());

    const mine = K.bjValue(g.player);
    const dealer = K.bjValue(g.dealer);
    let kind = 'lose';
    if (dealer > 21 || mine > dealer) kind = 'win';
    else if (mine === dealer) kind = 'push';

    await settle(send, u, g, settings, kind, note);
}

function armTimer(ctx, u) {
    C.setTimer(u, cfg.bj.timeoutMs, async () => {
        if (!u.game || u.game.type !== 'bj') return;
        await doStand((t) => ctx.chat.sendMessage(t), u, ctx.settings, '⏱️ Tiempo agotado: te plantaste automáticamente.\n\n');
    });
}

const noGame = (msg) => msg.reply(`No tienes una partida de blackjack. Empieza con ${p}bj <monto>`);

const bj = {
    name: 'bj',
    aliases: ['blackjack'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, args, settings, sender } = ctx;
        const u = await C.wallet(ctx);
        if (await C.busy(ctx, u)) return;

        const stake = await C.checkBet(ctx, u, args[0], {
            usage: `Uso: ${p}bj <monto|all|half>\nEjemplo: ${p}bj 1000\nReglas: ${p}infobj`
        });
        if (!stake) return;

        u.cash -= stake;
        const deck = K.newDeck();
        const g = {
            type: 'bj',
            paid: stake,
            stake,
            name: await eco.nameOf(client, sender),
            deck,
            player: [deck.pop(), deck.pop()],
            dealer: [deck.pop(), deck.pop()]
        };
        u.game = g;
        eco.save();

        const send = (t) => msg.reply(t);
        const playerBJ = K.isNatural(g.player);
        const dealerBJ = K.isNatural(g.dealer);
        if (playerBJ || dealerBJ) {
            const kind = playerBJ && dealerBJ ? 'push' : playerBJ ? 'natural' : 'lose';
            return settle(send, u, g, settings, kind);
        }

        armTimer(ctx, u);
        return send(`${view(g, false)}\n\nUsa *${p}hit* o *${p}stand* · (autostand ${seconds()}s)`);
    }
};

const hit = {
    name: 'hit',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        const g = u.game && u.game.type === 'bj' ? u.game : null;
        if (!g) return noGame(msg);

        g.player.push(g.deck.pop());
        const value = K.bjValue(g.player);
        const send = (t) => msg.reply(t);

        if (value > 21) return settle(send, u, g, settings, 'lose', '💥 ¡Te pasaste de 21!\n\n');
        if (value === 21) return doStand(send, u, settings, '✨ ¡21! Te plantas automáticamente.\n\n');

        eco.save();
        armTimer(ctx, u);
        return send(`${view(g, false)}\n\nUsa *${p}hit* o *${p}stand*.`);
    }
};

const stand = {
    name: 'stand',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, settings } = ctx;
        const u = await C.wallet(ctx);
        if (!(u.game && u.game.type === 'bj')) return noGame(msg);
        return doStand((t) => msg.reply(t), u, settings);
    }
};

const infobj = {
    name: 'infobj',
    async run({ msg }) {
        const pay = cfg.bj.naturalPayout;
        return msg.reply(
            `🃏 *Reglas del Blackjack*\n\n` +
                `• Acércate a 21 sin pasarte. Las figuras valen 10 y el As vale 11 o 1.\n` +
                `• Empiezas con 2 cartas y ves una del dealer. Juega con *${p}hit* (pedir carta) o *${p}stand* (plantarte).\n` +
                `• Si no actúas en ${seconds()} s, te plantas solo.\n` +
                `• El dealer pide carta hasta llegar a 17 o más.\n` +
                `• Ganas: recibes el doble de lo apostado.\n` +
                `• Blackjack natural (21 con 2 cartas): paga ${pay}:1 de ganancia.\n` +
                `• Empate: te devolvemos la apuesta.`
        );
    }
};

module.exports = [bj, hit, stand, infobj];
