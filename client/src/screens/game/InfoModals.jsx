import { useState } from 'react';
import { motion } from 'framer-motion';
import { CARD_TYPES } from '@shared/cards.js';
import { Modal } from '../../components/Modal.jsx';
import { Card } from '../../components/Card.jsx';
import s from './Prompts.module.css';

/** Three-of-a-kind: name the card you want. */
export function NameCardModal({ open, expansion, targetName, onClose, onPick }) {
  const [chosen, setChosen] = useState(null);
  const types = Object.keys(CARD_TYPES).filter((t) => t !== 'kaboom' && (expansion || !CARD_TYPES[t].expansion));
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`🎣 What do you want from ${targetName}?`}
      subtitle="Name a card. If they have one, they must hand it over. Defuse is a popular choice."
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!chosen} onClick={() => { onPick(chosen); setChosen(null); }}>
          Ask for {chosen ? CARD_TYPES[chosen].name : '…'}
        </button>
      </>}
    >
      <div className={s.pickGrid}>
        {types.map((t) => (
          <Card
            key={t}
            type={t}
            size="sm"
            interactive
            selected={chosen === t}
            onClick={() => setChosen(t)}
            whileHover={{ y: -6, scale: 1.05 }}
            animate={{ y: chosen === t ? -6 : 0 }}
          />
        ))}
      </div>
    </Modal>
  );
}

export function FutureModal({ cards, onClose }) {
  return (
    <Modal
      open={!!cards}
      onClose={onClose}
      wide
      title="🔮 The future…"
      subtitle={cards?.length ? 'The top cards of the draw pile, leftmost first. Keep it to yourself 🤐' : 'The deck is empty.'}
      actions={<button className="btn btn-primary" onClick={onClose}>Got it</button>}
    >
      <div className={s.reorder}>
        {(cards ?? []).map((t, i) => (
          <div key={i} className={s.reorderItem} style={{ cursor: 'default' }}>
            <div className={s.pos}>{i === 0 ? '⬆ Next draw' : i === 1 ? '2nd' : '3rd'}</div>
            <motion.div
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.18, duration: 0.5 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Card type={t} size="lg" />
            </motion.div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function DiscardModal({ open, discard, onClose }) {
  const cards = [...discard].reverse();
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`🗑️ Discard pile (${discard.length})`}
      subtitle="Most recent first."
      actions={<button className="btn" onClick={onClose}>Close</button>}
    >
      {cards.length === 0 ? <p className="muted">Nothing here yet.</p> : (
        <div className={s.pickGrid}>
          {cards.map((c) => <Card key={c.id} type={c.type} size="sm" />)}
        </div>
      )}
    </Modal>
  );
}
