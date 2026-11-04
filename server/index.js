import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager, GameRoomError } from './rooms.js';
import { GameError } from './game/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export function createServer({ timeScale = 1 } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: false }, pingInterval: 10_000, pingTimeout: 8_000 });
  const rooms = new RoomManager(io, { timeScale });

  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));
  // Production: serve the Vite build (client/dist). In dev, Vite serves the client on :5173.
  const dist = path.join(ROOT, 'client', 'dist');
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '30d', immutable: true }));
  app.use(express.static(dist, { maxAge: 0 }));
  app.get(/^\/(?!socket\.io|health).*/, (_req, res, next) => {
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  // Clean up rooms nobody has been connected to for a while.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.rooms) {
      if (room.emptySince && now - room.emptySince > 10 * 60_000) rooms.delete(code);
    }
  }, 60_000);
  sweeper.unref();

  io.on('connection', (socket) => {
    const roomOf = () => (socket.data.roomCode ? rooms.get(socket.data.roomCode) : null);

    // Wrap every handler: validation errors go back through the ack, never crash the server.
    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          const result = handler(payload ?? {});
          reply({ ok: true, ...(result || {}) });
        } catch (err) {
          if (err instanceof GameError || err instanceof GameRoomError) {
            reply({ ok: false, error: err.message });
          } else {
            console.error(`[socket ${event}]`, err);
            reply({ ok: false, error: 'Something went wrong' });
          }
        }
      });
    };

    const requireRoom = () => {
      const room = roomOf();
      if (!room) throw new GameRoomError('You are not in a room');
      return room;
    };
    const requireHost = () => {
      const room = requireRoom();
      if (!room.isHost(socket.data.playerId)) throw new GameRoomError('Only the host can do that');
      return room;
    };

    const leaveCurrent = () => {
      const room = roomOf();
      if (room) room.removePlayer(socket.data.playerId, 'left');
      socket.data.roomCode = null;
    };

    on('room:create', ({ name }) => {
      leaveCurrent();
      const { room, player } = rooms.create(name);
      room.attachSocket(player, socket);
      room.systemChat(`${player.name} created the room.`);
      room.sync();
      return { code: room.code, token: player.token };
    });

    on('room:join', ({ code, name, token }) => {
      const room = rooms.get(code);
      if (!room) throw new GameRoomError(`Room ${String(code || '').toUpperCase()} doesn't exist`);
      let player = room.findByToken(token);
      if (player) {
        room.attachSocket(player, socket);
        room.sync();
        return { code: room.code, token: player.token, rejoined: true };
      }
      if (socket.data.roomCode && socket.data.roomCode !== room.code) leaveCurrent();
      player = room.addHuman(name);
      room.attachSocket(player, socket);
      room.systemChat(`${player.name} joined.`);
      room.sync();
      return { code: room.code, token: player.token };
    });

    on('room:leave', () => {
      leaveCurrent();
    });

    on('room:settings', (patch) => {
      requireHost().updateSettings(patch);
    });

    on('room:addBot', () => {
      const room = requireHost();
      const bot = room.addBot();
      room.systemChat(`${bot.name} joined.`);
      room.sync();
    });

    on('room:kick', ({ playerId }) => {
      const room = requireHost();
      if (playerId === socket.data.playerId) throw new GameRoomError("You can't kick yourself");
      room.removePlayer(playerId, 'kicked');
    });

    on('game:start', () => {
      requireHost().start();
    });

    on('game:lobby', () => {
      requireHost().backToLobby();
    });

    on('game:play', ({ cardIds, targetId, namedType }) => {
      const room = requireRoom();
      room.act(socket.data.playerId, (g) => g.playCards(socket.data.playerId, cardIds, { targetId, namedType }));
    });

    on('game:nope', () => {
      const room = requireRoom();
      room.act(socket.data.playerId, (g) => g.nope(socket.data.playerId));
    });

    on('game:draw', () => {
      const room = requireRoom();
      room.act(socket.data.playerId, (g) => g.draw(socket.data.playerId));
    });

    on('game:respond', (payload) => {
      const room = requireRoom();
      room.act(socket.data.playerId, (g) => g.respond(socket.data.playerId, payload));
    });

    on('chat:send', ({ text }) => {
      const room = requireRoom();
      room.addChat(socket.data.playerId, text);
      room.sync();
    });

    socket.on('disconnect', () => {
      const room = roomOf();
      if (room) room.onDisconnect(socket.data.playerId, socket.id);
    });
  });

  return { app, server, io, rooms, close: () => { clearInterval(sweeper); io.close(); server.close(); } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4310;
  const { server } = createServer();
  server.listen(port, () => {
    console.log(`🐱💣 Kitten Kaboom running on http://localhost:${port}`);
  });
}
