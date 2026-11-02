const { prefixes } = require('../config');
const { formatDuration } = require('./utils');
const p = prefixes[0];

// Todos los avisos del bot en un solo lugar
module.exports = {
    botOff: `🔕 El bot está desactivado en este grupo. Un admin puede activarlo con ${p}bot on`,
    onlyAdminMode:
        '🔒 El bot está en modo *solo admins* en este grupo, por eso no puedes usar comandos. ' +
        `Un admin puede cambiarlo con ${p}onlyadmin off`,
    ownerOnlyCommand: '⛔ Solo los dueños del bot pueden usar este comando.',
    botOffLocked: '🔕 El bot está desactivado en este grupo por el dueño del bot. Solo él puede activarlo.',
    onlyAdminModeLocked: '🔒 El dueño del bot puso este grupo en modo *solo admins*, por eso no puedes usar comandos.',
    commandDisabledLocked: (name) => `🚫 El comando ${p}${name} fue desactivado en este grupo por el dueño del bot. Solo él puede activarlo.`,
    featureOffLocked: (what) => `💤 ${what} está desactivad${/^La /.test(what) ? 'a' : 'o'} en este grupo por el dueño del bot. Solo él puede activarlo.`,
    locked: (label) => `🔒 *${label}* lo configuró el dueño del bot: solo él puede cambiarlo.`,
    ownerNotGroupAdmin:
        '⚠️ Eres dueño del bot, pero no eres admin de este grupo, así que no puedo hacer esto por ti. ' +
        '(Expulsar, promover, cerrar o abrir el grupo y cambiar su nombre o foto requieren que seas admin aquí.)',
    banned: '🚫 Tienes prohibido usar este bot.',
    adminOnlyCommand: '⛔ Solo los admins pueden usar este comando.',
    groupOnly: 'Este comando solo se puede usar dentro de un grupo.',
    botNeedsAdmin: '⚠️ Necesito ser admin del grupo para hacer eso.',
    linkNoAdmin:
        '🔗 Los enlaces no están permitidos en este grupo, pero no puedo borrar este mensaje ' +
        'porque no soy admin. Un admin debe darme permisos.',
    mutedNoAdmin:
        '🔇 Estás silenciado en este grupo, pero no puedo borrar tus mensajes porque no soy admin. ' +
        'Un admin debe darme permisos.',
    mutedCommand: (sender, msLeft) =>
        `🔇 @${sender.split('@')[0]}, estás silenciado en este grupo ` +
        `(te quedan ${formatDuration(msLeft)}), por eso no puedes usar comandos.`,
    commandDisabled: (name) =>
        `🚫 El comando ${p}${name} está desactivado en este grupo. Un admin puede activarlo con ${p}comando ${name} on`,
    economyOff: `💤 La economía está desactivada en este grupo. Un admin puede activarla con ${p}economy on`,
    gachaOff: `💤 El sistema gacha está desactivado en este grupo. Un admin puede activarlo con ${p}gacha on`,
    deleteFailed: '⚠️ No pude borrar este mensaje. Inténtalo de nuevo o avisa a un admin.'
};
