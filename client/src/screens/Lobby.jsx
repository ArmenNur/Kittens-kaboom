import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CARD_TYPES, deckSpec, MAX_PLAYERS, MIN_PLAYERS } from '@shared/cards.js';
import { useScreenState, emit } from '../lib/store.js';
import { copyText } from '../lib/fx.js';
import { sound } from '../lib/sound.js';
import { TopBar } from '../components/TopBar.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Chat } from '../components/Chat.jsx';
import { toast, errorToast } from '../components/Toasts.jsx';
import s from './Lobby.module.css';

const call = async (event, payload) => {
  try { await emit(event, payload); } catch (err) { errorToast(err.message); }
};

export function Lobby() {
  const { room, you } = useScreenState((st) => !!st.room);
  const isHost = room.hostId === you;
  const n = room.players.length;
  const [starting, setStarting] = useState(false);
  const inviteUrl = `${window.location.origin}/?room=${room.code}`;

  const deck = useMemo(() => {
    const count = Math.max(MIN_PLAYERS, n);
    const spec = deckSpec(count, room.settings.expansion);
    const tally = {};
    for (const t of spec.main) tally[t] = (tally[t] || 0) + 1;
    tally.defuse = count + spec.extraDefuses;
    tally.kaboom = spec.kabooms;
    return { tally, total: spec.main.length + tally.defuse + tally.kaboom };
  }, [n, room.settings.expansion]);

  const start = async () => {
    sound.ensure();
    setStarting(true);
    await call('game:start');
    setStarting(false);
  };

  const setting = (patch) => call('room:settings', patch);

  return (
    <div className={s.page}>
      <TopBar code={room.code} />
      <main className={s.lobby}>
        <motion.section className={`panel ${s.hero}`} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div>
            <div className="label">Room code</div>
            <div className={s.code}>{room.code}</div>
          </div>
          <div className={s.invite}>
            <span className="muted">Send this link to your friends:</span>
            <div className={s.inviteRow}>
              <input className="input" readOnly value={inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invite link" />
              <button className="btn btn-primary" onClick={() => copyText(inviteUrl).then(() => toast('🔗 Invite link copied!', { kind: 'good' }))}>Copy</button>
            </div>
          </div>
        </motion.section>

        <section className={`panel ${s.section}`}>
          <h3>
            Players <span className="muted">{n}/{MAX_PLAYERS}</span>
            {isHost && (
              <button className="btn btn-sm" disabled={n >= MAX_PLAYERS} onClick={() => call('room:addBot')}>🤖 Add bot</button>
            )}
          </h3>
          <div className={s.players}>
            <AnimatePresence initial={false}>
              {room.players.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  className={s.tile}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                >
                  <Avatar player={p} />
                  <span className={s.name}>{p.name}</span>
                  <span className={s.tags}>
                    {p.id === room.hostId && <span className="tag tag-host">host</span>}
                    {p.id === you && <span className="tag tag-you">you</span>}
                    {!p.connected && <span className="tag tag-off">away</span>}
                  </span>
                  {isHost && p.id !== you && (
                    <button className={s.kick} title={`Remove ${p.name}`} aria-label={`Remove ${p.name}`} onClick={() => call('room:kick', { playerId: p.id })}>✕</button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {Array.from({ length: Math.max(0, Math.min(2, MAX_PLAYERS - n)) }).map((_, i) => (
              <div key={`empty${i}`} className={`${s.tile} ${s.empty}`}>waiting for a player…</div>
            ))}
          </div>

          <div className={s.start}>
            {isHost ? (
              <>
                <button className="btn btn-good btn-lg" disabled={n < MIN_PLAYERS || starting} onClick={start}>
                  {room.gamesPlayed > 0 ? '🔁 Play again' : '🚀 Start game'}
                </button>
                {n < MIN_PLAYERS && <span className="muted">You need at least 2 players. Invite someone or add a bot.</span>}
              </>
            ) : (
              <div className={s.waiting}>
                <motion.span className="emoji" animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>⏳</motion.span>
                Waiting for the host to start…
              </div>
            )}
          </div>
        </section>

        <aside className={s.side}>
          <section className={`panel ${s.section}`}>
            <h3>Settings {!isHost && <span className="muted" style={{ fontSize: 13 }}>host only</span>}</h3>
            <div className={s.row}>
              <div>
                <div className={s.sTitle}>Nope window</div>
                <div className={s.sDesc}>How long everyone has to play a Nope.</div>
              </div>
              <Seg value={room.settings.nopeSeconds} options={[3, 4, 5, 6]} suffix="s" disabled={!isHost} onChange={(v) => setting({ nopeSeconds: v })} />
            </div>
            <div className={s.row}>
              <div>
                <div className={s.sTitle}>Turn timer</div>
                <div className={s.sDesc}>Auto-draw when time runs out.</div>
              </div>
              <Seg value={room.settings.turnTimer} options={[0, 30, 60, 90]} labels={{ 0: 'Off' }} suffix="s" disabled={!isHost} onChange={(v) => setting({ turnTimer: v })} />
            </div>
            <div className={s.row}>
              <div>
                <div className={s.sTitle}>Party pack cards</div>
                <div className={s.sDesc}>Adds Alter the Future, Reverse and Draw from Bottom.</div>
              </div>
              <button
                className={`${s.switch} ${room.settings.expansion ? s.on : ''}`}
                disabled={!isHost}
                role="switch"
                aria-checked={room.settings.expansion}
                aria-label="Party pack cards"
                onClick={() => setting({ expansion: !room.settings.expansion })}
              />
            </div>
            <div className={s.deck}>
              <div className="label" style={{ marginTop: 10 }}>Deck for {Math.max(2, n)} players · {deck.total} cards</div>
              <div className={s.chips}>
                {Object.entries(deck.tally).map(([t, c]) => (
                  <span key={t} className={s.chip} title={CARD_TYPES[t].name}><span className="emoji">{CARD_TYPES[t].icon}</span> {c}</span>
                ))}
              </div>
            </div>
          </section>
          <section className={`panel ${s.section} ${s.chatPanel}`}>
            <h3>Chat</h3>
            <Chat chat={room.chat} players={room.players} />
          </section>
        </aside>
      </main>
    </div>
  );
}

function Seg({ value, options, labels = {}, suffix = '', disabled, onChange }) {
  return (
    <div className={s.seg} role="radiogroup">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          className={value === o ? s.segOn : ''}
          disabled={disabled}
          onClick={() => onChange(o)}
        >
          {labels[o] ?? `${o}${suffix}`}
        </button>
      ))}
    </div>
  );
}
