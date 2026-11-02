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
const banned = require('../lib/banned');
const L = require('../lib/locks');
const { isAdmin, isGroupAdmin, isBotAdmin, isOwner } = require('../lib/identity');

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
            isOwner: !!msg.fromMe, // dueño del bot (config.owners o la propia cuenta del bot)
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

        // Personas vetadas: no pueden usar ninguna función del bot (la propia cuenta del bot nunca se veta)
        const denyBanned = async () => {
            if (!command || msg.fromMe) return false;
            if (!(await banned.find(client, ctx.sender, ctx.senderExtra))) return false;
            await ctx.notify('banned', M.banned);
            return true;
        };

        if (chat.isGroup) {
            ctx.settings = groupSettings;

            // IDs alternativos del remitente (número real / lid)
            try {
                const contact = await msg.getContact();
                ctx.senderExtra = [contact.id, contact.number && `${contact.number}@c.us`];
            } catch (_) {}

            // Actividad del grupo (la usa la regla de inactividad de !robar)
            if (!msg.fromMe) {
                eco.touch(chat.id._serialized, [ctx.sender, ...ctx.senderExtra]);

                // Solo se anota UN NÚMERO por mensaje (texto, sticker, foto...): nunca su contenido
                try {
                    if (!ctx.settings.trackedSince) {
                        ctx.settings.trackedSince = Date.now();
                        db.save();
                    }
                    await eco.countMessage(client, chat.id._serialized, ctx.sender, ctx.senderExtra);
                } catch (err) {
                    console.error('[actividad]', err.message);
                }
            }

            ctx.isOwner = await isOwner(client, ctx.sender, ctx.senderExtra, msg.fromMe);
            // El dueño es "admin supremo": cuenta como admin en todos los grupos (config.owners)
            ctx.isAdmin = msg.fromMe || (await isAdmin(client, chat, ctx.sender, ctx.senderExtra));
            ctx.isBotAdmin = await isBotAdmin(client, chat);

            if (await denyBanned()) return;

            // Bot apagado: solo responde a "!bot" (para poder volver a encenderlo)
            if (!ctx.settings.botEnabled && !(command && command.name === 'bot')) {
                if (command) await ctx.notify('botoff', L.isLocked(ctx.settings, 'bot') ? M.botOffLocked : M.botOff);
                return;
            }

            // Mute y antilink
            if (await moderate(ctx)) return;

            // Modo solo-admins
            if (ctx.settings.onlyAdmin && !ctx.isAdmin) {
                if (command) await ctx.notify('onlyadmin', L.isLocked(ctx.settings, 'onlyadmin') ? M.onlyAdminModeLocked : M.onlyAdminMode);
                return;
            }

            // Comandos desactivados con !comando
            if (command && ctx.settings.disabledCommands.includes(command.name)) {
                await ctx.notify('cmdoff', L.isLocked(ctx.settings, `cmd:${command.name}`) ? M.commandDisabledLocked(command.name) : M.commandDisabled(command.name));
                return;
            }

            // Gacha apagado con !gacha off
            if (command && command.gacha && !ctx.settings.gacha) {
                await ctx.notify('gachaoff', L.isLocked(ctx.settings, 'gacha') ? M.featureOffLocked('El sistema gacha') : M.gachaOff);
                return;
            }

            // Economía apagada con !economy off
            if (command && command.economy && !ctx.settings.economy) {
                await ctx.notify('economyoff', L.isLocked(ctx.settings, 'economy') ? M.featureOffLocked('La economía') : M.economyOff);
                return;
            }
        }

        if (!command) return;

        if (!chat.isGroup) {
            ctx.isOwner = await isOwner(client, ctx.sender, [], msg.fromMe);
            if (await denyBanned()) return;
        }

        if (command.groupOnly && !chat.isGroup) {
            return ctx.notify('grouponly', M.groupOnly);
        }
        if (command.ownerOnly && !ctx.isOwner) {
            return ctx.notify('owneronly', M.ownerOnlyCommand);
        }
        if (command.adminOnly && !ctx.isAdmin) {
            return ctx.notify('adminonly', M.adminOnlyCommand);
        }
        if (command.botAdmin && !ctx.isBotAdmin) {
            return ctx.notify('botneedsadmin', M.botNeedsAdmin);
        }

        // Acciones sobre el grupo en WhatsApp (expulsar, promover, cerrar, nombre, foto...):
        // el dueño debe ser admin real de ese grupo; si no, el bot lo avisa.
        if (command.groupAction && ctx.isOwner && !msg.fromMe && !(await isGroupAdmin(client, chat, ctx.sender, ctx.senderExtra))) {
            return ctx.notify('ownernotadmin', M.ownerNotGroupAdmin);
        }

        // Ajustes bloqueados por el dueño: los demás admins no los pueden cambiar
        const lockKey = ctx.settings && command.lock ? command.lock(ctx) : null;
        if (lockKey && !ctx.isOwner && L.isLocked(ctx.settings, lockKey)) {
            return ctx.notify('locked', M.locked(L.label(lockKey, ctx.settings)));
        }
        const before = lockKey && ctx.isOwner && !command.lockExact ? L.snapshot(ctx.settings) : null;

        await command.run(ctx);

        // Lo que configura el dueño queda bloqueado para los demás admins (se libera con !liberar)
        // (si el dueño lo deja en su valor normal, vuelve a ser de todos y se libera)
        if (lockKey && ctx.isOwner && (command.lockExact || L.snapshot(ctx.settings) !== before)) {
            const locked = L.isLocked(ctx.settings, lockKey);
            if (command.release && command.release(ctx)) {
                if (locked) {
                    delete ctx.settings.locks[lockKey];
                    db.save();
                    await msg.reply(`🔓 Liberado: los admins vuelven a poder cambiar *${L.label(lockKey, ctx.settings)}*.`);
                }
            } else if (!locked) {
                ctx.settings.locks[lockKey] = true;
                db.save();
                await msg.reply(`🔒 Bloqueado: los admins ya no pueden cambiar *${L.label(lockKey, ctx.settings)}*. Para liberarlo: !liberar ${lockKey}`);
            }
        }
    } catch (err) {
        console.error('Error procesando mensaje:', err);
    }
};
