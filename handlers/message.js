const db = require('../lib/db');
const M = require('../lib/messages');
const cooldown = require('../lib/cooldown');
const selfguard = require('../lib/selfguard');
const eco = require('../lib/economy');
const commands = require('../commands');
const moderate = require('./moderation');
const config = require('../config');
const { prefixesFor } = require('../lib/prefix');
const { parseCommand, getSenderId } = require('../lib/utils');
const { isAdmin, isBotAdmin } = require('../lib/identity');

module.exports = (client) => async (msg) => {
    try {
        if (msg.from === 'status@broadcast') return;

        // Lo que el bot envía no se ejecuta como comando (evita escaladas con !say, etc.)
        if (selfguard.isOwnOutput(msg)) return;

        const chat = await msg.getChat();
        const groupSettings = chat.isGroup ? db.getGroup(chat.id._serialized) : null;

        // Cada grupo puede tener su propio prefijo
        let parsed = parseCommand(msg.body, prefixesFor(groupSettings));
        if (!parsed && groupSettings && groupSettings.prefix) {
            // Salida de emergencia: "setprefix" siempre responde a los prefijos originales
            const fallback = parseCommand(msg.body, config.prefixes);
            if (fallback && fallback.name === 'setprefix') parsed = fallback;
        }
        const command = parsed ? commands.get(parsed.name) : null;

        const ctx = {
            client,
            msg,
            chat,
            args: parsed ? parsed.args : [],
            rest: parsed ? parsed.rest : '',
            settings: null,
            sender: getSenderId(client, msg),
            senderExtra: [],
            isCommand: !!command,
            isAdmin: true, // en privado no hay roles
            isBotAdmin: false
        };

        const allowed = (reason) =>
            cooldown.ready(`${chat.id._serialized}:${ctx.sender}:${reason}`, config.noticeCooldownMs);

        // Responde citando el mensaje, con límite para no inundar el chat
        ctx.notify = async (reason, text) => {
            if (!allowed(reason)) return;
            try {
                await msg.reply(text);
            } catch (err) {
                console.error('No pude enviar el aviso:', err.message);
            }
        };

        // Mensaje normal al chat (para cuando el mensaje original ya fue borrado)
        ctx.say = async (reason, text, mentions = []) => {
            if (!allowed(reason)) return;
            try {
                await chat.sendMessage(text, { mentions });
            } catch (err) {
                console.error('No pude enviar el aviso:', err.message);
            }
        };

        if (chat.isGroup) {
            ctx.settings = groupSettings;

            // IDs alternativos del remitente (número real / lid)
            try {
                const contact = await msg.getContact();
                ctx.senderExtra = [contact.id, contact.number && `${contact.number}@c.us`];
            } catch (_) {}

            // Actividad del grupo (la usa la regla de inactividad de !robar)
            if (!msg.fromMe) eco.touch(chat.id._serialized, [ctx.sender, ...ctx.senderExtra]);

            ctx.isAdmin = msg.fromMe || (await isAdmin(client, chat, ctx.sender, ctx.senderExtra));
            ctx.isBotAdmin = await isBotAdmin(client, chat);

            // Bot apagado: solo responde a "!bot" (para poder volver a encenderlo)
            if (!ctx.settings.botEnabled && !(command && command.name === 'bot')) {
                if (command) await ctx.notify('botoff', M.botOff);
                return;
            }

            // Mute y antilink
            if (await moderate(ctx)) return;

            // Modo solo-admins
            if (ctx.settings.onlyAdmin && !ctx.isAdmin) {
                if (command) await ctx.notify('onlyadmin', M.onlyAdminMode);
                return;
            }

            // Comandos desactivados con !comando
            if (command && ctx.settings.disabledCommands.includes(command.name)) {
                await ctx.notify('cmdoff', M.commandDisabled(command.name));
                return;
            }

            // Gacha apagado con !gacha off
            if (command && command.gacha && !ctx.settings.gacha) {
                await ctx.notify('gachaoff', M.gachaOff);
                return;
            }

            // Economía apagada con !economy off
            if (command && command.economy && !ctx.settings.economy) {
                await ctx.notify('economyoff', M.economyOff);
                return;
            }
        }

        if (!command) return;

        if (command.groupOnly && !chat.isGroup) {
            return ctx.notify('grouponly', M.groupOnly);
        }
        if (command.adminOnly && !ctx.isAdmin) {
            return ctx.notify('adminonly', M.adminOnlyCommand);
        }
        if (command.botAdmin && !ctx.isBotAdmin) {
            return ctx.notify('botneedsadmin', M.botNeedsAdmin);
        }

        await command.run(ctx);
    } catch (err) {
        console.error('Error procesando mensaje:', err);
    }
};
