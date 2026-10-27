// Contenido del menú de ayuda: categorías, y para cada comando sus argumentos y una explicación.
// Las claves son los nombres originales de los comandos (los de lib/aliases.js).
// Una explicación puede ser un texto o una función que recibe { coins, every, fmt, cfg } para
// reflejar los valores reales de config.js (tiempos de espera, límites...).
const CATEGORIES = [
    {
        id: 'ajustes', icon: '⚙️', title: 'AJUSTES DEL GRUPO',
        keys: ['bot', 'onlyadmin', 'antilink', 'welcome', 'goodbye', 'economy', 'gacha', 'comando', 'setprefix', 'setwelcome', 'setgoodbye', 'setbanner']
    },
    {
        id: 'moderacion', icon: '🛡️', title: 'MODERACIÓN',
        keys: ['mute', 'unmute', 'mutes', 'kick', 'promote', 'demote', 'close', 'open', 'delete', 'setnamegroup', 'setpfp', 'todos',
            'setwarnlimit', 'warn', 'unwarn', 'resetwarn', 'warns', 'mywarns', 'allwarns', 'activos', 'inactivos', 'setinactividad']
    },
    { id: 'utilidades', icon: '🛠️', title: 'UTILIDADES', keys: ['help', 'sticker', 'say', 'playaudio', 'status', 'ping', 'infobots', 'whoami'] },
    {
        id: 'descargas', icon: '📥', title: 'DESCARGAS Y MÚSICA',
        keys: ['youtube', 'ytmusic', 'tiktok', 'tkaudio', 'playlist', 'addlist', 'dellist', 'viewlist', 'listen', 'delplaylist']
    },
    {
        id: 'economia', icon: '💰', title: 'ECONOMÍA',
        keys: ['daily', 'work', 'slut', 'crime', 'robar', 'saldo', 'deposit', 'retirar', 'pay', 'baltop', 'setcoins', 'reseteconomy']
    },
    {
        id: 'casino', icon: '🎰', title: 'CASINO',
        keys: ['dado', 'coinflip', 'roulette', 'raspa', 'bj', 'hit', 'stand', 'infobj', 'poker', 'play', 'fold', 'infopoker', 'ladder', 'subir', 'cobrar', 'bet', 'join', 'tirar']
    },
    {
        id: 'perfil', icon: '👤', title: 'PERFIL Y PAREJAS',
        keys: ['profile', 'getpic', 'setfav', 'setdesc', 'setgenre', 'setbirth', 'setmeta', 'setpic', 'delfavourite', 'deldescription', 'delgenre', 'delbirth',
            'delstickermeta', 'delpic', 'birthdays', 'allbirthdays', 'marry', 'acepto', 'rechazo', 'divorce']
    },
    {
        id: 'gacha', icon: '🎴', title: 'GACHA DE PERSONAJES',
        keys: ['roll', 'claim', 'ginfo', 'harem', 'delchar', 'delallharem', 'ainfo', 'slist', 'wimage', 'sell', 'unsell', 'market', 'buycharacter', 'givechar', 'trade']
    }
];

const INFO = {
    // --- ajustes ---
    bot: { args: 'on|off', desc: 'Enciende o apaga el bot en este grupo.' },
    onlyadmin: { args: 'on|off', desc: 'Solo los admins pueden usar comandos.' },
    antilink: { args: 'on|off', desc: 'Borra los mensajes con enlaces.' },
    welcome: { args: 'on|off', desc: 'Activa el mensaje de bienvenida.' },
    goodbye: { args: 'on|off', desc: 'Activa el mensaje de despedida (también si expulsan a alguien).' },
    economy: { args: 'on|off', desc: ({ coins }) => `Activa la economía y los juegos con ${coins}.` },
    gacha: { args: 'on|off', desc: 'Activa el sistema de personajes.' },
    comando: { args: '<comando> on|off', desc: 'Activa o desactiva un comando en este grupo.' },
    setprefix: { args: '<símbolo>', desc: 'Cambia el prefijo de los comandos de este grupo (reset lo restablece).' },
    setwelcome: { args: '<texto>', desc: 'Mensaje de bienvenida. Variables: {user} {group} {count}.' },
    setgoodbye: { args: '<texto>', desc: 'Mensaje de despedida. Variables: {user} {group} {count}.' },
    setbanner: { args: '[imagen]', desc: 'Imagen para el menú, la bienvenida y la despedida (reset la quita).' },

    // --- moderación ---
    mute: { args: '<30m|1h|1d|1w> @user', desc: 'Silencia a alguien: el bot borra sus mensajes.' },
    unmute: { args: '@user', desc: 'Quita el silencio.' },
    mutes: { args: '', desc: 'Lista de personas silenciadas.' },
    kick: { args: '@user', desc: 'Expulsa a un miembro (no a admins).' },
    promote: { args: '@user', desc: 'Da el rol de admin.' },
    demote: { args: '@user', desc: 'Quita el rol de admin.' },
    close: { args: '', desc: 'Solo los admins pueden escribir.' },
    open: { args: '', desc: 'Todos pueden escribir.' },
    delete: { args: '(responde a un mensaje)', desc: 'Borra el mensaje citado y avisa.' },
    setnamegroup: { args: '<nombre>', desc: 'Cambia el nombre del grupo.' },
    setpfp: { args: '[imagen]', desc: 'Cambia la foto del grupo.' },
    todos: { args: '<texto>', desc: 'Menciona a todos con tu mensaje en negrita.' },
    setwarnlimit: { args: '<1-20|off>', desc: 'Warns para expulsar automáticamente (por defecto 3). Los warns se conservan.' },
    warn: { args: '@user [motivo]', desc: 'Pone una advertencia; al llegar al límite, lo expulsa.' },
    unwarn: { args: '@user', desc: 'Quita la última advertencia.' },
    resetwarn: { args: '@user', desc: 'Borra todas sus advertencias.' },
    warns: { args: '@user', desc: 'Ver las advertencias de alguien con sus motivos.' },
    mywarns: { args: '', desc: 'Ver tus advertencias.' },
    allwarns: { args: '', desc: 'Todos los que tienen advertencias (también quienes ya salieron).' },
    activos: { args: '[días]', desc: 'Quién ha escrito y cuántos mensajes (7 días por defecto, máx. 60).' },
    inactivos: { args: '[días]', desc: 'Quién lleva más tiempo sin escribir.' },
    setinactividad: { args: '<días|off>', desc: 'Expulsa automáticamente a quien no escriba en N días. Viene desactivado.' },

    // --- utilidades ---
    help: { args: '', desc: 'Este menú.' },
    sticker: { args: '[imagen | texto]', desc: 'Crea un sticker de una imagen, video o texto. Color: "verde: texto".' },
    say: { args: '<texto>', desc: 'El bot repite tu mensaje.' },
    playaudio: { args: '<texto>', desc: 'Convierte texto en nota de voz ("en: hello" para otro idioma).' },
    status: { args: '', desc: 'Estado del bot y tiempo activo.' },
    ping: { args: '', desc: 'Latencia del bot.' },
    infobots: { args: '', desc: 'Información del bot y de los ajustes de este grupo.' },
    whoami: { args: '', desc: 'Tu ID y tus permisos (sirve para depurar).' },

    // --- descargas ---
    youtube: { args: '<enlace> [360|720]', desc: 'Descarga un video de YouTube.' },
    ytmusic: { args: '<canción o enlace>', desc: 'Descarga el audio (mp3) de una canción.' },
    tiktok: { args: '<enlace> [audio]', desc: 'Descarga un TikTok (con "audio", solo el sonido).' },
    tkaudio: { args: '<enlace>', desc: 'Solo el audio de un TikTok.' },
    playlist: { args: '[nombre]', desc: 'Crea una playlist (sin nombre, lista las tuyas).' },
    addlist: { args: '<playlist> | <canción>', desc: 'Añade una canción a la playlist.' },
    dellist: { args: '<playlist> | <texto|n>', desc: 'Quita una canción de la playlist.' },
    viewlist: { args: '[playlist]', desc: 'Muestra las canciones de la playlist.' },
    listen: { args: '<playlist>', desc: 'Envía la playlist completa en un solo audio.' },
    delplaylist: { args: '<playlist>', desc: 'Elimina la playlist.' },

    // --- economía ---
    daily: {
        args: '',
        desc: ({ coins, fmt, cfg }) => {
            const t = cfg.economy.daily.table;
            return `Recompensa diaria con racha: de ${fmt(t[0])} sube cada día hasta ${fmt(t[t.length - 1])} ${coins} (día ${t.length}).`;
        }
    },
    work: { args: '', desc: ({ coins, every, cfg }) => `Trabaja y gana ${coins} (${every(cfg.economy.work.cooldownMs)}).` },
    slut: { args: '', desc: ({ every, cfg }) => `Arriesga tu encanto: puedes ganar o perder (${every(cfg.economy.slut.cooldownMs)}).` },
    crime: { args: '', desc: ({ every, cfg }) => `Comete un crimen: puedes ganar o perder (${every(cfg.economy.crime.cooldownMs)}).` },
    robar: {
        args: '@user',
        desc: ({ every, cfg }) =>
            `Roba el ${Math.round(cfg.economy.rob.percent * 100)}% del efectivo de quien lleva +${Math.round(cfg.economy.rob.inactiveMs / 3600e3)} h sin escribir (${every(cfg.economy.rob.cooldownMs)}).`
    },
    saldo: { args: '[@user]', desc: 'Efectivo, banco y total.' },
    deposit: { args: '<monto|all|half>', desc: ({ coins }) => `Guarda ${coins} en el banco (a salvo de robos).` },
    retirar: { args: '<monto|all|half>', desc: ({ coins }) => `Saca ${coins} del banco.` },
    pay: { args: '<monto> @user', desc: ({ coins }) => `Paga ${coins} a otra persona.` },
    baltop: { args: '', desc: ({ coins }) => `Ranking de quien más ${coins} tiene.` },
    setcoins: { args: '<nombre>', desc: 'Renombra la moneda del grupo.' },
    reseteconomy: { args: '', desc: ({ coins }) => `Deja a todos en 0 ${coins} (pide confirmación).` },

    // --- casino ---
    dado: { args: '<monto>', desc: ({ fmt, cfg }) => `Duelo de dados contra el bot (mínimo ${fmt(cfg.casino.dado.minBet)}).` },
    coinflip: { args: '<monto> [cara|cruz]', desc: 'Cara o cruz.' },
    roulette: { args: '<monto> [red|black]', desc: 'Ruleta: rojo o negro (el 0 pierde).' },
    raspa: { args: '<monto>', desc: ({ cfg }) => `Raspa y gana: 3 iguales = ganas (${cfg.casino.raspa.dailyLimit} intentos al día).` },
    bj: { args: '<monto>', desc: 'Blackjack contra el dealer.' },
    hit: { args: '', desc: 'Blackjack: pedir carta.' },
    stand: { args: '', desc: 'Blackjack: plantarte.' },
    infobj: { args: '', desc: 'Reglas del blackjack.' },
    poker: { args: '<monto>', desc: 'Póker de 3 cartas contra el crupier (tu apuesta es el ANTE).' },
    play: { args: '', desc: 'Póker: seguir (apuestas otro ANTE).' },
    fold: { args: '', desc: 'Póker: retirarte y perder solo el ANTE.' },
    infopoker: { args: '', desc: 'Reglas del póker.' },
    ladder: { args: '<monto>', desc: 'Escalera del riesgo: sube y cobra antes de caer.' },
    subir: { args: '', desc: 'Escalera: subir un escalón.' },
    cobrar: { args: '', desc: 'Escalera: cobrar lo que llevas.' },
    bet: { args: '<monto>', desc: 'Abre una mesa de dados para todos ("bet cerrar" la cierra).' },
    join: { args: '', desc: 'Unirte a la mesa abierta.' },
    tirar: { args: '', desc: 'Tirar tu dado en la mesa.' },

    // --- perfil ---
    profile: { args: '[@user]', desc: ({ coins }) => `Perfil con foto, descripción, cumpleaños, pareja y ${coins}.` },
    getpic: { args: '[@user]', desc: 'Foto de perfil de alguien.' },
    setfav: { args: '<texto>', desc: 'Define tu personaje favorito.' },
    setdesc: { args: '<texto>', desc: 'Define tu descripción.' },
    setgenre: { args: '<hombre|mujer|otro>', desc: 'Define tu género.' },
    setbirth: { args: '<AAAA-MM-DD>', desc: 'Registra tu cumpleaños.' },
    setmeta: { args: '<autor> | <pack>', desc: 'Autor y pack de tus stickers.' },
    setpic: { args: '[imagen]', desc: 'Foto de perfil propia para el bot.' },
    delfavourite: { args: '', desc: 'Borra tu personaje favorito.' },
    deldescription: { args: '', desc: 'Borra tu descripción.' },
    delgenre: { args: '', desc: 'Borra tu género.' },
    delbirth: { args: '', desc: 'Borra tu cumpleaños.' },
    delstickermeta: { args: '', desc: 'Restablece el autor y pack de tus stickers.' },
    delpic: { args: '', desc: 'Borra tu foto de perfil del bot.' },
    birthdays: { args: '', desc: 'Cumpleaños de este mes.' },
    allbirthdays: { args: '', desc: 'Todos los cumpleaños registrados.' },
    marry: { args: '@user', desc: 'Propone matrimonio.' },
    acepto: { args: '', desc: 'Acepta una propuesta (matrimonio o intercambio).' },
    rechazo: { args: '', desc: 'Rechaza una propuesta.' },
    divorce: { args: '', desc: 'Te divorcias de tu pareja.' },

    // --- gacha ---
    roll: { args: '', desc: ({ every, cfg }) => `Revela un personaje al azar (${every(cfg.gacha.roll.windowMs)}).` },
    claim: { args: '[nombre]', desc: ({ every, cfg }) => `Reclama el personaje de una tirada, respondiéndole (${every(cfg.gacha.claim.cooldownMs)}).` },
    ginfo: { args: '', desc: 'Tus esperas de roll y claim, y tu colección.' },
    harem: { args: '[página] [@user]', desc: 'Tu colección de personajes (o la de otra persona).' },
    delchar: { args: '<nombre>', desc: 'Libera un personaje de tu colección.' },
    delallharem: { args: '', desc: 'Libera TODA tu colección (pide confirmación).' },
    ainfo: { args: '<anime>', desc: 'Personajes de un anime y quién los tiene.' },
    slist: { args: '[página]', desc: 'Animes disponibles.' },
    wimage: { args: '<nombre>', desc: 'Ficha de un personaje con su imagen.' },
    sell: { args: '<personaje> [precio]', desc: 'Pone un personaje en venta (sin precio, usa su valor).' },
    unsell: { args: '<personaje>', desc: 'Retira un personaje de la venta.' },
    market: { args: '[página]', desc: 'Personajes en venta.' },
    buycharacter: { args: '<#número|nombre>', desc: 'Compra un personaje del mercado.' },
    givechar: { args: '<personaje> @user', desc: 'Regala un personaje.' },
    trade: { args: '@user <mío> | <suyo>', desc: 'Propone un intercambio de personajes.' }
};

module.exports = { CATEGORIES, INFO };
