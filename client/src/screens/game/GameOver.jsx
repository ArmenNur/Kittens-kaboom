import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { emit } from '../../lib/store.js';
import { Modal } from '../../components/Modal.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { errorToast } from '../../components/Toasts.jsx';
import s from './GameOver.module.css';

export function GameOver({ game, players, room, you }) {
  const ended = game.phase === 'ended';
  const [show, setShow] = useState(false);

  // Let the final explosion play before the results pop up.
  useEffect(() => {
    if (!ended) { setShow(false); return undefined; }
    const t = setTimeout(() => setShow(true), 2200);
    return () => clearTimeout(t);
  }, [ended]);

  const winner = players.find((p) => p.id === game.winnerId);
  const ranking = [...players].sort((a, b) => {
    if (a.id === game.winnerId) return -1;
    if (b.id === game.winnerId) return 1;
    return (b.outRank ?? 0) - (a.outRank ?? 0);
  });
  const isHost = room.hostId === you;
  const iWon = game.winnerId === you;

  return (
    <Modal
      open={ended && show}
      onClose={() => setShow(false)}
      actions={<>
        <button className="btn" onClick={() => setShow(false)}>View table</button>
        {isHost
          ? <button className="btn btn-good" onClick={() => emit('game:lobby').catch((e) => errorToast(e.message))}>🔁 Back to lobby</button>
          : <span className="muted" style={{ alignSelf: 'center' }}>Waiting for the host…</span>}
      </>}
    >
      <div className={s.winner}>
        <motion.div className={`${s.trophy} emoji`} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>🏆</motion.div>
        <h2 className={s.title}>{iWon ? 'You win! 🎉' : winner ? `${winner.name} wins!` : 'Game over'}</h2>
        <p className="muted">{iWon ? 'Last kitten standing. Legendary.' : 'The last kitten standing takes it all.'}</p>
        <ol className={s.ranking}>
          {ranking.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.07 }}
            >
              <span className={s.place}>{i + 1}</span>
              <Avatar player={p} size={32} />
              <span className={s.name}>{p.name}{p.id === you ? ' (you)' : ''}</span>
              <span className="muted">{p.id === game.winnerId ? '👑' : p.left ? 'left' : '💥'}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
