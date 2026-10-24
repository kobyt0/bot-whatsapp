// Sticker de texto estilo "brat": letras Arial estrechas, texto justificado desde
// arriba a la izquierda, tamaño que llena el cuadro y un ligero desenfoque.
// Se dibuja con el navegador que ya usa el bot, así funcionan acentos y emojis.
const { userError } = require('./media');
const { textSticker: cfg } = require('../config');

// nombre -> [fondo, color del texto]
const COLORS = {
    blanco: ['#FFFFFF', '#000000'],
    verde: ['#8ACE00', '#000000'], // el verde original de "brat"
    negro: ['#000000', '#FFFFFF'],
    azul: ['#0000FF', '#FFFFFF']
};
const ALIASES = { white: 'blanco', green: 'verde', black: 'negro', blue: 'azul' };

// "verde: hola" -> { color: 'verde', text: 'hola' }; sin prefijo usa el color por defecto
function parseColor(input) {
    const raw = (input || '').trim();
    const m = /^([A-Za-z]+)\s*:\s*([\s\S]+)$/.exec(raw);
    if (m) {
        const key = m[1].toLowerCase();
        const color = COLORS[key] ? key : ALIASES[key];
        if (color) return { color, text: m[2].trim() };
    }
    return { color: cfg.defaultColor, text: raw };
}

function buildHtml(bg, fg) {
    const size = 512;
    const pad = Number(cfg.padding);
    const narrow = Number(cfg.narrow);
    const innerW = (size - 2 * pad) / narrow; // se estrecha luego con scaleX
    const maxH = size - 2 * pad;

    // El tamaño de letra se busca así: el más grande en el que NINGUNA palabra se parte y todo cabe.
    // Solo si ni con la letra más pequeña cabe una palabra (una "palabra" enorme) se permite partirla.
    // Si el texto son solo emojis, se agrandan y se centran.
    const script = String.raw`
function fit(text){
  var t=document.getElementById('t'); t.textContent=text;
  var minF=${Number(cfg.minFont)}, maxF=${Number(cfg.maxFont)};
  var emojiOnly=/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u200d\ufe0f\u{1F3FB}-\u{1F3FF}]|\s)+$/u.test(text);
  if(emojiOnly){ maxF=${Number(cfg.emojiMaxFont)}; t.style.textAlign='center'; t.style.textAlignLast='center'; }
  function fits(){ return t.offsetHeight<=${maxH} && t.scrollWidth<=t.clientWidth+1; }
  function search(){
    var lo=minF, hi=maxF, best=0;
    while(lo<=hi){ var mid=(lo+hi)>>1; t.style.fontSize=mid+'px'; if(fits()){best=mid;lo=mid+1}else{hi=mid-1} }
    return best;
  }
  t.style.overflowWrap='normal';
  var best=search();
  if(!best){ t.style.overflowWrap='anywhere'; best=search()||minF; }
  t.style.fontSize=best+'px';
  if(emojiOnly){ t.style.top=Math.max(${pad},(512-t.offsetHeight)/2)+'px'; }
  return best;
}`;

    return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:${bg}}
#box{position:relative;width:${size}px;height:${size}px;overflow:hidden;background:${bg}}
#t{position:absolute;left:${pad}px;top:${pad}px;width:${innerW}px;
transform:scaleX(${narrow});transform-origin:top left;
font-family:Arial,'Helvetica Neue',Helvetica,'Segoe UI Emoji','Noto Color Emoji','Apple Color Emoji',sans-serif;
font-weight:400;color:${fg};line-height:${Number(cfg.lineHeight)};
text-align:justify;text-align-last:justify;white-space:pre-line;overflow-wrap:normal;word-break:normal;
filter:blur(${Number(cfg.blurPx)}px)}
</style></head><body><div id="box"><div id="t"></div></div><script>${script}</script></body></html>`;
}

// Devuelve un PNG de 512x512 en base64
async function renderTextSticker(client, text, { color } = {}) {
    const browser =
        client.pupBrowser ||
        (client.pupPage && typeof client.pupPage.browser === 'function' ? client.pupPage.browser() : null);
    if (!browser) throw userError('No pude acceder al navegador interno del bot.');

    const [bg, fg] = COLORS[color] || COLORS[cfg.defaultColor] || COLORS.blanco;

    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
        await page.setContent(buildHtml(bg, fg));
        await page.evaluate((t) => fit(t), text); // el texto se pasa como dato, nunca como HTML
        await page.evaluate(() => document.fonts.ready);
        const png = await page.screenshot({ type: 'png' });
        return Buffer.from(png).toString('base64');
    } finally {
        await page.close().catch(() => {});
    }
}

module.exports = { renderTextSticker, buildHtml, parseColor, COLORS };
