import { Game, GameError } from './game/engine.js';
import { botDecide, botObserve, applyBotAction, createBotMemory } from './game/bot.js';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/cards.js';
import { makeRoomCode, makeId, cleanText } from './util.js';

const AVATARS = ['😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐯', '🦁', '🐈', '🐈‍⬛', '🐆'];
const COLORS = ['#ff6a3d', '#3d8bff', '#2fbf71', '#ff6fb5', '#9b5cff', '#f5b40b', '#14b8a6', '#ef4444', '#a0703e', '#64748b'];
const BOT_NAMES = ['Whiskers', 'Mittens', 'Biscuit', 'Noodle', 'Pickles', 'Socks', 'Mochi', 'Pumpkin', 'Waffles', 'Ziggy', 'Tofu', 'Gizmo'];

const PROMPT_TIMEOUT_MS = 30_000;
const BOT_PROMPT_DELAY = [900, 1700];
const BOT_TURN_DELAY = [1100, 2000];
const DISCONNECTED_TURN_MS = 30_000;
const LOBBY_GRACE_MS = 60_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;

export const DEFAULT_SETTINGS = { nopeSeconds: 4, expansion: true, turnTimer: 0 };

export class GameRoomError extends Error {}

export class RoomManager {
  constructor(io, { timeScale = 1 } = {}) {
    this.io = io;
    this.rooms = new Map();
    this.timeScale = timeScale; // tests shrink all delays
  }

  create(hostName) {
    const code = makeRoomCode((c) => this.rooms.has(c));
    const room = new Room(this, code);
    this.rooms.set(code, room);
    const player = room.addHuman(hostName);
    return { room, player };
  }

  get(code) {
    return this.rooms.get(String(code || '').toUpperCase());
  }

  delete(code) {
    const room = this.rooms.get(code);
    if (room) room.dispose();
    this.rooms.delete(code);
  }
}

class Room {
  constructor(manager, code) {
    this.manager = manager;
    this.io = manager.io;
    this.code = code;
    this.players = []; // {id, token, name, avatar, color, isBot, connected, socketId, memory}
    this.hostId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.game = null;
    this.chat = [];
    this.timers = {};
    this.keys = {};
    this.lobbyTimers = new Map();
    this.emptySince = null;
    this.gamesPlayed = 0;
  }

  ms(n) {
    return Math.max(1, Math.round(n * this.manager.timeScale));
  }

  // ---------- membership ----------

  pickAvatar() {
    const used = new Set(this.players.map((p) => p.avatar));
    return AVATARS.find((a) => !used.has(a)) ?? AVATARS[this.players.length % AVATARS.length];
  }

  pickColor() {
    const used = new Set(this.players.map((p) => p.color));
    return COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.length % COLORS.length];
  }

  uniqueName(name) {
    let base = cleanText(name, 16) || 'Kitty';
    let candidate = base;
    let n = 2;
    while (this.players.some((p) => p.name.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${base.slice(0, 13)} ${n++}`;
    }
    return candidate;
  }

  addHuman(name) {
    if (this.game && this.game.phase === 'playing') throw new GameRoomError('A game is already in progress in this room');
    if (this.players.length >= MAX_PLAYERS) throw new GameRoomError('This room is full (10 players)');
    const p = {
      id: makeId(10),
      token: makeId(24),
      name: this.uniqueName(name),
      avatar: this.pickAvatar(),
      color: this.pickColor(),
      isBot: false,
      connected: false,
      socketId: null,
    };
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    return p;
  }

  addBot() {
    if (this.game && this.game.phase === 'playing') throw new GameRoomError('Game in progress');
    if (this.players.length >= MAX_PLAYERS) throw new GameRoomError('Room is full');
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(`🤖 ${n}`)) ?? `Bot ${this.players.length}`;
    const p = {
      id: makeId(10), token: null, name: `🤖 ${name}`, avatar: this.pickAvatar(), color: this.pickColor(),
      isBot: true, connected: true, socketId: null, memory: createBotMemory(),
    };
    this.players.push(p);
    return p;
  }

  findByToken(token) {
    return token ? this.players.find((p) => p.token === token) : undefined;
  }

  attachSocket(player, socket) {
    if (player.socketId && player.socketId !== socket.id) {
      // Same player opened another tab: the older connection gets kicked off.
      const old = this.io.sockets.sockets.get(player.socketId);
      if (old) {
        old.emit('kicked', { reason: 'You joined from another tab.' });
        old.data.roomCode = null;
        old.leave(this.code);
      }
    }
    player.socketId = socket.id;
    player.connected = true;
    socket.data.roomCode = this.code;
    socket.data.playerId = player.id;
    socket.join(this.code);
    clearTimeout(this.lobbyTimers.get(player.id));
    this.lobbyTimers.delete(player.id);
    this.emptySince = null;
  }

  onDisconnect(playerId, socketId) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    if (!this.game || this.game.phase !== 'playing') {
      // Free their seat if they don't come back soon.
      this.lobbyTimers.set(p.id, setTimeout(() => {
        if (!p.connected) this.removePlayer(p.id, 'timed out');
      }, this.ms(LOBBY_GRACE_MS)));
    }
    if (!this.players.some((x) => !x.isBot && x.connected)) this.emptySince = Date.now();
    this.sync();
  }

  removePlayer(playerId, reason = 'left') {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    const [p] = this.players.splice(idx, 1);
    clearTimeout(this.lobbyTimers.get(p.id));
    this.lobbyTimers.delete(p.id);
    if (p.socketId) {
      const s = this.io.sockets.sockets.get(p.socketId);
      if (s) {
        if (reason === 'kicked') s.emit('kicked', { reason: 'The host removed you from the room.' });
        s.leave(this.code);
        s.data.roomCode = null;
      }
    }
    if (this.game && this.game.phase === 'playing') this.game.removePlayer(p.id);
    if (this.hostId === p.id) {
      const next = this.players.find((x) => !x.isBot && x.connected) ?? this.players.find((x) => !x.isBot);
      this.hostId = next?.id ?? null;
    }
    this.systemChat(`${p.name} ${reason === 'kicked' ? 'was removed' : 'left'}.`);
    if (!this.players.some((x) => !x.isBot)) {
      this.manager.delete(this.code);
      return;
    }
    this.sync();
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  // ---------- lobby ----------

  updateSettings(patch) {
    if (this.game && this.game.phase === 'playing') throw new GameRoomError('Game in progress');
    const s = { ...this.settings };
    if (patch.nopeSeconds != null) s.nopeSeconds = Math.max(2, Math.min(8, Number(patch.nopeSeconds) || 4));
    if (patch.expansion != null) s.expansion = !!patch.expansion;
    if (patch.turnTimer != null) {
      const t = Number(patch.turnTimer) || 0;
      s.turnTimer = [0, 30, 45, 60, 90].includes(t) ? t : 0;
    }
    this.settings = s;
    this.sync();
  }

  start() {
    if (this.game && this.game.phase === 'playing') throw new GameRoomError('Game already running');
    if (this.players.length < MIN_PLAYERS) throw new GameRoomError('Need at least 2 players (add a bot!)');
    // Seats with players who never came back get dropped before dealing.
    for (const p of [...this.players]) if (!p.isBot && !p.connected) this.removePlayer(p.id, 'left');
    if (this.players.length < MIN_PLAYERS) throw new GameRoomError('Need at least 2 connected players');
    for (const p of this.players) if (p.isBot) p.memory = createBotMemory();
    this.game = new Game({
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
      settings: { expansion: this.settings.expansion },
    });
    this.gamesPlayed++;
    this.keys = {};
    this.sync();
  }

  backToLobby() {
    if (this.game && this.game.phase === 'playing') throw new GameRoomError('Game still running');
    this.game = null;
    this.clearTimers();
    // Anyone who disconnected during the game gets the usual lobby grace period.
    for (const p of this.players) {
      if (!p.isBot && !p.connected && !this.lobbyTimers.has(p.id)) {
        this.lobbyTimers.set(p.id, setTimeout(() => {
          if (!p.connected) this.removePlayer(p.id, 'timed out');
        }, this.ms(LOBBY_GRACE_MS)));
      }
    }
    this.sync();
  }

  // ---------- chat ----------

  addChat(playerId, text) {
    const p = this.players.find((x) => x.id === playerId);
    const msg = cleanText(text, 200);
    if (!p || !msg) return;
    this.pushChat({ playerId: p.id, name: p.name, color: p.color, text: msg });
  }

  systemChat(text) {
    this.pushChat({ playerId: null, name: null, text });
  }

  pushChat(entry) {
    this.chat.push({ id: makeId(8), ts: Date.now(), ...entry });
    if (this.chat.length > 80) this.chat.splice(0, this.chat.length - 80);
  }

  // ---------- game actions ----------

  act(playerId, fn) {
    if (!this.game) throw new GameRoomError('No game running');
    try {
      fn(this.game);
    } finally {
      this.sync();
    }
  }

  // ---------- sync: events, timers, bots, broadcast ----------

  sync() {
    if (this.disposed) return;
    const game = this.game;
    if (game) {
      for (const ev of game.drainEvents()) this.dispatchEvent(ev);
      this.syncTimers();
    }
    this.broadcast();
    this.scheduleBots();
  }

  dispatchEvent(ev) {
    const { to, ...data } = ev;
    if (to) {
      const p = this.players.find((x) => x.id === to);
      if (!p) return;
      if (p.isBot) botObserve(p.memory, ev);
      else if (p.socketId) this.io.to(p.socketId).emit('game:event', data);
    } else {
      for (const p of this.players) if (p.isBot) botObserve(p.memory, ev);
      this.io.to(this.code).emit('game:event', data);
    }
  }

  setTimer(name, key, delay, fn) {
    if (this.keys[name] === key) return;
    clearTimeout(this.timers[name]);
    this.keys[name] = key;
    if (key == null) return;
    this.timers[name] = setTimeout(() => {
      if (this.disposed) return;
      try {
        fn();
      } catch (err) {
        if (!(err instanceof GameError)) console.error(`[room ${this.code}] timer ${name} failed`, err);
      }
      this.sync();
    }, delay);
  }

  syncTimers() {
    const g = this.game;
    if (!g || g.phase !== 'playing') {
      this.clearTimers();
      return;
    }

    // Nope window: restarts each time someone plays a Nope.
    if (g.pending) {
      const key = `${g.pending.id}:${g.pending.nopes}`;
      if (this.keys.pending !== key) {
        const windowMs = this.ms(this.settings.nopeSeconds * 1000);
        g.pending.expiresAt = Date.now() + windowMs;
        this.setTimer('pending', key, windowMs, () => g.resolvePending());
      }
    } else {
      this.setTimer('pending', null);
    }

    // Prompt timeout (bots answer much sooner via scheduleBots).
    if (g.prompt) {
      const pr = g.prompt;
      const owner = this.players.find((p) => p.id === pr.playerId);
      const delay = owner && !owner.connected && !owner.isBot ? 5000 : PROMPT_TIMEOUT_MS;
      const key = `${pr.id}:${owner?.connected ? 1 : 0}`;
      if (this.keys.prompt !== key) {
        g.prompt.expiresAt = Date.now() + this.ms(delay);
        this.setTimer('prompt', key, this.ms(delay), () => {
          if (g.prompt && g.prompt.id === pr.id) g.timeoutPrompt();
        });
      }
    } else {
      this.setTimer('prompt', null);
    }

    // Turn timer: optional for everyone, and always on for disconnected humans.
    const cur = g.current();
    const curRoomPlayer = this.players.find((p) => p.id === cur.id);
    const disconnected = curRoomPlayer && !curRoomPlayer.isBot && !curRoomPlayer.connected;
    const seconds = disconnected ? DISCONNECTED_TURN_MS / 1000 : this.settings.turnTimer;
    if (seconds > 0 && !curRoomPlayer?.isBot) {
      const key = `${g.turnNumber}:${disconnected ? 'd' : 'c'}`;
      if (this.keys.turn !== key) {
        this.turnDeadline = Date.now() + this.ms(seconds * 1000);
        const turnAtStart = g.turnNumber;
        const fire = () => {
          if (this.game !== g || g.turnNumber !== turnAtStart || g.phase !== 'playing') return;
          if (g.pending || g.prompt) {
            // Retry shortly once the table is idle again.
            clearTimeout(this.timers.turnRetry);
            this.timers.turnRetry = setTimeout(() => {
              if (this.disposed) return;
              fire();
              this.sync();
            }, this.ms(1500));
            return;
          }
          g.autoTurn();
        };
        this.setTimer('turn', key, this.ms(seconds * 1000), fire);
      }
    } else {
      this.setTimer('turn', null);
      this.turnDeadline = null;
    }
  }

  clearTimers() {
    for (const t of Object.values(this.timers)) clearTimeout(t);
    this.timers = {};
    this.keys = {};
    clearTimeout(this.botTimer);
    this.botTimer = null;
    this.turnDeadline = null;
  }

  scheduleBots() {
    const g = this.game;
    if (!g || g.phase !== 'playing' || this.botTimer) return;
    const bots = this.players.filter((p) => p.isBot && g.player(p.id)?.alive);
    if (bots.length === 0) return;

    let delayRange = null;
    if (g.prompt && bots.some((b) => b.id === g.prompt.playerId)) delayRange = BOT_PROMPT_DELAY;
    else if (g.pending) {
      const windowMs = this.settings.nopeSeconds * 1000;
      delayRange = [Math.min(600, windowMs * 0.2), Math.max(800, windowMs * 0.6)];
    } else if (!g.prompt && bots.some((b) => b.id === g.current().id)) delayRange = BOT_TURN_DELAY;
    if (!delayRange) return;

    const delay = this.ms(delayRange[0] + Math.random() * (delayRange[1] - delayRange[0]));
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.disposed || this.game !== g) return;
      this.runBots(bots);
    }, delay);
  }

  runBots(bots) {
    const g = this.game;
    if (!g || g.phase !== 'playing') return;
    const order = [...bots].sort(() => Math.random() - 0.5);
    let acted = false;
    for (const bot of order) {
      if (!g.player(bot.id)?.alive) continue;
      const action = botDecide(g, bot.id, bot.memory);
      if (!action) continue;
      try {
        applyBotAction(g, bot.id, action);
      } catch (err) {
        if (!(err instanceof GameError)) console.error(`[room ${this.code}] bot error`, err);
        // Fall back to the always-legal move so a bot can never stall the table.
        try {
          if (g.prompt && g.prompt.playerId === bot.id) g.timeoutPrompt();
          else if (!g.pending && !g.prompt && g.current().id === bot.id) g.draw(bot.id);
        } catch { /* ignore */ }
      }
      acted = true;
      break;
    }
    // Nothing to do (e.g. every bot already passed on noping): wait for the next state change.
    if (acted) this.sync();
  }

  // ---------- views ----------

  lobbyView() {
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      gamesPlayed: this.gamesPlayed,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, isBot: p.isBot, connected: p.connected,
      })),
      chat: this.chat.slice(-50),
      inGame: !!this.game,
      turnDeadline: this.turnDeadline ?? null,
      serverNow: Date.now(),
    };
  }

  broadcast() {
    const lobby = this.lobbyView();
    for (const p of this.players) {
      if (p.isBot || !p.socketId) continue;
      const payload = { room: lobby, you: p.id, game: this.game ? this.game.view(p.id) : null };
      if (payload.game && this.game.prompt && this.game.prompt.expiresAt && payload.game.prompt) {
        payload.game.prompt.expiresAt = this.game.prompt.expiresAt;
      }
      this.io.to(p.socketId).emit('state', payload);
    }
  }

  dispose() {
    this.disposed = true;
    this.clearTimers();
    for (const t of this.lobbyTimers.values()) clearTimeout(t);
    this.lobbyTimers.clear();
  }
}
