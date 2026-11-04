import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, GameError } from '../server/game/engine.js';
import { deckSpec, HAND_SIZE } from '../shared/cards.js';
import { seededRng } from '../server/util.js';

const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

function newGame(n = 3, seed = 1, settings = {}) {
  const g = new Game({ players: mkPlayers(n), settings, rng: seededRng(seed) });
  g.turnIndex = 0;
  return g;
}

/** Give a player a specific card (created fresh, conserving totals is not needed for these tests). */
function give(g, pid, type) {
  const card = g.makeCard(type);
  g.player(pid).hand.push(card);
  return card;
}

function stackDeck(g, types) {
  g.deck = types.map((t) => g.makeCard(t));
}

test('setup deals 4 + defuse, kittens = players-1, cards conserved', () => {
  for (let n = 2; n <= 10; n++) {
    const g = new Game({ players: mkPlayers(n), rng: seededRng(n) });
    for (const p of g.players) {
      assert.equal(p.hand.length, HAND_SIZE + 1);
      assert.ok(p.hand.some((c) => c.type === 'defuse'));
      assert.ok(!p.hand.some((c) => c.type === 'kaboom'));
    }
    assert.equal(g.kaboomsInDeck(), n - 1);
    assert.equal(g.countAllCards(), g.totalCards);
    const spec = deckSpec(n);
    assert.equal(g.totalCards, spec.main.length + n + spec.extraDefuses + spec.kabooms);
  }
});

test('rejects bad player counts', () => {
  assert.throws(() => new Game({ players: mkPlayers(1) }), GameError);
  assert.throws(() => new Game({ players: mkPlayers(11) }), GameError);
});

test('drawing a normal card ends the turn', () => {
  const g = newGame();
  stackDeck(g, ['skip', 'kaboom', 'kaboom']);
  g.draw('p0');
  assert.equal(g.current().id, 'p1');
  assert.ok(g.player('p0').hand.some((c) => c.type === 'skip'));
});

test('cannot act out of turn', () => {
  const g = newGame();
  assert.throws(() => g.draw('p1'), /not your turn/);
});

test('skip ends turn without drawing after the nope window', () => {
  const g = newGame();
  const skip = give(g, 'p0', 'skip');
  const deckBefore = g.deck.length;
  g.playCards('p0', [skip.id]);
  assert.ok(g.pending);
  assert.throws(() => g.draw('p0'), /resolve/);
  g.resolvePending();
  assert.equal(g.current().id, 'p1');
  assert.equal(g.deck.length, deckBefore);
});

test('nope cancels, nope-nope restores', () => {
  const g = newGame();
  const skip = give(g, 'p0', 'skip');
  give(g, 'p1', 'nope');
  give(g, 'p2', 'nope');
  g.playCards('p0', [skip.id]);
  g.nope('p1');
  g.resolvePending();
  assert.equal(g.current().id, 'p0', 'single nope cancels the skip');

  const skip2 = give(g, 'p0', 'skip');
  give(g, 'p1', 'nope');
  g.playCards('p0', [skip2.id]);
  g.nope('p1');
  g.nope('p2');
  g.resolvePending();
  assert.equal(g.current().id, 'p1', 'double nope lets the skip through');
});

test('cannot nope without a nope card or without a pending action', () => {
  const g = newGame();
  g.player('p1').hand = g.player('p1').hand.filter((c) => c.type !== 'nope');
  assert.throws(() => g.nope('p1'), /nothing to Nope/);
  const skip = give(g, 'p0', 'skip');
  g.playCards('p0', [skip.id]);
  assert.throws(() => g.nope('p1'), /don't have a Nope/);
});

test('attack gives next player 2 turns and stacks', () => {
  const g = newGame(3);
  stackDeck(g, ['skip', 'skip', 'skip', 'skip', 'kaboom']);
  const a1 = give(g, 'p0', 'attack');
  g.playCards('p0', [a1.id]);
  g.resolvePending();
  assert.equal(g.current().id, 'p1');
  assert.equal(g.turnsRemaining, 2);

  // p1 attacks back while under attack: p2 gets 2 + 2 = 4
  const a2 = give(g, 'p1', 'attack');
  g.playCards('p1', [a2.id]);
  g.resolvePending();
  assert.equal(g.current().id, 'p2');
  assert.equal(g.turnsRemaining, 4);

  g.draw('p2');
  assert.equal(g.current().id, 'p2');
  assert.equal(g.turnsRemaining, 3);
});

test('attack on the last of multiple turns passes exactly 2', () => {
  const g = newGame(3);
  stackDeck(g, ['skip', 'skip', 'kaboom']);
  g.turnsRemaining = 2;
  g.draw('p0');
  assert.equal(g.turnsRemaining, 1);
  const a = give(g, 'p0', 'attack');
  g.playCards('p0', [a.id]);
  g.resolvePending();
  assert.equal(g.current().id, 'p1');
  assert.equal(g.turnsRemaining, 2);
});

test('kaboom with defuse prompts for placement and reinserts', () => {
  const g = newGame(3);
  stackDeck(g, ['kaboom', 'skip', 'skip', 'skip']);
  g.draw('p0');
  assert.equal(g.prompt.type, 'defuse');
  assert.equal(g.prompt.playerId, 'p0');
  assert.ok(!g.player('p0').hand.some((c) => c.type === 'defuse'));
  assert.throws(() => g.draw('p0'), /decision/);
  g.respond('p0', { position: 2 });
  assert.equal(g.deck[2].type, 'kaboom');
  assert.equal(g.current().id, 'p1');
});

test('kaboom without defuse eliminates; last player wins', () => {
  const g = newGame(2);
  for (const p of g.players) p.hand = p.hand.filter((c) => c.type !== 'defuse');
  stackDeck(g, ['kaboom', 'skip']);
  g.draw('p0');
  assert.equal(g.player('p0').alive, false);
  assert.equal(g.phase, 'ended');
  assert.equal(g.winnerId, 'p1');
});

test('elimination passes the turn and clears stacked attack turns', () => {
  const g = newGame(3);
  g.player('p0').hand = [];
  g.turnsRemaining = 3;
  stackDeck(g, ['kaboom', 'kaboom', 'skip']);
  g.draw('p0');
  assert.equal(g.player('p0').alive, false);
  assert.equal(g.current().id, 'p1');
  assert.equal(g.turnsRemaining, 1);
});

test('favor: target picks a card to give', () => {
  const g = newGame();
  const fav = give(g, 'p0', 'favor');
  g.playCards('p0', [fav.id], { targetId: 'p2' });
  g.resolvePending();
  assert.equal(g.prompt.type, 'favor');
  assert.equal(g.prompt.playerId, 'p2');
  const giveCard = g.player('p2').hand[0];
  g.respond('p2', { cardId: giveCard.id });
  assert.ok(g.player('p0').hand.some((c) => c.id === giveCard.id));
  assert.equal(g.current().id, 'p0', 'favor does not end the turn');
});

test('pair steals a random card; triple asks for a named card', () => {
  const g = newGame();
  const c1 = give(g, 'p0', 'ninjacat');
  const c2 = give(g, 'p0', 'ninjacat');
  const before = g.player('p1').hand.length;
  g.playCards('p0', [c1.id, c2.id], { targetId: 'p1' });
  g.resolvePending();
  assert.equal(g.player('p1').hand.length, before - 1);

  const t = [give(g, 'p0', 'spacecat'), give(g, 'p0', 'spacecat'), give(g, 'p0', 'spacecat')];
  const wanted = give(g, 'p2', 'reverse');
  g.playCards('p0', t.map((c) => c.id), { targetId: 'p2', namedType: 'reverse' });
  g.resolvePending();
  assert.ok(g.player('p0').hand.some((c) => c.id === wanted.id));
});

test('five different cards lets you take from the discard pile', () => {
  const g = newGame();
  const prize = g.makeCard('defuse');
  g.discard.push(prize);
  const five = ['pizzacat', 'discocat', 'ninjacat', 'wizardcat', 'spacecat'].map((t) => give(g, 'p0', t));
  g.playCards('p0', five.map((c) => c.id));
  g.resolvePending();
  assert.equal(g.prompt.type, 'pickDiscard');
  assert.throws(() => g.respond('p0', { cardId: five[0].id }), /different/);
  g.respond('p0', { cardId: prize.id });
  assert.ok(g.player('p0').hand.some((c) => c.id === prize.id));
});

test('invalid combos and targets are rejected', () => {
  const g = newGame();
  const a = give(g, 'p0', 'pizzacat');
  const b = give(g, 'p0', 'discocat');
  assert.throws(() => g.playCards('p0', [a.id]), /matching/);
  assert.throws(() => g.playCards('p0', [a.id, b.id], { targetId: 'p1' }), /Combos/);
  const c = give(g, 'p0', 'pizzacat');
  assert.throws(() => g.playCards('p0', [a.id, c.id], { targetId: 'p0' }), /yourself/);
  assert.throws(() => g.playCards('p0', [a.id, c.id]), /still in the game/);
  const nope = give(g, 'p0', 'nope');
  assert.throws(() => g.playCards('p0', [nope.id]), /against an action/);
  assert.throws(() => g.playCards('p0', ['nope-such-card']), /don't have/);
});

test('see the future emits a private event with top 3', () => {
  const g = newGame();
  stackDeck(g, ['skip', 'kaboom', 'attack', 'favor']);
  const f = give(g, 'p0', 'future');
  g.playCards('p0', [f.id]);
  g.drainEvents();
  g.resolvePending();
  const ev = g.drainEvents().find((e) => e.type === 'future');
  assert.equal(ev.to, 'p0');
  assert.deepEqual(ev.cards, ['skip', 'kaboom', 'attack']);
});

test('alter the future reorders the top cards', () => {
  const g = newGame(3, 1, { expansion: true });
  stackDeck(g, ['kaboom', 'skip', 'attack', 'favor']);
  const a = give(g, 'p0', 'alter');
  g.playCards('p0', [a.id]);
  g.resolvePending();
  assert.equal(g.prompt.type, 'alter');
  assert.throws(() => g.respond('p0', { order: [0, 0, 1] }), /Invalid/);
  g.respond('p0', { order: [2, 1, 0] });
  assert.deepEqual(g.deck.slice(0, 4).map((c) => c.type), ['attack', 'skip', 'kaboom', 'favor']);
});

test('reverse flips direction', () => {
  const g = newGame(4);
  const r = give(g, 'p0', 'reverse');
  g.playCards('p0', [r.id]);
  g.resolvePending();
  assert.equal(g.direction, -1);
  assert.equal(g.current().id, 'p3');
});

test('draw from bottom takes the bottom card', () => {
  const g = newGame();
  stackDeck(g, ['kaboom', 'kaboom', 'shuffle']);
  const b = give(g, 'p0', 'bottom');
  g.playCards('p0', [b.id]);
  g.resolvePending();
  assert.ok(g.player('p0').hand.some((c) => c.type === 'shuffle'));
  assert.equal(g.current().id, 'p1');
});

test('player leaving mid-game removes a kitten and passes the turn', () => {
  const g = new Game({ players: mkPlayers(4), rng: seededRng(9) });
  g.turnIndex = 1;
  g.removePlayer('p1');
  assert.equal(g.kaboomsInDeck(), 2);
  assert.equal(g.current().id, 'p2');
  assert.equal(g.countAllCards(), g.totalCards);
});

test('leaving during your own defuse prompt does not leak cards', () => {
  const g = newGame(3);
  stackDeck(g, ['kaboom', 'kaboom', 'skip']);
  g.totalCards = g.countAllCards();
  g.draw('p0');
  assert.equal(g.prompt.type, 'defuse');
  g.removePlayer('p0');
  assert.equal(g.prompt, null);
  assert.equal(g.countAllCards(), g.totalCards);
  assert.equal(g.kaboomsInDeck(), 1);
});

test('views hide other hands and private prompt data', () => {
  const g = newGame(3, 1, { expansion: true });
  const a = give(g, 'p0', 'alter');
  g.playCards('p0', [a.id]);
  g.resolvePending();
  const mine = g.view('p0');
  const theirs = g.view('p1');
  assert.ok(Array.isArray(mine.prompt.cards));
  assert.equal(theirs.prompt.cards, undefined);
  assert.ok(theirs.hand.every((c) => g.player('p1').hand.some((h) => h.id === c.id)));
  assert.equal(JSON.stringify(theirs).includes(JSON.stringify(g.player('p0').hand[0])), false);
});
