const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const createMessageHandler = require('./handlers/message');
const createGroupEvents = require('./handlers/groupEvents');
const selfguard = require('./lib/selfguard');
const { outgoing } = require('./lib/prefix');
const { checkTools } = require('./lib/media');
const { findChrome } = require('./lib/browser');
const { chromePath, inactivity } = require('./config');
const { sweepAll } = require('./lib/inactivity');

// Si WhatsApp cierra la sesión y Windows no puede borrar los archivos (EBUSY),
// la librería lanza un error que tumba el proceso: aquí se explica con claridad.
process.on('unhandledRejection', (err) => {
    const msg = String((err && err.message) || err);
    console.error('Error no controlado:', msg);
    if (/EBUSY|LocalAuth|logout/i.test(msg)) {
        console.error(
            'La sesión de WhatsApp se cerró y Windows no pudo borrarla (archivo en uso).\n' +
                'Cierra el bot, borra la carpeta .wwebjs_auth y vuelve a iniciar para escanear el QR.'
        );
        process.exit(1);
    }
});

const chrome = findChrome(chromePath);
console.log(
    chrome
        ? `Navegador: ${chrome}`
        : '⚠️ No encontré Google Chrome: los videos se enviarán como documento. ' +
              'Instálalo o define chromePath en config.js.'
);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        ...(chrome ? { executablePath: chrome } : {}),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--mute-audio',
            '--disable-background-networking',
            '--disable-backgrounding-occluded-windows',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--js-flags=--max-old-space-size=512'
        ]
    }
});

// Registra lo que el bot envía (para no ejecutarlo como comando) y adapta las ayudas
// de los textos al prefijo propio de cada grupo
selfguard.install(client, outgoing);

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n--- ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP ---\n');
});

client.on('ready', async () => {
    console.log('¡El bot está listo y funcionando!');

    // Avisa si faltan las herramientas de descarga
    const tools = await checkTools();
    console.log(tools.ytdlp ? `yt-dlp ${tools.ytdlp}` : '⚠️ yt-dlp NO encontrado: las descargas no funcionarán.');
    console.log(tools.ffmpeg ? 'ffmpeg OK' : '⚠️ ffmpeg NO encontrado: el audio y los mixes no funcionarán.');

    // Expulsión automática por inactividad (solo en los grupos donde un admin la activó)
    const sweep = () => sweepAll(client).catch((err) => console.error('[inactividad]', err.message));
    setTimeout(sweep, 2 * 60e3);
    setInterval(sweep, inactivity.sweepEveryMs);
});

// message_create también se dispara con tus propios mensajes,
// así puedes usar los comandos desde la cuenta del bot.
client.on('message_create', createMessageHandler(client));

// Bienvenida y despedida (la despedida cubre tanto salidas como expulsiones)
const groupEvents = createGroupEvents(client);
client.on('group_join', groupEvents.onJoin);
client.on('group_leave', groupEvents.onLeave);

client.initialize();
