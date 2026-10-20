const db = require('../lib/db');
const M = require('../lib/messages');
const { findMuteKey } = require('../lib/identity');

// Enlaces con protocolo, www., invitaciones de WhatsApp y dominios comunes
const LINK_REGEX =
    /(?:https?:\/\/|www\.)\S+|chat\.whatsapp\.com\/\S+|\b[a-z0-9-]+\.(?:com|net|org|io|me|gg|xyz|ly|tv|co|app|link)\b(?:\/\S*)?/i;

// Borra el mensaje o, si no se puede, explica por qué.
async function tryDelete(ctx, noAdminText) {
    if (!ctx.isBotAdmin) {
        await ctx.notify('noadmin', noAdminText);
        return false;
    }
    try {
        await ctx.msg.delete(true); // borrar para todos
        return true;
    } catch (err) {
        console.error('No pude borrar el mensaje:', err.message);
        await ctx.notify('deletefail', M.deleteFailed);
        return false;
    }
}

// Devuelve true si el mensaje fue "consumido" (no debe procesarse más)
async function moderate(ctx) {
    const { client, msg, chat, settings, sender, senderExtra, isAdmin, isBotAdmin } = ctx;
    if (msg.fromMe) return false;

    // --- Usuarios silenciados ---
    const muteKey = await findMuteKey(client, settings, sender, senderExtra);
    if (muteKey) {
        if (Date.now() >= settings.mutes[muteKey]) {
            delete settings.mutes[muteKey];
            db.save();
        } else if (!isAdmin) {
            const deleted = await tryDelete(ctx, M.mutedNoAdmin);
            // Si intentó usar un comando, se le explica por qué no pasa nada
            if (deleted && ctx.isCommand) {
                await ctx.say('mutedcmd', M.mutedCommand(sender, settings.mutes[muteKey] - Date.now()), [
                    sender
                ]);
            }
            return true; // sus comandos tampoco se procesan
        }
    }

    // --- Antilink ---
    if (settings.antilink && !isAdmin && msg.body && LINK_REGEX.test(msg.body)) {
        const deleted = await tryDelete(ctx, M.linkNoAdmin);
        if (deleted && isBotAdmin) {
            await chat.sendMessage(
                `⚠️ @${sender.split('@')[0]}, no se permiten enlaces en este grupo.`,
                { mentions: [sender] }
            );
        }
        return deleted;
    }

    return false;
}

module.exports = moderate;
