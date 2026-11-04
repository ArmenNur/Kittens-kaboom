# 💣 Kitten Kaboom

A real-time multiplayer browser card game for **2–10 players** (bots included). Draw cards, dodge the
Kaboom Kittens, and Nope your friends. Inspired by the classic "don't draw the bomb" party game,
with original names and art.

No database: rooms live in server memory, so a server restart ends running games.

## Run locally

```bash
npm install
npm run build      # build the React client into client/dist
npm start          # http://localhost:4310
```

Development with hot reload (Vite on :5173 proxies sockets to the API on :4310):

```bash
npm run dev        # open http://localhost:5173
```

Tests (rules engine, 3,000-game bot fuzz, and a real socket game end to end):

```bash
npm test
```

To play alone locally, open several browser **tabs**. Each tab is its own player, because the session
lives in `sessionStorage`. Or click **🤖 Add bot**.

## Deploy for free

The server needs WebSockets and must be a single instance (state is in memory).

**Render** (simplest): push this folder to a GitHub repo, then go to Render → **New → Blueprint** and pick the
repo. `render.yaml` does the rest. On the free plan the app sleeps after 15 min idle, and the first visit
takes ~30s to wake.

**Any Docker host** (Fly.io, Railway, Koyeb…): `docker build -t kitten-kaboom . && docker run -p 8080:8080 kitten-kaboom`.

The port comes from `PORT` (default 4310). Health check: `GET /health`.

## How it's built

```
shared/cards.js          card catalogue + deck sizing (used by server AND client)
server/game/engine.js    pure rules engine: no timers/IO, fully unit-tested
server/game/bot.js       bot AI (only uses info a real player has)
server/rooms.js          rooms, lobby, nope windows, prompt/turn timers, bots, reconnects
server/index.js          Express + Socket.io, serves client/dist
client/src/              React 18 + Vite, CSS Modules, Framer Motion
  lib/store.js           socket + tiny global store (useSyncExternalStore)
  screens/               Home, Lobby, game/* (Seats, TableCenter, Hand, modals…)
  components/            Card, Modal, Toasts, TopBar, Chat, RulesModal…
```

The server is authoritative. Each player receives a personalised snapshot (only their own hand), and
every action is validated by the engine.

## Rules summary

- On your turn, play any number of cards, then **draw** to end your turn.
- There are `players − 1` Kaboom Kittens in the deck. Draw one without a **Defuse** and you're out.
  With a Defuse, you secretly put the kitten back anywhere in the deck.
- **Nope** cancels any action during its short window (Nopes can be Noped).
- **Attack**: end your turn without drawing; the next player takes 2 turns. Attacks stack.
- **Skip**: end your turn without drawing. **Shuffle**, **See the Future**, **Favor**.
- Party pack (toggle in lobby): **Alter the Future**, **Reverse**, **Draw from Bottom**.
- Combos: **pair** = steal random card, **three of a kind** = name a card to take,
  **five different** = take any card from the discard pile.
- 2–5 players use one deck; 6–10 players use a double deck.

Keyboard: `D` draw · `N` nope · `Enter` play selected · `Space` select focused card · `Esc` clear.
