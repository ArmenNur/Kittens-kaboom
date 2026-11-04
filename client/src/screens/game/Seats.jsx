import { AnimatePresence, motion } from 'framer-motion';
import { emit } from '../../lib/store.js';
import { Avatar } from '../../components/Avatar.jsx';
import { errorToast } from '../../components/Toasts.jsx';
import s from './Seats.module.css';

export function Seats({ players, game, room, you, targeting, onPick, onCancelTarget }) {
  const isHost = room.hostId === you;
  const pendTarget = game.pending?.targetId;

  return (
    <div className={s.wrap}>
      <AnimatePresence>
        {targeting && (
          <motion.div
            className={s.banner}
            initial={{ opacity: 0, y: -12, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -12, x: '-50%' }}
          >
            🎯 {targeting.analysis.kind === 'favor' ? 'Who do you want a favor from?' : 'Pick a player to steal from'}
            <button onClick={onCancelTarget}>Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={s.seats}>
        {players.filter((p) => p.id !== you).map((p) => {
          const isTurn = game.phase === 'playing' && game.turnPlayerId === p.id;
          const targetable = targeting && p.alive && p.handCount > 0;
          const cls = [
            s.seat,
            isTurn && s.turn,
            !p.alive && s.dead,
            targeting && (targetable ? s.targetable : s.untargetable),
            pendTarget === p.id && s.targeted,
          ].filter(Boolean).join(' ');
          return (
            <motion.div
              key={p.id}
              layout
              className={cls}
              onClick={() => targetable && onPick(p)}
              role={targetable ? 'button' : undefined}
              tabIndex={targetable ? 0 : undefined}
              onKeyDown={(e) => { if (targetable && (e.key === 'Enter' || e.key === ' ')) onPick(p); }}
              aria-label={targetable ? `Target ${p.name}` : undefined}
              animate={isTurn ? { y: -4 } : { y: 0 }}
              whileHover={targetable ? { scale: 1.05, y: -6 } : undefined}
            >
              {isTurn && game.turnsRemaining > 1 && <span className={s.badge}>×{game.turnsRemaining}</span>}
              {!p.connected && !p.isBot && p.alive && <span className={s.off}>offline</span>}
              <Avatar player={p} glow={isTurn} dead={!p.alive} />
              <div className={s.name} title={p.name}>{p.name}</div>
              {p.alive ? (
                <>
                  <div className={s.mini} aria-hidden="true">
                    <AnimatePresence initial={false}>
                      {Array.from({ length: Math.min(p.handCount, 9) }).map((_, i) => (
                        <motion.span
                          key={i}
                          className={s.miniCard}
                          style={{ rotate: (i - Math.min(p.handCount, 9) / 2) * 5 }}
                          initial={{ opacity: 0, y: -12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 12 }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className={s.count}>{p.handCount} card{p.handCount === 1 ? '' : 's'}</div>
                </>
              ) : (
                <div className={s.count}>{p.left ? 'left' : 'exploded'}</div>
              )}
              {isHost && !p.isBot && !p.connected && p.alive && (
                <button
                  className={s.kick}
                  title="Remove this player"
                  onClick={(e) => { e.stopPropagation(); emit('room:kick', { playerId: p.id }).catch((err) => errorToast(err.message)); }}
                >
                  remove
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
