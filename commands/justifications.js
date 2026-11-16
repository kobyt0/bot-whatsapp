// Lista de justificaciones de inactividad de cada grupo.
//   !justificar @user <texto>   (o respondiendo a un mensaje suyo)  -> guarda la justificación (admins)
//   !justificaciones [@user]                                         -> muestra la lista (todos)
//   !quitarjustificacion <n...|@user>                                -> la borra (admins)
const db = require('../lib/db');
const eco = require('../lib/economy');
const { resolveTargets } = require('../lib/targets');
const { sameUser } = require('../lib/identity');
const { prefixes, justifications: cfg } = require('../config');
const p = prefixes[0];

const fmtDate = (ts) => new Date(ts).toLocaleDateString('es-CO');

// Parte un texto largo en trozos de como máximo `size` caracteres, cortando en espacios
function splitText(text, size) {
    const out = [];
    let rest = text;
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size);
        if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
        if (cut < size * 0.5) cut = size;
        out.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
    }
    if (rest) out.push(rest);
    return out;
}

const justify = {
    name: 'justify',
    adminOnly: true,
    groupOnly: true,
    async run({ client, msg, rest, sender, settings }) {
        const [target] = await resolveTargets(msg);
        const text = rest.split(/\s+/).filter((w) => !/^@\d+$/.test(w)).join(' ').trim(); // sin la mención
        if (!target || !text) {
            return msg.reply(
                `Uso: ${p}justificar @usuario <texto de la justificación>\n` +
                    `(o responde a un mensaje suyo con ${p}justificar <texto>)\n\n` +
                    `Ver la lista: ${p}justificaciones\nBorrar una: ${p}quitarjustificacion <número>`
            );
        }
        if (text.length > cfg.maxText) {
            return msg.reply(`El texto es demasiado largo (${text.length} caracteres). El máximo es ${cfg.maxText}.`);
        }
        if (settings.justifications.length >= cfg.maxPerGroup) {
            return msg.reply(`Este grupo ya tiene ${cfg.maxPerGroup} justificaciones. Borra alguna con ${p}quitarjustificacion.`);
        }

        const name = await eco.nameOf(client, target);
        const by = await eco.nameOf(client, sender).catch(() => '');
        settings.justifications.push({ user: target, name, text, by, at: Date.now() });
        db.save();
        return msg.reply(`✅ Justificación *#${settings.justifications.length}* guardada para *${name}*.`);
    }
};

const list = {
    name: 'justifications',
    groupOnly: true,
    async run({ client, msg, chat, settings }) {
        const [target] = await resolveTargets(msg);
        // Se conserva el número que tiene cada una en la lista completa, aunque se filtre por persona
        let entries = settings.justifications.map((j, i) => ({ ...j, n: i + 1 }));
        if (target) {
            const keep = [];
            for (const e of entries) if (await sameUser(client, e.user, [], target, [])) keep.push(e);
            entries = keep;
        }

        if (!entries.length) {
            return msg.reply(target ? 'Esa persona no tiene justificaciones.' : `📝 No hay justificaciones en este grupo.\nSe agregan con ${p}justificar @usuario <texto>`);
        }

        // Cada justificación es un bloque; las muy largas se parten para que ningún mensaje pase del límite
        const blocks = [];
        for (const e of entries) {
            const head = `*${e.n}.* ${e.name} — ${fmtDate(e.at)}${e.by ? ` (por ${e.by})` : ''}`;
            const pieces = splitText(e.text, cfg.chunk - 300);
            blocks.push(`${head}\n${pieces[0]}`);
            for (const extra of pieces.slice(1)) blocks.push(`↳ (continuación de #${e.n})\n${extra}`);
        }

        // Se agrupan en mensajes de ~chunk caracteres
        const parts = [];
        let cur = '';
        for (const b of blocks) {
            if (cur && cur.length + b.length + 2 > cfg.chunk) {
                parts.push(cur);
                cur = '';
            }
            cur += (cur ? '\n\n' : '') + b;
        }
        if (cur) parts.push(cur);

        const title = `📝 *Justificaciones de inactividad* (${entries.length})`;
        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? ` (${i + 1}/${parts.length})` : '';
            const text = `${i === 0 ? title : '📝 *Justificaciones*'}${label}\n\n${parts[i]}`;
            if (i === 0) await msg.reply(text);
            else await chat.sendMessage(text);
        }
    }
};

const remove = {
    name: 'deljustification',
    adminOnly: true,
    groupOnly: true,
    async run({ client, msg, args, settings }) {
        const nums = args.map((a) => parseInt(a, 10)).filter((n) => Number.isInteger(n) && n >= 1);
        const [target] = await resolveTargets(msg);
        const all = settings.justifications;

        let drop = new Set();
        if (nums.length) {
            nums.filter((n) => n <= all.length).forEach((n) => drop.add(all[n - 1]));
        } else if (target) {
            for (const j of all) if (await sameUser(client, j.user, [], target, [])) drop.add(j);
        } else {
            return msg.reply(
                `Uso: ${p}quitarjustificacion <número> (puedes poner varios: 2 5 7)\n` +
                    `o ${p}quitarjustificacion @usuario para borrar todas las de esa persona.\nLos números salen en ${p}justificaciones`
            );
        }

        if (!drop.size) return msg.reply('No encontré esa justificación. Revisa los números con ' + p + 'justificaciones');
        settings.justifications = all.filter((j) => !drop.has(j));
        db.save();
        return msg.reply(`🗑️ Borré ${drop.size === 1 ? '1 justificación' : `${drop.size} justificaciones`}. Los números de la lista se actualizaron.`);
    }
};

module.exports = [justify, list, remove];
