const { prefixes } = require('../config');
const { formatDuration } = require('./utils');
const p = prefixes[0];

// Todos los avisos del bot en un solo lugar
module.exports = {
    botOff: `🔕 El bot está desactivado en este grupo. Un admin puede activarlo con ${p}bot on`,
    onlyAdminMode:
        '🔒 El bot está en modo *solo admins* en este grupo, por eso no puedes usar comandos. ' +
        `Un admin puede cambiarlo con ${p}onlyadmin off`,
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
    deleteFailed: '⚠️ No pude borrar este mensaje. Inténtalo de nuevo o avisa a un admin.'
};
