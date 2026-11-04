import { io } from 'socket.io-client';
import { useRef, useSyncExternalStore } from 'react';

/**
 * Tiny global store over the socket connection.
 * The server is the source of truth: every change arrives as a personalised `state` snapshot.
 */
const SESSION_KEY = 'kk:session'; // per-tab (sessionStorage) so several tabs = several players
const NAME_KEY = 'kk:name';

export const socket = io({ transports: ['websocket', 'polling'] });

let state = {
  connected: false,
  room: null,
  game: null,
  you: null,
  offset: 0, // serverNow - clientNow
};
const listeners = new Set();
const eventListeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useAppState() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

/**
 * Like useAppState, but keeps returning the last snapshot that satisfied `isValid`.
 * Screens use this so they can keep rendering while animating out after their data is gone
 * (e.g. the Game screen fading out after `game` became null).
 */
export function useScreenState(isValid) {
  const s = useAppState();
  const last = useRef(s);
  if (isValid(s)) last.current = s;
  return last.current;
}

export function onGameEvent(fn) {
  eventListeners.add(fn);
  return () => eventListeners.delete(fn);
}

export function serverNow() {
  return Date.now() + state.offset;
}

// ---------- session ----------

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function writeSession(s) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable */ }
}
export function savedName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

// ---------- requests ----------

export function emit(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('Server did not respond'));
      if (!res?.ok) return reject(new Error(res?.error || 'Request failed'));
      resolve(res);
    });
  });
}

export async function createRoom(name) {
  saveName(name);
  const res = await emit('room:create', { name });
  writeSession({ code: res.code, token: res.token });
  setRoomInUrl(res.code);
  return res;
}

export async function joinRoom(code, name) {
  saveName(name);
  const session = readSession();
  const token = session && session.code === code.toUpperCase() ? session.token : undefined;
  const res = await emit('room:join', { code, name, token });
  writeSession({ code: res.code, token: res.token });
  setRoomInUrl(res.code);
  return res;
}

export async function leaveRoom() {
  writeSession(null);
  setRoomInUrl(null);
  set({ room: null, game: null, you: null });
  try { await emit('room:leave'); } catch { /* already gone */ }
}

function setRoomInUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url);
}

// ---------- socket wiring ----------

socket.on('connect', async () => {
  set({ connected: true });
  const session = readSession();
  if (session) {
    try {
      await emit('room:join', { code: session.code, token: session.token, name: savedName() });
    } catch {
      writeSession(null);
      set({ room: null, game: null, you: null });
    }
  }
});

socket.on('disconnect', () => set({ connected: false }));

socket.on('state', (payload) => {
  set({
    room: payload.room,
    game: payload.game,
    you: payload.you,
    offset: payload.room.serverNow - Date.now(),
  });
});

socket.on('game:event', (ev) => {
  for (const fn of eventListeners) fn(ev);
});

socket.on('kicked', ({ reason }) => {
  writeSession(null);
  setRoomInUrl(null);
  set({ room: null, game: null, you: null });
  for (const fn of eventListeners) fn({ type: 'kicked', reason });
});
