module.exports = {
    // Prefijos aceptados para los comandos
    prefixes: ['!', '/'],

    // Respaldo manual: IDs o números que SIEMPRE se consideran admins del bot.
    // Pega aquí lo que te muestre !whoami en "Tu ID" (ej: '203951186116623@lid')
    // o tu número ('573001234567'). Déjalo vacío si la detección automática funciona.
    owners: [],

    // Tiempo mínimo (ms) entre avisos iguales al mismo usuario en el mismo grupo.
    // Evita que el bot inunde el chat si alguien insiste. Pon 0 para avisar siempre.
    noticeCooldownMs: 10000,

    // Ruta a Google Chrome. Vacío = se detecta solo. Chrome (no el Chromium de Puppeteer)
    // es necesario para que los videos se envíen como video y no como documento.
    chromePath: '',

    // Sticker de texto estilo "brat" (ajusta aquí el aspecto sin tocar el código)
    textSticker: {
        defaultColor: 'blanco',  // blanco | verde | negro | azul
        blurPx: 1.5,             // desenfoque (0 = nítido)
        narrow: 0.84,            // 1 = ancho normal; menor = letras más estrechas (efecto Arial Narrow)
        lineHeight: 1.08,        // separación entre líneas
        padding: 20,             // margen en px (el sticker mide 512x512)
        maxFont: 160,            // tamaño máximo de letra en px
        emojiMaxFont: 340,       // tamaño máximo cuando el texto son solo emojis
        minFont: 16              // tamaño mínimo de letra en px
    },

    // Economía (todo ajustable). Los montos están en coins; los tiempos en milisegundos.
    economy: {
        currencyDefault: 'coins',
        work: { min: 300, max: 2000, cooldownMs: 5 * 60 * 1000 }, // 5 minutos
        slut: { min: 500, max: 5000, cooldownMs: 10 * 60 * 1000, failChance: 0.3, fineMin: 200, fineMax: 1500 }, // 10 minutos
        crime: { min: 1000, max: 10000, cooldownMs: 15 * 60 * 1000, failChance: 0.4, fineMin: 500, fineMax: 4000 }, // 15 minutos
        rob: {
            percent: 0.25,          // fracción del EFECTIVO de la víctima
            maxSteal: null,         // tope por robo (null = sin tope)
            minTargetCash: 200,     // efectivo mínimo de la víctima para poder robarle
            inactiveMs: 2 * 3600e3, // la víctima debe llevar este tiempo sin escribir
            cooldownMs: 6 * 3600e3,
            failChance: 0.4,
            fineMin: 300,
            fineMax: 3000
        },
        daily: {
            // día 1 -> 3.000 ... día 10 -> 30.000; desde el día 10 se queda en 30.000
            table: Array.from({ length: 10 }, (_, i) => 3000 * (i + 1)),
            cooldownMs: 24 * 3600e3, // tiempo mínimo entre reclamos
            maxGapMs: 48 * 3600e3    // si pasa más de esto, la racha vuelve al día 1
        }
    },

    // Perfil
    profile: {
        proposalMs: 60000, // tiempo que dura una propuesta de !marry
        maxDesc: 200,
        maxFav: 40,
        maxMeta: 30,       // autor y pack de los stickers
        listLimit: 60      // líneas máximas en !allbirthdays
    },

    // Gacha de personajes
    gacha: {
        roll: { max: 1, windowMs: 2 * 3600e3 },          // 1 roll cada 2 horas
        claim: { cooldownMs: 2 * 3600e3, windowMs: 60000 }, // 1 claim cada 2 horas; una tirada se puede reclamar 60 s
        tradeMs: 60000,                                  // duración de una propuesta de !trade
        pageSize: 10,
        // cut: fracción acumulada del ranking de popularidad; weight: probabilidad relativa en un roll;
        // base: valor en coins (varía ±20% según la posición dentro del nivel)
        tiers: {
            legendario: { cut: 0.03, weight: 3, base: 120000, label: '🟡 Legendario' },
            epico: { cut: 0.13, weight: 10, base: 30000, label: '🟣 Épico' },
            raro: { cut: 0.4, weight: 25, base: 8000, label: '🔵 Raro' },
            comun: { cut: 1, weight: 62, base: 2000, label: '⚪ Común' }
        }
    },

    // Warns
    warns: {
        maxReason: 100, // caracteres máximos del motivo
        listLimit: 40   // líneas máximas en !allwarns
    },

    // Casino. Cuando ganas recibes el doble de lo apostado (ganas lo que apostaste).
    casino: {
        minBet: 100,
        maxBet: null, // tope por apuesta (null = sin tope)
        dado: { minBet: 500 },
        raspa: {
            dailyLimit: 10,
            winChance: 0.4,
            symbols: ['🍋', '🍎', '🍒', '🍇', '🍉', '⭐'],
            animate: true,   // el mensaje se edita para simular que se raspa (si tu versión lo permite)
            animationMs: 900 // pausa entre cada paso de la animación
        },
        bj: { timeoutMs: 30000, naturalPayout: 1.5 }, // el blackjack natural paga 3:2
        poker: { timeoutMs: 30000 },
        ladder: {
            timeoutMs: 60000, // sin actividad: se cobra automáticamente lo que llevas
            // multiplicador del escalón y probabilidad de lograr subir a él
            steps: [
                { mult: 1.5, chance: 0.65 },
                { mult: 2, chance: 0.55 },
                { mult: 3, chance: 0.45 },
                { mult: 5, chance: 0.35 },
                { mult: 10, chance: 0.25 }
            ]
        },
        bet: { windowMs: 60000, maxPlayers: 10, minBet: 100 }
    },

    // Descargas y playlists
    media: {
        ytdlpPath: 'yt-dlp',      // o la ruta completa a yt-dlp.exe
        ffmpegPath: 'ffmpeg',     // o la ruta completa a ffmpeg.exe
        ffprobePath: '',          // vacío = se deduce de ffmpegPath
        jsRuntimes: 'node',       // YouTube exige un runtime JS. '' si usas Deno (es el predeterminado)
        cookiesFile: '',          // ruta a un cookies.txt (solo si YouTube pide verificación anti-bots)

        maxConcurrent: 2,         // descargas simultáneas
        maxQueue: 6,              // máximo de descargas en espera
        userCooldownMs: 20000,    // espera entre descargas del mismo usuario
        addCooldownMs: 2000,      // espera entre !addlist del mismo usuario

        maxVideoMin: 15,          // duración máxima de videos
        maxAudioMin: 15,          // duración máxima de una canción
        maxVideoMB: 60,           // tamaño máximo de video a enviar
        maxAudioMB: 50,           // tamaño máximo de audio a enviar

        tts: {
            defaultLang: 'es',    // idioma por defecto de !playaudio
            maxChars: 400,        // texto máximo por audio
            cooldownMs: 8000      // espera entre audios del mismo usuario
        },

        playlists: {
            maxPerUser: 10,
            maxSongs: 20,
            maxMixMin: 40         // duración total máxima de una playlist (mix)
        }
    }
};
