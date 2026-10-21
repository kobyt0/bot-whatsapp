const eco = require('./economy');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(eco.rng.fn() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// v: 1 (A) ... 13 (K)
function newDeck() {
    const d = [];
    for (const s of SUITS) RANKS.forEach((r, i) => d.push({ r, v: i + 1, s }));
    return shuffle(d);
}

const show = (c) => `${c.r}${c.s}`;
const label = (v) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[v] || String(v));

// ---------- blackjack ----------
function bjValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
        if (c.v === 1) {
            aces++;
            total += 11;
        } else total += Math.min(c.v, 10);
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}
const isNatural = (hand) => hand.length === 2 && bjValue(hand) === 21;

// ---------- poker de 3 cartas ----------
// escalera de color > trío > escalera > color > par > carta alta
function pokerEval(cards) {
    const vals = cards.map((c) => (c.v === 1 ? 14 : c.v)).sort((a, b) => b - a);
    const flush = cards.every((c) => c.s === cards[0].s);

    let straight = false;
    let high = vals[0];
    if (vals[0] - 1 === vals[1] && vals[1] - 1 === vals[2]) straight = true;
    else if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2) {
        straight = true; // A-2-3: la escalera más baja
        high = 3;
    }

    const counts = {};
    vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const trips = Object.keys(counts).find((k) => counts[k] === 3);
    const pair = Object.keys(counts).find((k) => counts[k] === 2);

    if (straight && flush) return { rank: 6, tb: [high], name: `escalera de color (${label(high)} alta)` };
    if (trips) return { rank: 5, tb: [+trips], name: `trío de ${label(+trips)}` };
    if (straight) return { rank: 4, tb: [high], name: `escalera (${label(high)} alta)` };
    if (flush) return { rank: 3, tb: vals, name: `color (${label(vals[0])} alta)` };
    if (pair) {
        const kicker = vals.find((v) => v !== +pair);
        return { rank: 2, tb: [+pair, kicker], name: `par de ${label(+pair)}` };
    }
    return { rank: 1, tb: vals, name: `carta alta ${label(vals[0])}` };
}

// >0 si gana a, <0 si gana b, 0 empate
function pokerCompare(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < Math.max(a.tb.length, b.tb.length); i++) {
        const d = (a.tb[i] || 0) - (b.tb[i] || 0);
        if (d) return d;
    }
    return 0;
}

module.exports = { newDeck, show, label, bjValue, isNatural, pokerEval, pokerCompare };
