const cooldown = require('./cooldown');
const media = require('./media');
const { media: cfg } = require('../config');

// Ejecuta un trabajo de descarga con espera por usuario, cola y manejo de errores
async function guarded(ctx, { status, key = 'dl', cooldownMs = cfg.userCooldownMs } = {}, job) {
    const wait = cooldown.check(`${key}:${ctx.sender}`, cooldownMs);
    if (wait > 0) {
        return ctx.msg.reply(`⏳ Espera ${Math.ceil(wait / 1000)} s antes de volver a usar este comando.`);
    }

    try {
        if (status) await ctx.msg.reply(status);
        await media.withSlot(job);
    } catch (err) {
        console.error('[media]', err.userMessage || err.stderr || err.message);
        try {
            await ctx.msg.reply(`❌ ${err.userMessage || media.friendlyError(err)}`);
        } catch (_) {}
    }
}

module.exports = { guarded };
