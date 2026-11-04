import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioc } from 'socket.io-client';
import { createServer } from '../server/index.js';

function startServer() {
  // timeScale shrinks nope windows / bot delays so a full game runs in seconds.
  const srv = createServer({ timeScale: 0.02 });
  return new Promise((resolve) => {
    srv.server.listen(0, () => resolve({ ...srv, url: `http://localhost:${srv.server.address().port}` }));
  });
}

function client(url) {
  const socket = ioc(url, { transports: ['websocket'], forceNew: true });
  const c = { socket, state: null, events: [] };
  socket.on('state', (s) => { c.state = s; });
  socket.on('game:event', (e) => c.events.push(e));
  c.call = (event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve));
  c.waitFor = (pred, ms = 15000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (c.state && pred(c.state)) return resolve(c.state);
      if (Date.now() - start > ms) return reject(new Error('timeout waiting for state'));
      setTimeout(tick, 10);
    };
    tick();
  });
  return new Promise((resolve) => socket.on('connect', () => resolve(c)));
}

/** A dumb human: draws on its turn and accepts default answers to prompts. */
function autoplay(c) {
  const step = () => {
    const s = c.state;
    if (!s?.game || s.game.phase !== 'playing') return;
    const g = s.game;
    const pr = g.prompt;
    if (pr && pr.playerId === s.you) {
      const payload = { promptId: pr.id };
      if (pr.type === 'defuse') payload.position = Math.floor(Math.random() * (pr.deckCount + 1));
      if (pr.type === 'alter') payload.order = pr.cards.map((_, i) => i);
      if (pr.type === 'favor') payload.cardId = g.hand[0]?.id;
      if (pr.type === 'pickDiscard') payload.cardId = g.discard.find((d) => !pr.exclude.includes(d.id))?.id;
      c.call('game:respond', payload);
    } else if (!pr && !g.pending && g.turnPlayerId === s.you) {
      const skip = g.hand.find((h) => h.type === 'skip');
      if (skip && Math.random() < 0.3) c.call('game:play', { cardIds: [skip.id] });
      else c.call('game:draw');
    } else if (g.pending && g.pending.playerId !== s.you && g.hand.some((h) => h.type === 'nope') && Math.random() < 0.1) {
      c.call('game:nope');
    }
  };
  c.socket.on('state', () => setTimeout(step, 5));
}

test('full multiplayer game over sockets with humans + bots', { timeout: 120000 }, async () => {
  const srv = await startServer();
  try {
    const a = await client(srv.url);
    const b = await client(srv.url);

    const created = await a.call('room:create', { name: 'Alice' });
    assert.equal(created.ok, true);
    assert.match(created.code, /^[A-Z]{4}$/);

    // Non-host can't start / add bots.
    const joined = await b.call('room:join', { code: created.code.toLowerCase(), name: 'Bob' });
    assert.equal(joined.ok, true);
    assert.equal((await b.call('game:start')).ok, false);
    assert.equal((await b.call('room:addBot')).ok, false);

    // Bad room code.
    const c3 = await client(srv.url);
    const bad = await c3.call('room:join', { code: 'ZZZZ', name: 'X' });
    assert.equal(bad.ok, false);

    for (let i = 0; i < 3; i++) assert.equal((await a.call('room:addBot')).ok, true);
    await a.call('room:settings', { nopeSeconds: 2, expansion: true });
    await a.waitFor((s) => s.room.players.length === 5);

    autoplay(a);
    autoplay(b);
    assert.equal((await a.call('game:start')).ok, true);
    const s = await a.waitFor((st) => st.game);

    // Privacy: Alice only ever sees her own hand.
    const bobState = await b.waitFor((st) => st.game);
    const aliceIds = new Set(s.game.hand.map((c) => c.id));
    assert.ok(bobState.game.hand.every((c) => !aliceIds.has(c.id)));
    assert.equal(s.game.players.length, 5);

    // Reconnect: Bob drops and comes back with his token mid-game.
    b.socket.disconnect();
    await a.waitFor((st) => st.room.players.find((p) => p.name === 'Bob')?.connected === false);
    const b2 = await client(srv.url);
    autoplay(b2);
    const re = await b2.call('room:join', { code: created.code, token: joined.token, name: 'Bob' });
    assert.equal(re.ok, true);
    assert.equal(re.rejoined, true);
    await b2.waitFor((st) => !!st.game);

    // Strangers can't join a running game.
    const late = await c3.call('room:join', { code: created.code, name: 'Late' });
    assert.equal(late.ok, false);

    const end = await a.waitFor((st) => st.game?.phase === 'ended', 100000);
    assert.ok(end.game.winnerId);
    assert.equal(end.game.players.filter((p) => p.alive).length, 1);

    // Back to lobby, then a rematch starts cleanly.
    assert.equal((await a.call('game:lobby')).ok, true);
    await a.waitFor((st) => st.game === null);
    assert.equal((await a.call('game:start')).ok, true);
    await a.waitFor((st) => st.game?.phase === 'playing');

    for (const c of [a, b2, c3]) c.socket.disconnect();
  } finally {
    srv.close();
  }
});

test('host leaving hands the room to another human; empty room is deleted', { timeout: 20000 }, async () => {
  const srv = await startServer();
  try {
    const a = await client(srv.url);
    const b = await client(srv.url);
    const { code } = await a.call('room:create', { name: 'Host' });
    await b.call('room:join', { code, name: 'Host' });
    const st = await b.waitFor((s) => s.room.players.length === 2);
    assert.ok(st.room.players.some((p) => p.name === 'Host 2'), 'duplicate names are disambiguated');

    await a.call('room:leave');
    const after = await b.waitFor((s) => s.room.players.length === 1);
    assert.equal(after.room.hostId, after.you);

    await b.call('room:leave');
    assert.equal(srv.rooms.rooms.size, 0);
    a.socket.disconnect();
    b.socket.disconnect();
  } finally {
    srv.close();
  }
});
