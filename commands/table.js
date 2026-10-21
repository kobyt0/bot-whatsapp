const eco = require('../lib/economy');
const C = require('../lib/casino');

const { cfg, p, DICE } = C;
const tables = new Map(); // grupo -> mesa

// Si se reinicia la economía del grupo, la mesa se cancela
eco.onReset((gid) => {
    const t = tables.get(gid);
    if (t) {
        C.clearTimer(t);
        tables.delete(gid);
    }
});

const gidOf = (ctx) => ctx.chat.id._serialized;
const mention = (id) => `@${id.split('@')[0]}`;
const seconds = () => Math.round(cfg.bet.windowMs / 1000);

function summary(t, settings) {
    return (
        `👥 Jugadores: ${t.players.map((pl) => pl.name).join(', ')}\n` +
        `🏦 Pozo: *${eco.money(t.stake * t.players.length, settings)}*`
    );
}

async function resolve(gid) {
    const t = tables.get(gid);
    if (!t) return;
    tables.delete(gid);
    C.clearTimer(t);

    const { stake, players, chat, settings } = t;
    const finish = () => {
        for (const pl of players) delete pl.user.game;
        eco.save();
    };

    if (players.length < 2) {
        players[0].user.cash += stake;
        finish();
        return chat.sendMessage('🎲 Mesa cancelada: nadie se unió. Se devolvió la apuesta.');
    }

    const rolled = players.filter((pl) => pl.roll !== null);
    if (!rolled.length) {
        for (const pl of players) pl.user.cash += stake;
        finish();
        return chat.sendMessage('🎲 Mesa cerrada: nadie tiró el dado. Se devolvieron las apuestas.');
    }

    const lines = players.map((pl) =>
        pl.roll === null ? `• ${pl.name}: no tiró (pierde su apuesta)` : `• ${pl.name}: ${DICE[pl.roll - 1]} (${pl.roll})`
    );

    // Desempate entre los que sacaron el número más alto
    let contenders = rolled;
    let top = Math.max(...contenders.map((pl) => pl.roll));
    contenders = contenders.filter((pl) => pl.roll === top);
    let rounds = 0;
    while (contenders.length > 1 && rounds++ < 20) {
        contenders.forEach((pl) => (pl.roll = C.roll()));
        lines.push(`🔁 Desempate: ${contenders.map((pl) => `${pl.name} ${DICE[pl.roll - 1]} (${pl.roll})`).join(' · ')}`);
        top = Math.max(...contenders.map((pl) => pl.roll));
        contenders = contenders.filter((pl) => pl.roll === top);
    }

    const winner = contenders[0];
    const pot = stake * players.length;
    winner.user.cash += pot;
    finish();

    return chat.sendMessage(
        `🎲 *Mesa cerrada*\n\n${lines.join('\n')}\n\n🏆 ${mention(winner.id)} gana el pozo de *${eco.money(pot, settings)}*`,
        { mentions: [winner.id] }
    );
}

const bet = {
    name: 'bet',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, chat, args, settings, sender } = ctx;
        const gid = gidOf(ctx);
        const u = await C.wallet(ctx);

        // !bet cerrar -> la cierra el creador (o un admin) antes de tiempo
        if (['cerrar', 'close'].includes((args[0] || '').toLowerCase())) {
            const t = tables.get(gid);
            if (!t) return msg.reply('No hay ninguna mesa abierta.');
            if (t.players[0].user !== u && !ctx.isAdmin) {
                return msg.reply('Solo el creador de la mesa (o un admin) puede cerrarla antes de tiempo.');
            }
            return resolve(gid);
        }

        if (tables.has(gid)) {
            return msg.reply(`Ya hay una mesa abierta. Únete con ${p}join y tira con ${p}tirar.`);
        }
        if (await C.busy(ctx, u)) return;

        const stake = await C.checkBet(ctx, u, args[0], {
            min: cfg.bet.minBet,
            usage: `Uso: ${p}bet <monto|all|half>\nEjemplo: ${p}bet 1000\nLuego los demás usan ${p}join y todos ${p}tirar.`
        });
        if (!stake) return;

        u.cash -= stake;
        u.game = { type: 'table', paid: stake, gid };
        const name = await eco.nameOf(client, sender);
        const t = { stake, chat, settings, players: [{ id: sender, user: u, name, roll: null }] };
        tables.set(gid, t);
        eco.save();

        C.setTimer(t, cfg.bet.windowMs, () => resolve(gid));

        return msg.reply(
            `🎲 *Mesa de apuestas abierta* por ${name}\n` +
                `💰 Apuesta: *${eco.money(stake, settings)}* por jugador\n${summary(t, settings)}\n\n` +
                `➕ Únete con *${p}join* y tira tu dado con *${p}tirar*.\n` +
                `⏳ La mesa cierra en ${seconds()} s (el creador puede cerrarla antes con *${p}bet cerrar*). ` +
                `Gana el dado más alto; quien no tire pierde su apuesta.`
        );
    }
};

const join = {
    name: 'join',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { client, msg, settings, sender } = ctx;
        const t = tables.get(gidOf(ctx));
        if (!t) return msg.reply(`No hay ninguna mesa abierta. Abre una con ${p}bet <monto>`);

        const u = await C.wallet(ctx);
        if (t.players.some((pl) => pl.user === u)) return msg.reply('Ya estás en la mesa. Tira con ' + p + 'tirar');
        if (t.players.length >= cfg.bet.maxPlayers) return msg.reply(`La mesa está llena (máximo ${cfg.bet.maxPlayers}).`);
        if (await C.busy(ctx, u)) return;
        if (u.cash < t.stake) {
            return msg.reply(`❌ No tienes suficiente efectivo. La apuesta es *${eco.money(t.stake, settings)}*.`);
        }

        u.cash -= t.stake;
        u.game = { type: 'table', paid: t.stake, gid: gidOf(ctx) };
        t.players.push({ id: sender, user: u, name: await eco.nameOf(client, sender), roll: null });
        eco.save();

        return msg.reply(`✅ Te uniste a la mesa.\n${summary(t, settings)}\n\nTira con *${p}tirar*.`);
    }
};

const tirar = {
    name: 'tirar',
    groupOnly: true,
    economy: true,
    async run(ctx) {
        const { msg } = ctx;
        const gid = gidOf(ctx);
        const t = tables.get(gid);
        if (!t) return msg.reply(`No hay ninguna mesa abierta. Abre una con ${p}bet <monto>`);

        const u = await C.wallet(ctx);
        const pl = t.players.find((x) => x.user === u);
        if (!pl) return msg.reply(`No estás en la mesa. Únete con ${p}join`);
        if (pl.roll !== null) return msg.reply(`Ya tiraste: ${DICE[pl.roll - 1]} (${pl.roll})`);

        pl.roll = C.roll();
        await msg.reply(`🎲 Tiraste: ${DICE[pl.roll - 1]} *(${pl.roll})*`);

        // Si ya tiraron todos (y son al menos 2), la mesa se cierra sola
        if (t.players.length >= 2 && t.players.every((x) => x.roll !== null)) return resolve(gid);
    }
};

module.exports = [bet, join, tirar];
