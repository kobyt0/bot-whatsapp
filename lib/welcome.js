const DEFAULT_WELCOME = '👋 ¡Bienvenido/a {user} a *{group}*!\nAhora somos {count} miembros.';
const DEFAULT_GOODBYE = '👋 {user} salió de *{group}*. ¡Hasta pronto!';

// Variables: {user} (quién entra/sale), {group} (nombre del grupo), {count} (miembros)
function render(template, { user, group, count }) {
    return template
        .replace(/\{user\}/gi, () => user)
        .replace(/\{group\}/gi, () => group)
        .replace(/\{count\}/gi, () => String(count));
}

module.exports = { DEFAULT_WELCOME, DEFAULT_GOODBYE, render };
