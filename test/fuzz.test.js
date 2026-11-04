import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, GameError } from '../server/game/engine.js';
import { botDecide, botObserve, applyBotAction, createBotMemory } from '../server/game/bot.js';
import { seededRng } from '../server/util.js';

/**
 * Plays thousands of full games with bots (plus random chaos: random nopes,
 * random illegal moves, players leaving) and checks invariants after every step.
 */
function playGame(seed, n, expansion) {
  const rng = seededRng(seed);
  const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot${i}` }));
  const g = new Game({ players, settings: { expansion }, rng });
  const mem = Object.fromEntries(players.map((p) => [p.id, createBotMemory()]));
  const total = g.totalCards;

  const check = () => {
    assert.equal(g.countAllCards(), total, `card leak (seed ${seed})`);
    const ids = new Set();
    const all = [...g.deck, ...g.discard, ...g.removed, ...g.players.flatMap((p) => p.hand)];
    if (g.prompt?.type === 'defuse') all.push(g.prompt.card);
    for (const c of all) {
      assert.ok(!ids.has(c.id), `duplicate card ${c.id} (seed ${seed})`);
      ids.add(c.id);
    }
    if (g.phase === 'playing') {
      const alive = g.alivePlayers().length;
      assert.ok(alive >= 2);
      assert.ok(g.current().alive, 'current player must be alive');
      const kittens = g.kaboomsInDeck() + (g.prompt?.type === 'defuse' ? 1 : 0);
      assert.equal(kittens, alive - 1, `kitten count (seed ${seed})`);
      assert.ok(g.deck.length > 0 || g.prompt?.type === 'defuse');
      for (const p of g.players) if (!p.alive) assert.equal(p.hand.length, 0);
    }
  };

  let steps = 0;
  while (g.phase === 'playing') {
    if (++steps > 20000) assert.fail(`game did not finish (seed ${seed})`);
    for (const ev of g.drainEvents()) {
      for (const p of players) if (!ev.to || ev.to === p.id) botObserve(mem[p.id], ev);
    }

    // Chaos: occasionally someone leaves.
    if (rng() < 0.002 && g.alivePlayers().length > 2) {
      const alive = g.alivePlayers();
      g.removePlayer(alive[Math.floor(rng() * alive.length)].id);
      check();
      continue;
    }
    // Chaos: random illegal actions must throw GameError and change nothing.
    if (rng() < 0.05) {
      const before = g.countAllCards();
      const p = g.players[Math.floor(rng() * n)];
      try {
        const r = rng();
        if (r < 0.3) g.draw(p.id);
        else if (r < 0.6) g.playCards(p.id, [p.hand[0]?.id ?? 'x'], { targetId: 'nobody' });
        else g.respond(p.id, { position: 'abc', order: 'x', cardId: 'zzz' });
      } catch (err) {
        if (!(err instanceof GameError)) throw err;
      }
      assert.equal(g.countAllCards(), before);
      check();
      continue;
    }

    let acted = false;
    for (const p of [...g.alivePlayers()].sort(() => rng() - 0.5)) {
      const action = botDecide(g, p.id, mem[p.id], rng);
      if (!action) continue;
      applyBotAction(g, p.id, action);
      acted = true;
      break;
    }
    if (!acted) {
      if (g.pending) g.resolvePending();
      else if (g.prompt) g.timeoutPrompt();
      else assert.fail(`stuck: no one can act (seed ${seed})`);
    }
    check();
  }
  assert.equal(g.alivePlayers().length, 1);
  assert.ok(g.winnerId);
  return steps;
}

test('fuzz: 3000 full bot games across 2-10 players stay consistent', () => {
  let games = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const n = 2 + (seed % 9);
    playGame(seed, n, seed % 2 === 0);
    games++;
  }
  assert.equal(games, 3000);
});
