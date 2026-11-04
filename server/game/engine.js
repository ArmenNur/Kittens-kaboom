import {
  CARD_TYPES, SINGLE_PLAYABLE, HAND_SIZE, MIN_PLAYERS, MAX_PLAYERS, deckSpec, describePlay,
} from '../../shared/cards.js';
import { shuffleInPlace, randInt } from '../util.js';

export class GameError extends Error {}

const LOG_LIMIT = 120;

/**
 * Pure rules engine. No timers and no I/O: the room layer owns the clock
 * (nope windows, prompt timeouts) and calls resolvePending()/timeoutPrompt().
 *
 * State machine per turn:
 *   idle      -> playCards() -> pending (nope window) -> resolvePending() -> idle | prompt
 *   idle      -> draw()      -> idle (turn advanced) | prompt(defuse) | elimination
 *   prompt    -> respond()/timeoutPrompt() -> idle
 */
export class Game {
  constructor({ players, settings = {}, rng = Math.random }) {
    if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new GameError(`Need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
    }
    this.rng = rng;
    this.settings = { expansion: false, ...settings };
    this.players = players.map((p) => ({
      id: p.id, name: p.name, hand: [], alive: true, outRank: null, left: false,
    }));
    this.deck = [];          // index 0 = top
    this.discard = [];       // last = top
    this.removed = [];       // cards taken out of the game (exploded kittens)
    this.direction = 1;
    this.turnIndex = randInt(this.players.length, rng);
    this.turnsRemaining = 1;
    this.turnNumber = 1;
    this.pending = null;
    this.prompt = null;
    this.phase = 'playing';
    this.winnerId = null;
    this.log = [];
    this.events = [];
    this.seq = 0;
    this.deckVersion = 0;
    this.eliminations = 0;
    this.cardSeq = 0;
    this.setup();
  }

  // ---------- setup ----------

  makeCard(type) {
    return { id: `c${++this.cardSeq}`, type };
  }

  setup() {
    const spec = deckSpec(this.players.length, this.settings.expansion);
    const main = shuffleInPlace(spec.main.map((t) => this.makeCard(t)), this.rng);
    for (const p of this.players) {
      p.hand = main.splice(0, HAND_SIZE);
      p.hand.push(this.makeCard('defuse'));
    }
    for (let i = 0; i < spec.extraDefuses; i++) main.push(this.makeCard('defuse'));
    for (let i = 0; i < spec.kabooms; i++) main.push(this.makeCard('kaboom'));
    this.deck = shuffleInPlace(main, this.rng);
    this.totalCards = this.cardSeq;
    this.addLog(`Game started with ${this.players.length} players. ${spec.kabooms} Kaboom Kitten${spec.kabooms > 1 ? 's are' : ' is'} hiding in the deck.`, 'info');
    this.addLog(`${this.current().name} goes first.`, 'turn');
  }

  // ---------- helpers ----------

  player(id) {
    return this.players.find((p) => p.id === id);
  }

  current() {
    return this.players[this.turnIndex];
  }

  alivePlayers() {
    return this.players.filter((p) => p.alive);
  }

  nextAliveIndex(from = this.turnIndex, dir = this.direction) {
    const n = this.players.length;
    let i = from;
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n;
      if (this.players[i].alive) return i;
    }
    return from;
  }

  nextPlayer() {
    return this.players[this.nextAliveIndex()];
  }

  kaboomsInDeck() {
    return this.deck.filter((c) => c.type === 'kaboom').length;
  }

  addLog(text, tone = 'info') {
    this.log.push({ id: ++this.seq, text, tone, ts: Date.now() });
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
  }

  emit(type, data = {}, to = null) {
    this.events.push({ type, to, ...data });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  assertPlaying() {
    if (this.phase !== 'playing') throw new GameError('The game is over');
  }

  assertTurn(pid) {
    this.assertPlaying();
    const cur = this.current();
    if (!cur || cur.id !== pid) throw new GameError("It's not your turn");
    if (this.pending) throw new GameError('Wait for the current action to resolve');
    if (this.prompt) throw new GameError('Waiting for a decision first');
  }

  takeFromHand(p, cardId) {
    const idx = p.hand.findIndex((c) => c.id === cardId);
    if (idx < 0) return null;
    return p.hand.splice(idx, 1)[0];
  }

  // ---------- playing cards ----------

  /**
   * @param {string} pid
   * @param {string[]} cardIds
   * @param {{targetId?: string, namedType?: string}} opts
   */
  playCards(pid, cardIds, opts = {}) {
    this.assertTurn(pid);
    const p = this.player(pid);
    if (!Array.isArray(cardIds) || cardIds.length === 0) throw new GameError('Select a card to play');
    if (new Set(cardIds).size !== cardIds.length) throw new GameError('Duplicate cards');
    const cards = cardIds.map((id) => p.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) throw new GameError("You don't have that card");
    const types = cards.map((c) => c.type);

    let kind;
    if (cards.length === 1) {
      if (!SINGLE_PLAYABLE.has(types[0])) {
        if (types[0] === 'nope') throw new GameError('Nope can only be played against an action');
        if (types[0] === 'defuse') throw new GameError('Defuse is only played when you draw a Kaboom Kitten');
        throw new GameError(`${CARD_TYPES[types[0]].name} needs a matching card to make a combo`);
      }
      kind = types[0];
    } else if (cards.length === 2 && types[0] === types[1]) {
      kind = 'pair';
    } else if (cards.length === 3 && types.every((t) => t === types[0])) {
      kind = 'triple';
    } else if (cards.length === 5 && new Set(types).size === 5) {
      kind = 'five';
    } else {
      throw new GameError('Combos are 2 or 3 matching cards, or 5 different cards');
    }

    let targetId = null;
    let namedType = null;
    if (kind === 'favor' || kind === 'pair' || kind === 'triple') {
      const target = this.player(opts.targetId);
      if (!target || !target.alive) throw new GameError('Choose a player who is still in the game');
      if (target.id === pid) throw new GameError("You can't target yourself");
      if (target.hand.length === 0) throw new GameError(`${target.name} has no cards`);
      targetId = target.id;
    }
    if (kind === 'triple') {
      if (!CARD_TYPES[opts.namedType] || opts.namedType === 'kaboom') throw new GameError('Name a card to ask for');
      namedType = opts.namedType;
    }
    if (kind === 'five' && this.discard.length === 0) {
      throw new GameError('The discard pile is empty');
    }

    for (const c of cards) this.takeFromHand(p, c.id);
    this.discard.push(...cards);

    this.pending = {
      id: ++this.seq,
      kind,
      playerId: pid,
      targetId,
      namedType,
      cardIds: cards.map((c) => c.id),
      cardTypes: types,
      nopes: 0,
      nopeChain: [],
      createdAt: Date.now(),
      expiresAt: null, // set by the room layer
    };
    const target = targetId ? ` on ${this.player(targetId).name}` : '';
    const named = namedType ? ` (asking for ${CARD_TYPES[namedType].name})` : '';
    this.addLog(`${p.name} played ${describePlay(kind, types)}${target}${named}.`, 'play');
    this.emit('played', { playerId: pid, kind, cardTypes: types, targetId, namedType });
    return this.pending;
  }

  nope(pid) {
    this.assertPlaying();
    if (!this.pending) throw new GameError('There is nothing to Nope');
    const p = this.player(pid);
    if (!p || !p.alive) throw new GameError("You're not in the game");
    const card = p.hand.find((c) => c.type === 'nope');
    if (!card) throw new GameError("You don't have a Nope");
    this.takeFromHand(p, card.id);
    this.discard.push(card);
    this.pending.nopes += 1;
    this.pending.nopeChain.push(pid);
    const cancelled = this.pending.nopes % 2 === 1;
    this.addLog(cancelled ? `${p.name}: NOPE! 🚫` : `${p.name}: Yup! (Noped the Nope)`, 'nope');
    this.emit('noped', { playerId: pid, cancelled, pendingId: this.pending.id });
    return this.pending;
  }

  resolvePending() {
    const pend = this.pending;
    if (!pend || this.phase !== 'playing') return;
    this.pending = null;
    const pid = pend.playerId;
    const p = this.player(pid);
    if (!p || !p.alive) return;

    if (pend.nopes % 2 === 1) {
      this.addLog(`${describePlay(pend.kind, pend.cardTypes)} was Noped.`, 'nope');
      return;
    }

    const target = pend.targetId ? this.player(pend.targetId) : null;
    switch (pend.kind) {
      case 'attack': {
        const next = this.nextPlayer();
        const turns = (this.turnsRemaining > 1 ? this.turnsRemaining : 0) + 2;
        this.addLog(`${next.name} must take ${turns} turns!`, 'danger');
        this.advanceTurn(turns);
        break;
      }
      case 'skip':
        this.addLog(`${p.name} skipped a turn.`, 'info');
        this.endOneTurn();
        break;
      case 'reverse':
        this.direction *= -1;
        this.addLog(`Turn order reversed ${this.direction === 1 ? '↻' : '↺'}.`, 'info');
        this.endOneTurn();
        break;
      case 'shuffle':
        shuffleInPlace(this.deck, this.rng);
        this.deckVersion++;
        this.addLog('The draw pile was shuffled.', 'info');
        this.emit('shuffled', {});
        break;
      case 'future': {
        const top = this.deck.slice(0, 3).map((c) => c.type);
        this.emit('future', { cards: top, deckVersion: this.deckVersion }, pid);
        this.addLog(`${p.name} peeked at the top ${top.length} cards.`, 'info');
        break;
      }
      case 'alter': {
        const top = this.deck.slice(0, 3);
        if (top.length > 0) {
          this.prompt = { id: ++this.seq, type: 'alter', playerId: pid, cards: top.map((c) => ({ ...c })) };
        }
        break;
      }
      case 'bottom':
        this.addLog(`${p.name} draws from the bottom…`, 'info');
        this.drawCard(p, true);
        break;
      case 'favor':
        if (target && target.alive && target.hand.length > 0) {
          this.prompt = { id: ++this.seq, type: 'favor', playerId: target.id, fromId: pid };
        } else {
          this.addLog('The Favor fizzled — no cards to give.', 'info');
        }
        break;
      case 'pair':
        if (target && target.alive && target.hand.length > 0) {
          const card = target.hand.splice(randInt(target.hand.length, this.rng), 1)[0];
          p.hand.push(card);
          this.addLog(`${p.name} stole a random card from ${target.name}.`, 'steal');
          this.emit('stolen', { card, fromId: target.id, toId: pid }, pid);
          this.emit('stolen', { card, fromId: target.id, toId: pid }, target.id);
        }
        break;
      case 'triple':
        if (target && target.alive) {
          const card = target.hand.find((c) => c.type === pend.namedType);
          if (card) {
            this.takeFromHand(target, card.id);
            p.hand.push(card);
            this.addLog(`${p.name} took a ${CARD_TYPES[card.type].name} from ${target.name}!`, 'steal');
            this.emit('stolen', { card, fromId: target.id, toId: pid }, pid);
            this.emit('stolen', { card, fromId: target.id, toId: pid }, target.id);
          } else {
            this.addLog(`${target.name} has no ${CARD_TYPES[pend.namedType].name}.`, 'info');
          }
        }
        break;
      case 'five': {
        const exclude = new Set(pend.cardIds);
        if (this.discard.some((c) => !exclude.has(c.id))) {
          this.prompt = { id: ++this.seq, type: 'pickDiscard', playerId: pid, exclude: [...exclude] };
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------- drawing ----------

  draw(pid) {
    this.assertTurn(pid);
    this.drawCard(this.player(pid), false);
  }

  drawCard(p, fromBottom) {
    if (this.deck.length === 0) {
      // Should be impossible (there is always >= 1 kaboom while 2+ players live) but stay safe.
      this.endOneTurn();
      return;
    }
    const card = fromBottom ? this.deck.pop() : this.deck.shift();
    this.deckVersion++;
    if (card.type === 'kaboom') {
      this.addLog(`💥 ${p.name} drew a Kaboom Kitten!`, 'danger');
      const defuse = p.hand.find((c) => c.type === 'defuse');
      if (defuse) {
        this.takeFromHand(p, defuse.id);
        this.discard.push(defuse);
        this.prompt = { id: ++this.seq, type: 'defuse', playerId: p.id, card };
        this.addLog(`${p.name} used a Defuse! 🧯`, 'good');
        this.emit('kaboom', { playerId: p.id, defused: true });
      } else {
        this.emit('kaboom', { playerId: p.id, defused: false });
        this.eliminate(p, card);
      }
      return;
    }
    p.hand.push(card);
    this.addLog(`${p.name} drew a card.`, 'draw');
    this.emit('drew', { card, fromBottom }, p.id);
    this.endOneTurn();
  }

  // ---------- prompts ----------

  respond(pid, payload = {}) {
    this.assertPlaying();
    const pr = this.prompt;
    if (!pr || pr.playerId !== pid) throw new GameError('Nothing to respond to');
    if (payload.promptId != null && payload.promptId !== pr.id) throw new GameError('That decision has expired');
    const p = this.player(pid);

    switch (pr.type) {
      case 'defuse': {
        let pos = Number(payload.position);
        if (!Number.isInteger(pos)) throw new GameError('Pick a position');
        pos = Math.max(0, Math.min(this.deck.length, pos));
        this.deck.splice(pos, 0, pr.card);
        this.deckVersion++;
        this.prompt = null;
        this.addLog(`${p.name} secretly slipped the Kaboom Kitten back into the deck. 🤫`, 'info');
        this.emit('defused', { playerId: pid });
        this.endOneTurn();
        break;
      }
      case 'alter': {
        const order = payload.order;
        const n = pr.cards.length;
        if (!Array.isArray(order) || order.length !== n
          || [...order].sort((a, b) => a - b).some((v, i) => v !== i)) {
          throw new GameError('Invalid order');
        }
        const top = this.deck.slice(0, n);
        // The deck cannot change while the prompt is open, but verify anyway.
        if (top.some((c, i) => c.id !== pr.cards[i].id)) {
          this.prompt = null;
          return;
        }
        const reordered = order.map((i) => top[i]);
        this.deck.splice(0, n, ...reordered);
        this.deckVersion++;
        this.prompt = null;
        this.addLog(`${p.name} rearranged the future. 🪄`, 'info');
        this.emit('future', { cards: reordered.map((c) => c.type), deckVersion: this.deckVersion, altered: true }, pid);
        break;
      }
      case 'favor': {
        const card = p.hand.find((c) => c.id === payload.cardId);
        if (!card) throw new GameError('Choose one of your cards to give');
        this.giveFavor(p, card);
        break;
      }
      case 'pickDiscard': {
        if ((pr.exclude || []).includes(payload.cardId)) throw new GameError('Pick a different card');
        const idx = this.discard.findIndex((c) => c.id === payload.cardId);
        if (idx < 0) throw new GameError('That card is not in the discard pile');
        const [card] = this.discard.splice(idx, 1);
        p.hand.push(card);
        this.prompt = null;
        this.addLog(`${p.name} pulled a ${CARD_TYPES[card.type].name} from the discard pile.`, 'steal');
        break;
      }
      default:
        throw new GameError('Unknown decision');
    }
  }

  giveFavor(giver, card) {
    const pr = this.prompt;
    const to = this.player(pr.fromId);
    this.takeFromHand(giver, card.id);
    this.prompt = null;
    if (to && to.alive) {
      to.hand.push(card);
      this.addLog(`${giver.name} gave a card to ${to.name}.`, 'steal');
      this.emit('gave', { card, fromId: giver.id, toId: to.id }, to.id);
      this.emit('gave', { card, fromId: giver.id, toId: to.id }, giver.id);
    } else {
      this.discard.push(card);
    }
  }

  /** Default choice when a player takes too long (or disconnects). */
  timeoutPrompt() {
    const pr = this.prompt;
    if (!pr || this.phase !== 'playing') return;
    const p = this.player(pr.playerId);
    switch (pr.type) {
      case 'defuse':
        this.respond(p.id, { position: randInt(this.deck.length + 1, this.rng) });
        break;
      case 'alter':
        this.respond(p.id, { order: pr.cards.map((_, i) => i) });
        break;
      case 'favor':
        this.giveFavor(p, p.hand[randInt(p.hand.length, this.rng)]);
        break;
      case 'pickDiscard': {
        const ex = new Set(pr.exclude || []);
        const choices = this.discard.filter((c) => !ex.has(c.id));
        if (choices.length === 0) { this.prompt = null; break; }
        this.respond(p.id, { cardId: choices[randInt(choices.length, this.rng)].id });
        break;
      }
      default:
        this.prompt = null;
    }
  }

  /** Turn timer ran out: the current player draws. */
  autoTurn() {
    if (this.phase !== 'playing' || this.pending || this.prompt) return;
    const p = this.current();
    this.addLog(`⏰ ${p.name} ran out of time.`, 'info');
    this.drawCard(p, false);
  }

  // ---------- turns & elimination ----------

  endOneTurn() {
    if (this.phase !== 'playing') return;
    this.turnsRemaining -= 1;
    if (this.turnsRemaining <= 0) {
      this.advanceTurn(1);
    } else {
      this.turnNumber++;
      this.emit('turn', { playerId: this.current().id, turnsRemaining: this.turnsRemaining });
    }
  }

  advanceTurn(turns) {
    this.turnIndex = this.nextAliveIndex();
    this.turnsRemaining = turns;
    this.turnNumber++;
    const cur = this.current();
    this.addLog(`It's ${cur.name}'s turn${turns > 1 ? ` (${turns} turns)` : ''}.`, 'turn');
    this.emit('turn', { playerId: cur.id, turnsRemaining: turns });
  }

  eliminate(p, kaboomCard) {
    const wasCurrent = this.current().id === p.id;
    p.alive = false;
    p.outRank = ++this.eliminations;
    this.discard.push(...p.hand);
    p.hand = [];
    if (kaboomCard) this.removed.push(kaboomCard);
    this.addLog(`💀 ${p.name} exploded and is out of the game!`, 'danger');
    this.emit('exploded', { playerId: p.id });
    if (this.checkWinner()) return;
    if (wasCurrent) {
      // Pending attack turns die with the player.
      this.advanceTurn(1);
    }
  }

  /** A player left or was kicked mid-game. */
  removePlayer(pid) {
    const p = this.player(pid);
    if (!p || !p.alive || this.phase !== 'playing') return;
    const wasCurrent = this.current().id === pid;

    if (this.pending && this.pending.playerId === pid) this.pending = null;
    if (this.prompt && (this.prompt.playerId === pid || this.prompt.fromId === pid)) {
      if (this.prompt.type === 'defuse') this.removed.push(this.prompt.card);
      this.prompt = null;
    }

    p.alive = false;
    p.left = true;
    p.outRank = ++this.eliminations;
    this.discard.push(...p.hand);
    p.hand = [];
    this.addLog(`🚪 ${p.name} left the game.`, 'info');

    // Keep exactly (alive - 1) kittens in play so the game still ends cleanly.
    // A kitten held in someone's open defuse prompt goes back into the deck, so it counts too.
    const alive = this.alivePlayers().length;
    const held = this.prompt?.type === 'defuse' ? 1 : 0;
    while (this.kaboomsInDeck() > 0 && this.kaboomsInDeck() + held > Math.max(0, alive - 1)) {
      const idx = this.deck.findIndex((c) => c.type === 'kaboom');
      this.removed.push(...this.deck.splice(idx, 1));
      this.deckVersion++;
    }

    if (this.checkWinner()) return;
    if (wasCurrent) this.advanceTurn(1);
  }

  checkWinner() {
    const alive = this.alivePlayers();
    if (alive.length > 1) return false;
    this.phase = 'ended';
    this.pending = null;
    this.prompt = null;
    this.winnerId = alive[0]?.id ?? null;
    if (alive[0]) {
      this.addLog(`🏆 ${alive[0].name} is the last kitten standing!`, 'good');
      this.emit('win', { playerId: alive[0].id });
    }
    return true;
  }

  // ---------- views ----------

  /** Everything a given player is allowed to see. */
  view(pid) {
    const me = this.player(pid);
    const pend = this.pending;
    const pr = this.prompt;
    let prompt = null;
    if (pr) {
      prompt = { id: pr.id, type: pr.type, playerId: pr.playerId, fromId: pr.fromId ?? null };
      if (pr.playerId === pid) {
        if (pr.type === 'alter') prompt.cards = pr.cards.map((c) => c.type);
        if (pr.type === 'defuse') prompt.deckCount = this.deck.length;
        if (pr.type === 'pickDiscard') prompt.exclude = pr.exclude;
      }
    }
    return {
      phase: this.phase,
      you: pid,
      turnPlayerId: this.current()?.id ?? null,
      turnsRemaining: this.turnsRemaining,
      turnNumber: this.turnNumber,
      direction: this.direction,
      deckCount: this.deck.length,
      kaboomsInDeck: this.kaboomsInDeck(),
      deckVersion: this.deckVersion,
      discard: this.discard.map((c) => ({ id: c.id, type: c.type })),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        left: p.left,
        outRank: p.outRank,
        handCount: p.hand.length,
      })),
      hand: me ? me.hand.map((c) => ({ ...c })) : [],
      pending: pend ? {
        id: pend.id,
        kind: pend.kind,
        playerId: pend.playerId,
        targetId: pend.targetId,
        namedType: pend.namedType,
        cardTypes: pend.cardTypes,
        nopes: pend.nopes,
        nopeChain: pend.nopeChain,
        expiresAt: pend.expiresAt,
      } : null,
      prompt,
      winnerId: this.winnerId,
      log: this.log.slice(-60),
    };
  }

  /** Total card count across every zone — used by tests to prove nothing leaks. */
  countAllCards() {
    let n = this.deck.length + this.discard.length + this.removed.length;
    for (const p of this.players) n += p.hand.length;
    if (this.prompt && this.prompt.type === 'defuse') n += 1;
    return n;
  }
}
