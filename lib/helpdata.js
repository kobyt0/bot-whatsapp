// Contenido del !help. Para añadir un comando nuevo al menú, agrega una línea en su categoría:
//   [['nombre', 'name'], 'argumentos (opcional)', 'Descripción corta']
// - El primer arreglo son los nombres con los que se muestra (ES / EN). Solo se muestran los que
//   existen de verdad en el bot, así que el mismo archivo sirve antes y después de hacerlos bilingües.
// - Los comandos de admin se marcan solos con 🛡️ (se leen de la propiedad adminOnly del comando).
// - Al arrancar, el bot avisa si algún comando no aparece aquí.

module.exports = [
    {
        title: '🛡️ Filtros y protección',
        items: [
            [['bot'], 'on|off', 'Activar o desactivar el bot'],
            [['onlyadmin'], 'on|off', 'Solo los admins pueden usar comandos'],
            [['antilink'], 'on|off', 'Borra mensajes con enlaces'],
            [['economy'], 'on|off', 'Activa o desactiva la economía'],
            [['gacha'], 'on|off', 'Activa o desactiva el sistema gacha'],
            [['comando'], '<comando> on|off', 'Activa o desactiva un comando en el grupo'],
            [['mute'], '30m|1h|1d|1w @usuario', 'Silencia a alguien (el bot borra sus mensajes)'],
            [['unmute'], '@usuario', 'Quita el silencio a un usuario'],
            [['mutes'], '', 'Lista de usuarios silenciados']
        ]
    },
    {
        title: '👮 Administración',
        items: [
            [['promote'], '@usuario', 'Hace admin a un miembro'],
            [['demote'], '@usuario', 'Quita el admin a un miembro'],
            [['kick'], '@usuario', 'Expulsa a un miembro'],
            [['close'], '', 'Solo los admins pueden escribir'],
            [['open'], '', 'Todos pueden escribir'],
            [['delete'], '(responde a un mensaje)', 'Borra un mensaje'],
            [['todos', 'tagall'], '[texto]', 'Menciona a todos sin mostrar los @ (alias: !tag)'],
            [['setnamegroup'], '<nombre>', 'Cambia el nombre del grupo'],
            [['setpfp'], '(imagen)', 'Cambia la foto del grupo'],
            [['setprefix'], '<prefijo>', 'Cambia el prefijo de comandos del grupo']
        ]
    },
    {
        title: '⚠️ Advertencias',
        items: [
            [['warn'], '@usuario [motivo]', 'Pone una advertencia'],
            [['unwarn'], '@usuario', 'Quita una advertencia'],
            [['resetwarn'], '@usuario', 'Borra todas las advertencias de alguien'],
            [['setwarnlimit'], '<1-20|off>', 'Advertencias para la expulsión automática'],
            [['warns'], '@usuario', 'Ver las advertencias de alguien'],
            [['mywarns'], '', 'Ver tus advertencias'],
            [['allwarns'], '', 'Lista de advertencias del grupo']
        ]
    },
    {
        title: '👋 Bienvenida y banner',
        items: [
            [['welcome'], 'on|off', 'Activa o desactiva la bienvenida'],
            [['goodbye'], 'on|off', 'Activa o desactiva la despedida'],
            [['setwelcome'], '<texto>', 'Personaliza el mensaje de bienvenida'],
            [['setgoodbye'], '<texto>', 'Personaliza el mensaje de despedida'],
            [['setbanner'], '(imagen)', 'Imagen para bienvenida y despedida (reset para quitarla)']
        ]
    },
    {
        title: '💰 Economía',
        items: [
            [['saldo', 'balance'], '[@usuario]', 'Tu dinero (efectivo y banco)'],
            [['daily'], '', 'Recompensa diaria con racha'],
            [['work', 'trabajar'], '', 'Trabaja para ganar coins'],
            [['slut'], '', 'Gana coins con encanto (puede salir mal)'],
            [['crime'], '', 'Comete un crimen (puede salir mal)'],
            [['robar', 'rob'], '@usuario', 'Intenta robar efectivo a alguien inactivo'],
            [['deposit', 'depositar'], '<monto|all|half>', 'Guarda efectivo en el banco'],
            [['retirar', 'withdraw'], '<monto|all|half>', 'Saca dinero del banco'],
            [['pay'], '<monto> @usuario', 'Envía coins a otro usuario'],
            [['baltop'], '', 'Ranking de los más ricos'],
            [['setcoins'], '<nombre|reset>', 'Cambia el nombre de la moneda del grupo'],
            [['reseteconomy'], '', 'Reinicia la economía del grupo']
        ]
    },
    {
        title: '🎰 Casino',
        items: [
            [['dado'], '<monto>', 'Apuesta a los dados'],
            [['coinflip', 'cf'], '<monto> [cara|cruz]', 'Cara o cruz'],
            [['roulette'], '<monto> [red|black]', 'Ruleta'],
            [['raspa'], '<monto|all|half>', 'Raspadita con premios'],
            [['bj', 'blackjack'], '<monto|all|half>', 'Empieza una partida de blackjack'],
            [['hit'], '', 'Blackjack: pedir carta'],
            [['stand'], '', 'Blackjack: plantarse'],
            [['infobj'], '', 'Reglas del blackjack'],
            [['ladder'], '<monto|all|half>', 'Escalera de multiplicadores'],
            [['subir'], '', 'Escalera: subir un escalón'],
            [['cobrar'], '', 'Escalera: cobrar lo acumulado'],
            [['poker'], '<monto|all|half>', 'Empieza una partida de póker'],
            [['play'], '', 'Póker: igualar la apuesta'],
            [['fold'], '', 'Póker: retirarse'],
            [['infopoker'], '', 'Reglas del póker'],
            [['bet'], '<monto|all|half>', 'Abre una mesa de dados entre varios'],
            [['join'], '', 'Mesa: unirse a la apuesta'],
            [['tirar'], '', 'Mesa: tirar los dados']
        ]
    },
    {
        title: '🎴 Gacha y mercado',
        items: [
            [['roll', 'rw'], '', 'Tira para que aparezca un personaje'],
            [['claim', 'reclamar', 'c'], '', 'Reclama el personaje que salió'],
            [['harem', 'libro'], '[@usuario]', 'Tu colección de personajes'],
            [['ginfo'], '', 'Información de tu gacha (tiradas y tiempos)'],
            [['wimage'], '<personaje>', 'Muestra la imagen de un personaje'],
            [['ainfo'], '<anime>', 'Personajes de un anime'],
            [['slist'], '', 'Animes disponibles'],
            [['delchar'], '<personaje>', 'Elimina un personaje tuyo'],
            [['delallharem'], '', 'Elimina toda tu colección'],
            [['sell'], '<personaje> [precio]', 'Pon un personaje en venta'],
            [['unsell', 'cancelsell'], '<personaje>', 'Retira un personaje de la venta'],
            [['market'], '', 'Personajes en venta'],
            [['buycharacter', 'buychar'], '<#número|nombre>', 'Compra un personaje del mercado'],
            [['givechar'], '<personaje> @usuario', 'Regala un personaje'],
            [['trade'], '@usuario <mío> | <suyo>', 'Intercambia personajes']
        ]
    },
    {
        title: '👤 Perfil y social',
        items: [
            [['profile', 'perfil'], '[@usuario]', 'Ver un perfil'],
            [['getpic', 'pfp'], '[@usuario]', 'Foto de perfil de alguien'],
            [['setpic', 'setphoto', 'setavatar'], '(imagen)', 'Foto de tu perfil del bot'],
            [['delpic', 'delphoto', 'delavatar'], '', 'Quita tu foto del perfil'],
            [['setfav', 'setfavourite'], '<texto>', 'Tu personaje favorito'],
            [['setdesc', 'setdescription'], '<texto>', 'Tu descripción'],
            [['setgenre'], '<hombre|mujer|otro>', 'Tu género'],
            [['setbirth'], 'AAAA-MM-DD', 'Tu cumpleaños'],
            [['setmeta', 'setstickermeta'], '<autor> | <pack>', 'Autor y pack de tus stickers'],
            [['delfavourite', 'delfav'], '', 'Borra tu favorito'],
            [['deldescription', 'deldesc'], '', 'Borra tu descripción'],
            [['delgenre'], '', 'Borra tu género'],
            [['delbirth'], '', 'Borra tu cumpleaños'],
            [['delstickermeta', 'delmeta'], '', 'Borra autor y pack de stickers'],
            [['birthdays'], '', 'Próximos cumpleaños'],
            [['allbirthdays'], '', 'Todos los cumpleaños del grupo'],
            [['marry'], '@usuario', 'Propón matrimonio'],
            [['acepto'], '', 'Acepta una propuesta'],
            [['rechazo'], '', 'Rechaza una propuesta'],
            [['divorce'], '', 'Divorciarte']
        ]
    },
    {
        title: '🎵 Multimedia',
        items: [
            [['sticker'], '(imagen o video)', 'Crea un sticker'],
            [['youtube', 'yt'], '<enlace> [360|720]', 'Descarga un video de YouTube'],
            [['ytmusic', 'ytmp3', 'music'], '<canción o enlace>', 'Descarga el audio de una canción'],
            [['tiktok', 'tk'], '<enlace> [audio]', 'Descarga un TikTok'],
            [['tkaudio', 'tiktokaudio', 'tkmp3', 'tiktokmp3'], '<enlace>', 'Solo el audio de un TikTok'],
            [['playaudio'], '<texto>', 'Convierte texto en nota de voz'],
            [['playlist'], '', 'Tus playlists'],
            [['addlist'], '<playlist> | <canción>', 'Añade una canción a una playlist'],
            [['dellist'], '<playlist> | <texto|número>', 'Quita una canción de una playlist'],
            [['viewlist'], '<playlist>', 'Ver las canciones de una playlist'],
            [['delplaylist'], '<playlist>', 'Borra una playlist'],
            [['listen'], '<playlist>', 'Mix de audio con tu playlist'],
            [['say'], '<mensaje>', 'El bot repite tu mensaje']
        ]
    },
    {
        title: 'ℹ️ Información',
        items: [
            [['help', 'ayuda', 'menu', 'comandos'], '', 'Muestra este menú'],
            [['status'], '', 'Estado del bot'],
            [['ping'], '', 'Velocidad de respuesta'],
            [['infobots'], '', 'Información del bot y de este grupo'],
            [['whoami'], '', 'Tu ID (para configurar owners)']
        ]
    }
];
