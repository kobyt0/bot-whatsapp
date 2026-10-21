const eco = require('./economy');
const config = require('../config');
const cfg = config.casino;
const p = config.prefixes[0];

// ---------- temporizadores (autostand, autofold, mesas...) ----------
const timers = new Map();

function clearTimer(key) {
    const t = timers.get(key);
    if (t) {
        clearTimeout(t);
        timers.delete(key);
    }
}

function setTimer(key, ms, fn) {
    clearTimer(key);
    const t = setTimeout(async () => {
        timers.delete(key);
        try {
            await fn();
        } catch (err) {
            console.error('[casino]', err);
        }
    }, ms);
    if (t.unref) t.unref();
    timers.set(key, t);
}

// ---------- fechas ----------
const pad = (n) => String(n).padStart(2, '0');
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function msUntilMidnight() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;
}

// ---------- apuestas ----------
const wallet = (ctx) => eco.getUser(ctx.client, ctx.chat.id._serialized, ctx.sender, ctx.senderExtra);

const GAME_NAMES = { bj: 'blackjack', poker: 'poker', ladder: 'escalera', table: 'mesa de apuestas' };

// Devuelve el monto válido o null (y ya le respondió al usuario)
async function checkBet(ctx, u, token, { min = cfg.minBet, usage }) {
    const { msg, settings } = ctx;
    if (!token) {
        await msg.reply(usage);
        return null;
    }
    const amount = eco.parseAmount(token, u.cash);
    if (!amount) {
        const all = ['all', 'half', 'todo', 'mitad'].includes(String(token).toLowerCase());
        await msg.reply(all && u.cash === 0 ? '💵 No tienes efectivo para apostar.' : usage);
        return null;
    }
    if (amount < min) {
        await msg.reply(`La apuesta mínima es *${eco.money(min, settings)}*.`);
        return null;
    }
    if (cfg.maxBet && amount > cfg.maxBet) {
        await msg.reply(`La apuesta máxima es *${eco.money(cfg.maxBet, settings)}*.`);
        return null;
    }
    if (amount > u.cash) {
        await msg.reply(`❌ No tienes tanto efectivo. Tienes *${eco.money(u.cash, settings)}*.`);
        return null;
    }
    return amount;
}

// ¿Tiene ya otra partida en curso?
async function busy(ctx, u) {
    if (!u.game) return false;
    await ctx.msg.reply(`⛔ Ya tienes una partida de *${GAME_NAMES[u.game.type]}* en curso. Termínala primero.`);
    return true;
}

const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const roll = () => eco.randInt(1, 6);

module.exports = { cfg, p, setTimer, clearTimer, today, msUntilMidnight, wallet, checkBet, busy, GAME_NAMES, DICE, roll };
