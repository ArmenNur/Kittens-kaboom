import { useState } from 'react';
import { motion } from 'framer-motion';
import { createRoom, joinRoom, savedName } from '../lib/store.js';
import { sound } from '../lib/sound.js';
import { Card } from '../components/Card.jsx';
import { errorToast } from '../components/Toasts.jsx';
import { RulesModal } from '../components/RulesModal.jsx';
import s from './Home.module.css';

const HERO = [
  { type: 'kaboom', rotate: -16, x: 0, y: 14 },
  { type: 'defuse', rotate: -5, x: 82, y: -6 },
  { type: 'nope', rotate: 6, x: 164, y: 0 },
  { type: 'wizardcat', rotate: 17, x: 246, y: 20 },
];

export function Home() {
  const initialCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);

  const validName = name.trim().length > 0;

  const run = async (fn) => {
    sound.ensure(); // unlock audio on a user gesture
    if (!validName) return errorToast('Enter your name first');
    setBusy(true);
    try { await fn(); } catch (err) { errorToast(err.message); } finally { setBusy(false); }
  };

  return (
    <div className={s.home}>
      <div className={s.inner}>
        <motion.section initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <h1 className={s.logo}>
            <span className={s.k1}>Kitten</span><br /><span className={s.k2}>Kaboom</span>
          </h1>
          <p className={s.tagline}>
            The party card game where you really, <i>really</i> don't want to draw the cat with the fuse.
            2–10 players, real-time, bots included.
          </p>
          <div className={s.hero} aria-hidden="true">
            {HERO.map((h, i) => (
              <motion.div
                key={h.type}
                className={s.heroCard}
                style={{ left: h.x, zIndex: i === 1 ? 2 : 1 }}
                initial={{ opacity: 0, y: -160, rotate: 0 }}
                animate={{ opacity: 1, y: h.y, rotate: h.rotate }}
                whileHover={{ y: h.y - 22, rotate: h.rotate * 0.4, scale: 1.06, zIndex: 5 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 + i * 0.12 }}
              >
                <Card type={h.type} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className={`panel ${s.form}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2>{initialCode ? `Join room ${initialCode}` : 'Start playing'}</h2>
          <div className={s.field}>
            <label className="label" htmlFor="name">Your name</label>
            <input
              id="name"
              className="input"
              maxLength={16}
              placeholder="e.g. Captain Whiskers"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (code.length === 4) run(() => joinRoom(code, name.trim()));
                else run(() => createRoom(name.trim()));
              }}
            />
          </div>
          {!initialCode && (
            <>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy} onClick={() => run(() => createRoom(name.trim()))}>
                🎉 Create a room
              </button>
              <div className={s.or}>or join friends</div>
            </>
          )}
          <div className={s.joinRow}>
            <input
              className={`input ${s.codeInput}`}
              maxLength={4}
              placeholder="CODE"
              aria-label="Room code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 4) run(() => joinRoom(code, name.trim())); }}
            />
            <button
              className={`btn ${initialCode ? 'btn-primary btn-lg' : ''}`}
              disabled={busy || code.length !== 4}
              onClick={() => run(() => joinRoom(code, name.trim()))}
            >
              Join
            </button>
          </div>
          {initialCode && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14, width: '100%' }} onClick={() => { setCode(''); window.history.replaceState(null, '', '/'); }}>
              …or create a new room instead
            </button>
          )}
          <p className={s.foot}>
            New here? <button className={s.link} onClick={() => setRules(true)}>Read the rules</button> (2 minutes).
          </p>
        </motion.section>
      </div>
      <RulesModal open={rules} onClose={() => setRules(false)} />
    </div>
  );
}
