#!/usr/bin/env node
// Descarga los personajes más populares de AniList (API pública, sin clave) y los guarda
// en data/characters.json. Se ejecuta una sola vez:
//
//     node tools/seed-characters.js            (1000 personajes)
//     node tools/seed-characters.js 500        (otra cantidad)
//
// AniList permite unas 90 peticiones por minuto; cada una trae 50 personajes.
const fs = require('fs');
const path = require('path');

const API = 'https://graphql.anilist.co';
const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    characters(sort: FAVOURITES_DESC) {
      id
      name { full native alternative }
      image { large }
      favourites
      anime: media(type: ANIME, sort: POPULARITY_DESC, perPage: 1) { nodes { title { romaji english } } }
      any: media(sort: POPULARITY_DESC, perPage: 1) { nodes { title { romaji english } } }
    }
  }
}`;

const title = (n) => n && n.title && (n.title.english || n.title.romaji);

// Un personaje de la API -> el registro que usa el bot (o null si le faltan datos)
function toRecord(node) {
    if (!node || !node.id || !node.name || !node.name.full) return null;
    const anime = title(node.anime && node.anime.nodes && node.anime.nodes[0]) || title(node.any && node.any.nodes && node.any.nodes[0]);
    const image = node.image && node.image.large;
    if (!anime || !image) return null;
    return {
        id: node.id,
        name: node.name.full,
        native: node.name.native || '',
        alt: (node.name.alternative || []).filter(Boolean).slice(0, 6),
        anime,
        image,
        fav: node.favourites || 0
    };
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page, perPage, { fetchImpl, sleep, log }) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await fetchImpl(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ query: QUERY, variables: { page, perPage } })
        });

        if (res.status === 429) {
            const wait = (parseInt(res.headers && res.headers.get && res.headers.get('retry-after'), 10) || 60) * 1000;
            log(`  AniList pidió esperar ${Math.round(wait / 1000)} s (límite de peticiones)...`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`AniList respondió con error ${res.status}`);

        const json = await res.json();
        if (json.errors) throw new Error('AniList devolvió errores: ' + JSON.stringify(json.errors).slice(0, 300));
        return json.data.Page;
    }
    throw new Error('AniList sigue limitando las peticiones; inténtalo de nuevo en unos minutos.');
}

async function seed({ count = 1000, out, fetchImpl = fetch, sleep = defaultSleep, log = console.log, pauseMs = 1000 } = {}) {
    const result = [];
    const seen = new Set();
    let page = 1;

    while (result.length < count) {
        log(`Página ${page} (${result.length}/${count})...`);
        const data = await fetchPage(page, 50, { fetchImpl, sleep, log });
        for (const node of data.characters || []) {
            const rec = toRecord(node);
            if (rec && !seen.has(rec.id) && result.length < count) {
                seen.add(rec.id);
                result.push(rec);
            }
        }
        if (!data.pageInfo || !data.pageInfo.hasNextPage) break;
        page++;
        await sleep(pauseMs);
    }

    result.sort((a, b) => b.fav - a.fav);
    if (out) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify(result));
    }
    return result;
}

if (require.main === module) {
    const count = parseInt(process.argv[2], 10) || 1000;
    const out = path.join(__dirname, '..', 'data', 'characters.json');
    seed({ count, out })
        .then((list) => console.log(`\n✅ ${list.length} personajes guardados en ${out}`))
        .catch((err) => {
            console.error('\n❌', err.message);
            process.exit(1);
        });
}

module.exports = { toRecord, seed, QUERY };
