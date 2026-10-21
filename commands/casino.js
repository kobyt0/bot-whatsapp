const eco = require('../lib/economy');
const C = require('../lib/casino');
const { formatWait } = require('../lib/utils');

const { cfg, p, DICE } = C;
const pick = (arr) => arr[Math.floor(eco.rng.fn() * arr.length)];

// ---------- dado: tú contra el bot ----------
const dado = {
    name: 'dado',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await C.wallet(ctx);
        const min = cfg.dado.minBet;
        const bet = await C.checkBet(ctx, u, args[0], {
            min,
            usage: `Uso: ${p}dado <monto> (mínimo ${eco.fmt(min)})\nEjemplo: ${p}dado 1000`
        });
        if (!bet) return;

        u.cash -= bet;
        const mine = C.roll();
        const bot = C.roll();

        let result;
        if (mine > bot) {
            u.cash += bet * 2;
            result = `✅ ¡Ganaste *${eco.money(bet, settings)}*!`;
        } else if (mine === bot) {
            u.cash += bet;
            result = '🤝 Empate: te devolvemos tu apuesta.';
        } else {
            result = `❌ Perdiste *${eco.money(bet, settings)}*.`;
        }
        eco.save();

        return msg.reply(
            `🎲 *Duelo de dados*\n🧑 Tú: ${DICE[mine - 1]} (${mine})\n🤖 Bot: ${DICE[bot - 1]} (${bot})\n\n${result}`
        );
    }
};

// ---------- coinflip ----------
const SIDES = { cara: 'CARA', heads: 'CARA', cruz: 'CRUZ', tails: 'CRUZ' };

const coinflip = {
    name: 'coinflip',
    aliases: ['cf'],
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await C.wallet(ctx);

        const side = args.map((a) => SIDES[a.toLowerCase()]).find(Boolean);
        const token = args.find((a) => !SIDES[a.toLowerCase()]);
        const bet = await C.checkBet(ctx, u, token, {
            usage: `Uso: ${p}coinflip <monto> [cara|cruz]\nEjemplo: ${p}coinflip 1000 cara`
        });
        if (!bet) return;

        const chosen = side || pick(['CARA', 'CRUZ']);
        const result = pick(['CARA', 'CRUZ']);

        u.cash -= bet;
        let text;
        if (chosen === result) {
            u.cash += bet * 2;
            text = `✅ ¡Ganaste *${eco.money(bet, settings)}*!`;
        } else {
            text = `❌ Perdiste *${eco.money(bet, settings)}*.`;
        }
        eco.save();

        const coin = result === 'CARA' ? '🙂' : '⚜️';
        return msg.reply(
            `🪙 *Cara o Cruz*\n` +
                `Elegiste *${chosen}*${side ? '' : ' (al azar)'} · salió ${coin} *${result}*\n\n${text}`
        );
    }
};

// ---------- ruleta ----------
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const COLORS = { red: 'RED', rojo: 'RED', black: 'BLACK', negro: 'BLACK' };
const DOT = { RED: '🔴', BLACK: '⚫', GREEN: '🟢' };

const roulette = {
    name: 'roulette',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await C.wallet(ctx);

        const color = args.map((a) => COLORS[a.toLowerCase()]).find(Boolean);
        const token = args.find((a) => !COLORS[a.toLowerCase()]);
        const bet = await C.checkBet(ctx, u, token, {
            usage: `Uso: ${p}roulette <monto> [red|black]\nEjemplo: ${p}roulette 1000 red`
        });
        if (!bet) return;

        const chosen = color || pick(['RED', 'BLACK']);
        const n = eco.randInt(0, 36);
        const landed = n === 0 ? 'GREEN' : REDS.has(n) ? 'RED' : 'BLACK';

        u.cash -= bet;
        let text;
        if (landed === chosen) {
            u.cash += bet * 2;
            text = `✅ Elegiste *${chosen}*: ¡ganaste *${eco.money(bet, settings)}*!`;
        } else if (landed === 'GREEN') {
            text = `🟢 Cayó el *0*: la banca se queda con todo. Tus *${eco.money(bet, settings)}* fueron sacrificados.`;
        } else {
            text = `Elegiste *${chosen}*, pero el universo eligió *${landed}*. Tus *${eco.money(bet, settings)}* fueron sacrificados. ❌`;
        }
        eco.save();

        return msg.reply(
            `🎰 *Ruleta* — la bola cayó en ${DOT[landed]} *${n}*${color ? '' : '\n(color elegido al azar)'}\n\n${text}`
        );
    }
};

// ---------- raspa y gana ----------
const raspa = {
    name: 'raspa',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg, args, settings } = ctx;
        const u = await C.wallet(ctx);
        const limit = cfg.raspa.dailyLimit;

        const day = C.today();
        if (!u.raspa || u.raspa.day !== day) u.raspa = { day, n: 0 };
        if (u.raspa.n >= limit) {
            return msg.reply(
                `🎟️ Ya usaste tus ${limit} raspas de hoy. Se reinician a medianoche (en *${formatWait(C.msUntilMidnight())}*).`
            );
        }

        const bet = await C.checkBet(ctx, u, args[0], {
            usage: `Uso: ${p}raspa <monto|all|half>\nEjemplo: ${p}raspa 1000`
        });
        if (!bet) return;

        u.raspa.n++;
        u.cash -= bet;

        const symbols = cfg.raspa.symbols;
        const win = eco.chance(cfg.raspa.winChance);
        let row;
        if (win) {
            const s = pick(symbols);
            row = [s, s, s];
        } else {
            row = [pick(symbols), pick(symbols), pick(symbols)];
            if (row[0] === row[1] && row[1] === row[2]) {
                row[2] = symbols[(symbols.indexOf(row[2]) + 1) % symbols.length]; // nunca 3 iguales al perder
            }
        }

        let text;
        if (win) {
            u.cash += bet * 2;
            text = `🎉 *¡PREMIO!* Ganaste *${eco.money(bet, settings)}* (recibes el doble: ${eco.money(bet * 2, settings)})`;
        } else {
            text = `😔 *SIN SUERTE* — perdiste *${eco.money(bet, settings)}*`;
        }
        eco.save();

        return msg.reply(
            `🎟️ *RASPA Y GANA*\n\n⟦${row[0]}⟧═⟦${row[1]}⟧═⟦${row[2]}⟧\n\n${text}\n🎟️ Raspas de hoy: ${u.raspa.n}/${limit}`
        );
    }
};

module.exports = [dado, coinflip, roulette, raspa];
