import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { CARD_TYPES } from '@shared/cards.js';
import { Card } from '../../components/Card.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import s from './Hand.module.css';

// Keep the hand tidy: life-savers first, then actions, then cats.
const ORDER = ['defuse', 'nope', 'attack', 'skip', 'reverse', 'bottom', 'future', 'alter', 'shuffle', 'favor', 'pizzacat', 'discocat', 'ninjacat', 'wizardcat', 'spacecat'];
const rank = (t) => { const i = ORDER.indexOf(t); return i < 0 ? 99 : i; };

export function Hand({ me, game, selected, onToggle, analysis, canAct, myTurn, onPlay, onDraw, onClear, canNope, onNope }) {
  const hand = useMemo(
    () => [...game.hand].sort((a, b) => rank(a.type) - rank(b.type) || a.id.localeCompare(b.id, undefined, { numeric: true })),
    [game.hand],
  );
  const n = hand.length;
  const overlap = n <= 6 ? -8 : n <= 9 ? -34 : n <= 13 ? -56 : -72;
  const alive = me?.alive;
  const nopeLabel = game.pending && game.pending.nopes % 2 === 1 ? 'YUP!' : 'NOPE!';

  let hint = null;
  if (!alive) hint = null;
  else if (analysis?.error) hint = <span className={s.err}>{analysis.error}</span>;
  else if (!myTurn && selected.length) hint = 'Wait for your turn to play cards.';
  else if (myTurn && !selected.length && canAct) hint = 'Select cards to play, or draw to end your turn.';

  return (
    <div className={s.area}>
      <div className={s.bar}>
        <div className={`${s.who}`}>
          <Avatar player={me} glow={myTurn} dead={!alive} />
          <div>
            <div className={s.myName}>{me?.name} <span className="tag tag-you">you</span></div>
            <div className={s.sub}>{alive ? `${n} card${n === 1 ? '' : 's'} in hand` : 'Spectating'}</div>
          </div>
        </div>
        {alive && (
          <div className={s.actions}>
            {hint && <span className={s.hint}>{hint}</span>}
            {selected.length > 0 && <button className="btn btn-sm btn-ghost" onClick={onClear}>Clear</button>}
            <motion.button
              className="btn btn-primary"
              disabled={!canAct || !analysis || !!analysis.error}
              onClick={onPlay}
              whileTap={{ scale: 0.95 }}
            >
              {analysis && !analysis.error ? analysis.label : 'Play'}
            </motion.button>
            <motion.button
              className="btn btn-good"
              disabled={!canAct}
              onClick={onDraw}
              whileTap={{ scale: 0.95 }}
              animate={canAct && !selected.length ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={canAct && !selected.length ? { repeat: Infinity, duration: 1.6 } : undefined}
            >
              Draw &amp; end turn
            </motion.button>
          </div>
        )}
      </div>

      {alive ? (
        <div className={s.hand} style={{ '--overlap': `${overlap}px` }}>
          {n === 0 && <div className={s.empty}>No cards. Good luck… 😬</div>}
          <AnimatePresence initial={false} mode="popLayout">
            {hand.map((c, i) => {
              const isSel = selected.includes(c.id);
              return (
                <Card
                  key={c.id}
                  layout
                  type={c.type}
                  interactive
                  selected={isSel}
                  className={s.card}
                  style={{ zIndex: isSel ? 50 : i }}
                  onClick={() => onToggle(c.id)}
                  tabIndex={0}
                  // Space toggles the focused card; Enter bubbles up to the global "play selection" shortcut.
                  onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); onToggle(c.id); } }}
                  aria-pressed={isSel}
                  aria-label={`${CARD_TYPES[c.type].name}${isSel ? ' (selected)' : ''}`}
                  initial={{ opacity: 0, y: -140, rotate: -14, scale: 0.7 }}
                  animate={{ opacity: 1, y: isSel ? -26 : 0, rotate: 0, scale: isSel ? 1.06 : 1 }}
                  exit={{ opacity: 0, y: -120, scale: 0.8, transition: { duration: 0.25 } }}
                  whileHover={{ y: isSel ? -30 : -14, scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                />
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div className={s.dead} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          💀 You exploded. Stick around and watch the chaos!
        </motion.div>
      )}

      {createPortal(
        <AnimatePresence>
          {canNope && (
            <motion.button
              key="nope"
              className={s.nope}
              onClick={onNope}
              title="Play a Nope (N)"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: [1, 1.08, 1], rotate: 0 }}
              // Explicit exit transition: otherwise exit inherits the infinite pulse and never completes.
              exit={{ scale: 0, rotate: 40, transition: { duration: 0.2 } }}
              transition={{ scale: { repeat: Infinity, duration: 0.9 }, rotate: { type: 'spring', stiffness: 300 } }}
              whileTap={{ scale: 0.85 }}
            >
              {nopeLabel}
              <small>{game.hand.filter((c) => c.type === 'nope').length} left · N</small>
            </motion.button>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
