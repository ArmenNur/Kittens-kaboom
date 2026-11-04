import { useEffect } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { CARD_TYPES } from '@shared/cards.js';
import { playDescription } from '../../lib/combo.js';
import { useServerNow } from '../../lib/useNow.js';
import { Card } from '../../components/Card.jsx';
import { CountdownBar } from '../../components/CountdownBar.jsx';
import s from './TableCenter.module.css';

export function TableCenter({ game, room, players, you, canDraw, onDraw, onOpenDiscard, shakeKey }) {
  const nameOf = (id) => (id === you ? 'You' : players.find((p) => p.id === id)?.name ?? '?');
  const top = game.discard[game.discard.length - 1];
  const danger = game.deckCount ? game.kaboomsInDeck / game.deckCount : 0;
  const now = useServerNow(!!room.turnDeadline, 250);
  const secondsLeft = room.turnDeadline ? Math.max(0, Math.ceil((room.turnDeadline - now) / 1000)) : null;

  const shake = useAnimationControls();
  useEffect(() => {
    if (shakeKey) shake.start({ x: [0, -12, 10, -8, 6, -3, 0], rotate: [0, -1, 1, -0.5, 0.5, 0, 0], transition: { duration: 0.5 } });
  }, [shakeKey, shake]);

  return (
    <motion.div className={s.table} animate={shake}>
      <Status game={game} nameOf={nameOf} you={you} secondsLeft={game.phase === 'playing' ? secondsLeft : null} />

      <div className={s.piles}>
        <div className={s.pile}>
          <div
            className={`${s.deck} ${canDraw ? s.drawable : ''}`}
            onClick={canDraw ? onDraw : undefined}
            role={canDraw ? 'button' : undefined}
            tabIndex={canDraw ? 0 : undefined}
            aria-label={canDraw ? 'Draw a card' : `Draw pile, ${game.deckCount} cards`}
            onKeyDown={(e) => { if (canDraw && (e.key === 'Enter' || e.key === ' ')) onDraw(); }}
          >
            {game.deckCount > 2 && <Card type="back" className={s.stack2} />}
            {game.deckCount > 1 && <Card type="back" className={s.stack1} />}
            <Card
              type="back"
              className={s.topCard}
              whileHover={canDraw ? { y: -14, rotate: -3 } : undefined}
              whileTap={canDraw ? { scale: 0.95 } : undefined}
            />
            <motion.span key={game.deckCount} className={s.count} initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
              {game.deckCount}
            </motion.span>
          </div>
          <div className={s.label}>{canDraw ? 'Click to draw' : 'Draw pile'}</div>
          <div className={s.danger} title="Chance the top card is a Kaboom Kitten">
            💣 {game.kaboomsInDeck}
            <span className={s.dangerBar}><motion.span animate={{ width: `${Math.min(100, danger * 100)}%` }} /></span>
            {Math.round(danger * 100)}%
          </div>
        </div>

        <div className={s.pile}>
          <button className={s.discard} onClick={onOpenDiscard} aria-label={`Discard pile, ${game.discard.length} cards. Open to view.`}>
            <AnimatePresence initial={false}>
              {top && (
                <Card
                  key={top.id}
                  type={top.type}
                  className={s.discardCard}
                  initial={{ opacity: 0, y: -60, scale: 1.35, rotate: 10 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: ((top.id.charCodeAt(top.id.length - 1) % 7) - 3) }}
                  exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.25 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                />
              )}
            </AnimatePresence>
          </button>
          <div className={s.label}>Discard · {game.discard.length}</div>
          <div className={s.direction}>
            Turn order
            <motion.span className={s.arrow} animate={{ rotate: game.direction === 1 ? 0 : 180 }}>➜</motion.span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {game.pending && <Pending key={game.pending.id} pending={game.pending} nameOf={nameOf} room={room} />}
      </AnimatePresence>
    </motion.div>
  );
}

function Status({ game, nameOf, you, secondsLeft }) {
  if (game.phase !== 'playing') return <div className={s.status}>🏁 Game over</div>;
  const pr = game.prompt;
  let text;
  if (pr && pr.playerId !== you) {
    const who = nameOf(pr.playerId);
    text = {
      defuse: `🤫 ${who} is hiding the Kaboom Kitten somewhere in the deck…`,
      favor: `🎁 ${who} is choosing a card to give ${nameOf(pr.fromId)}…`,
      alter: `🪄 ${who} is rearranging the future…`,
      pickDiscard: `🗑️ ${who} is digging through the discard pile…`,
    }[pr.type];
  } else if (pr) {
    text = '👉 Make your choice…';
  } else if (game.turnPlayerId === you) {
    text = <span className={s.you}>Your turn! Play cards, then draw.</span>;
  } else {
    text = `${nameOf(game.turnPlayerId)}'s turn`;
  }
  return (
    <div className={s.status}>
      <AnimatePresence mode="wait">
        <motion.span key={`${game.turnNumber}:${pr?.id ?? ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {text}
        </motion.span>
      </AnimatePresence>
      {game.turnsRemaining > 1 && !pr && <span className={s.pill}>{game.turnsRemaining} turns</span>}
      {secondsLeft != null && !pr && <span className={`${s.timer} ${secondsLeft <= 10 ? s.low : ''}`}>⏱ {secondsLeft}s</span>}
    </div>
  );
}

function Pending({ pending, nameOf, room }) {
  const cancelled = pending.nopes % 2 === 1;
  const target = pending.targetId ? ` on ${nameOf(pending.targetId)}` : '';
  const named = pending.namedType ? `, asking for ${CARD_TYPES[pending.namedType].name}` : '';
  return (
    <motion.div
      className={`${s.pending} ${cancelled ? s.noped : ''}`}
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className={s.pendingCards}>
        {pending.cardTypes.map((t, i) => (
          <Card
            key={i}
            type={t}
            size="sm"
            initial={{ opacity: 0, y: 40, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: (i - (pending.cardTypes.length - 1) / 2) * 4 }}
            transition={{ delay: i * 0.05 }}
          />
        ))}
        <AnimatePresence>
          {pending.nopes > 0 && (
            <motion.div
              key={pending.nopes}
              className={`${s.stamp} ${cancelled ? '' : s.yup}`}
              initial={{ scale: 2.6, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: -14 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              {cancelled ? 'NOPE!' : 'YUP!'}{pending.nopes > 1 ? ` ×${pending.nopes}` : ''}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={s.pendingText}>
        <b>{nameOf(pending.playerId)}</b> played {playDescription(pending)}{target}{named}
        {cancelled && <span className={s.cancelled}> (cancelled)</span>}
      </div>
      <CountdownBar expiresAt={pending.expiresAt} totalMs={room.settings.nopeSeconds * 1000} />
    </motion.div>
  );
}
