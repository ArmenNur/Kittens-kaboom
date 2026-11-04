import { CAT_TYPES } from '../../shared/cards.js';

// How much a bot hates giving a card away (higher = keep).
const VALUE = {
  defuse: 100, nope: 40, attack: 35, skip: 30, alter: 30, future: 25, reverse: 25,
  shuffle: 20, bottom: 20, favor: 15,
  pizzacat: 5, discocat: 5, ninjacat: 5, wizardcat: 5, spacecat: 5,
};
const value = (type) => VALUE[type] ?? 10;

export function createBotMemory() {
  return { future: null, consideredPending: null, turnKey: null, actionsThisTurn: 0 };
}

/** Feed private/public game events into a bot's memory. */
export function botObserve(memory, event) {
  if (event.type === 'future') memory.future = { cards: event.cards, deckVersion: event.deckVersion };
}

/**
 * Decide the next move for a bot, or null if it has nothing to do right now.
 * Bots never peek at hidden state — they only use their view + what they were shown.
 *
 * @returns {null | {type:'play', cardIds:string[], targetId?:string, namedType?:string}
 *                 | {type:'draw'} | {type:'nope'} | {type:'respond', payload:object}}
 */
export function botDecide(game, pid, memory, rng = Math.random) {
  if (game.phase !== 'playing') return null;
  const me = game.player(pid);
  if (!me || !me.alive) return null;

  // 1) Answer a prompt addressed to me.
  if (game.prompt) {
    if (game.prompt.playerId !== pid) return null;
    return { type: 'respond', payload: respond(game, pid, memory, rng) };
  }

  // 2) Consider noping a pending action (one roll per pending state).
  if (game.pending) {
    const pend = game.pending;
    const key = `${pend.id}:${pend.nopes}`;
    if (memory.consideredPending === key) return null;
    memory.consideredPending = key;
    if (!me.hand.some((c) => c.type === 'nope')) return null;
    const cancelled = pend.nopes % 2 === 1;
    const hurtsMe = pend.targetId === pid
      || (pend.kind === 'attack' && game.nextPlayer().id === pid);
    if (pend.playerId === pid && cancelled && rng() < 0.6) return { type: 'nope' };
    if (pend.playerId !== pid && hurtsMe && !cancelled && rng() < 0.65) return { type: 'nope' };
    if (pend.playerId !== pid && !cancelled && pend.kind === 'triple' && rng() < 0.3) return { type: 'nope' };
    return null;
  }

  // 3) My turn.
  if (game.current().id !== pid) return null;
  const turnKey = `${game.turnNumber}`;
  if (memory.turnKey !== turnKey) {
    memory.turnKey = turnKey;
    memory.actionsThisTurn = 0;
  }
  if (memory.actionsThisTurn >= 4) return { type: 'draw' };

  const play = chooseTurnPlay(game, me, memory, rng);
  if (play) {
    memory.actionsThisTurn++;
    return play;
  }
  return { type: 'draw' };
}

function respond(game, pid, memory, rng) {
  const pr = game.prompt;
  const me = game.player(pid);
  switch (pr.type) {
    case 'defuse': {
      const n = game.deck.length;
      // If I still have more turns, bury it so I don't draw it again.
      if (game.turnsRemaining > 1) return { position: Math.max(0, n - randBetween(0, Math.min(2, n), rng)) };
      // Otherwise often set it on top for the next victim.
      if (rng() < 0.5) return { position: 0 };
      return { position: randBetween(0, n, rng) };
    }
    case 'alter': {
      // I'm about to draw: push kittens to the back of the peeked three.
      const order = pr.cards.map((c, i) => i)
        .sort((a, b) => (pr.cards[a].type === 'kaboom') - (pr.cards[b].type === 'kaboom'));
      return { order };
    }
    case 'favor': {
      const worst = [...me.hand].sort((a, b) => value(a.type) - value(b.type))[0];
      return { cardId: worst.id };
    }
    case 'pickDiscard': {
      const ex = new Set(pr.exclude || []);
      const best = game.discard.filter((c) => !ex.has(c.id))
        .sort((a, b) => value(b.type) - value(a.type))[0];
      return { cardId: best?.id };
    }
    default:
      return {};
  }
}

function chooseTurnPlay(game, me, memory, rng) {
  const hand = me.hand;
  const byType = (t) => hand.filter((c) => c.type === t);
  const has = (t) => hand.some((c) => c.type === t);
  const first = (t) => hand.find((c) => c.type === t);

  const known = memory.future && memory.future.deckVersion === game.deckVersion ? memory.future.cards : null;
  const topIsKaboom = known ? known[0] === 'kaboom' : false;
  const deckCount = Math.max(1, game.deck.length);
  const danger = game.kaboomsInDeck() / deckCount;
  const hasDefuse = has('defuse');
  const opponents = game.alivePlayers().filter((p) => p.id !== me.id && p.hand.length > 0);
  const richest = opponents.sort((a, b) => b.hand.length - a.hand.length)[0];

  // Known bomb on top: get out of here.
  if (topIsKaboom) {
    for (const t of ['attack', 'skip', 'reverse', 'bottom', 'shuffle', 'alter']) {
      if (has(t)) return { type: 'play', cardIds: [first(t).id] };
    }
    return null; // will draw (and defuse if possible)
  }

  // Unknown future with decent danger: look before leaping.
  if (!known && danger > 0.12) {
    if (has('future') && rng() < 0.55) return { type: 'play', cardIds: [first('future').id] };
    if (has('alter') && rng() < 0.45) return { type: 'play', cardIds: [first('alter').id] };
  }

  // No defuse and things look grim: dodge.
  if (!hasDefuse && danger > 0.25 && !(known && known[0] !== 'kaboom')) {
    for (const t of ['attack', 'skip', 'reverse']) {
      if (has(t) && rng() < 0.8) return { type: 'play', cardIds: [first(t).id] };
    }
  }

  if (richest) {
    // No defuse: try to fish one out with a triple.
    if (!hasDefuse) {
      for (const t of Object.keys(VALUE)) {
        const same = byType(t);
        if (same.length >= 3 && t !== 'defuse' && t !== 'nope' && rng() < 0.7) {
          return { type: 'play', cardIds: same.slice(0, 3).map((c) => c.id), targetId: richest.id, namedType: 'defuse' };
        }
      }
    }
    // Cat pairs are free value.
    for (const t of CAT_TYPES) {
      const same = byType(t);
      if (same.length >= 2 && rng() < 0.6) {
        return { type: 'play', cardIds: same.slice(0, 2).map((c) => c.id), targetId: richest.id };
      }
    }
    if (has('favor') && rng() < 0.3) return { type: 'play', cardIds: [first('favor').id], targetId: richest.id };
  }

  // Five different with a Defuse waiting in the discard pile.
  if (!hasDefuse && game.discard.some((c) => c.type === 'defuse')) {
    const seen = new Map();
    for (const c of [...hand].sort((a, b) => value(a.type) - value(b.type))) {
      if (!seen.has(c.type)) seen.set(c.type, c);
    }
    if (seen.size >= 5) return { type: 'play', cardIds: [...seen.values()].slice(0, 5).map((c) => c.id) };
  }

  if (has('shuffle') && danger > 0.3 && rng() < 0.2) return { type: 'play', cardIds: [first('shuffle').id] };
  return null;
}

function randBetween(lo, hi, rng) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Apply a bot decision to the engine. Throws GameError when illegal. */
export function applyBotAction(game, pid, action) {
  switch (action.type) {
    case 'play': return game.playCards(pid, action.cardIds, { targetId: action.targetId, namedType: action.namedType });
    case 'draw': return game.draw(pid);
    case 'nope': return game.nope(pid);
    case 'respond': return game.respond(pid, action.payload);
    default: return undefined;
  }
}
