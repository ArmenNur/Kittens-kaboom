import { useEffect, useMemo, useState } from 'react';
import { Reorder, motion } from 'framer-motion';
import { Modal } from '../../components/Modal.jsx';
import { Card } from '../../components/Card.jsx';
import { CountdownBar } from '../../components/CountdownBar.jsx';
import s from './Prompts.module.css';

const PROMPT_MS = 30_000;

/** Decisions the server is waiting on from *this* player. */
export function PromptModals({ game, players, you, onRespond }) {
  const pr = game.prompt && game.prompt.playerId === you ? game.prompt : null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const timer = pr?.expiresAt ? <div className={s.timer}><CountdownBar expiresAt={pr.expiresAt} totalMs={PROMPT_MS} width="100%" tone="cool" /></div> : null;

  return (
    <>
      <DefuseModal key={`d${pr?.id}`} open={pr?.type === 'defuse'} prompt={pr} turnsLeft={game.turnsRemaining} timer={timer} onRespond={onRespond} />
      <AlterModal key={`a${pr?.id}`} open={pr?.type === 'alter'} prompt={pr} timer={timer} onRespond={onRespond} />
      <FavorModal key={`f${pr?.id}`} open={pr?.type === 'favor'} hand={game.hand} toName={pr ? nameOf(pr.fromId) : ''} timer={timer} onRespond={onRespond} />
      <PickDiscardModal key={`p${pr?.id}`} open={pr?.type === 'pickDiscard'} prompt={pr} discard={game.discard} timer={timer} onRespond={onRespond} />
    </>
  );
}

function ordinal(n) {
  const sfx = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]);
}

function DefuseModal({ open, prompt, turnsLeft, timer, onRespond }) {
  const deckCount = prompt?.deckCount ?? 0;
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const quick = [
    { label: 'Top', v: 0 },
    { label: '2nd', v: 1 },
    { label: '3rd', v: 2 },
    { label: 'Middle', v: Math.floor(deckCount / 2) },
    { label: 'Bottom', v: deckCount },
  ].filter((q, i, arr) => q.v <= deckCount && arr.findIndex((x) => x.v === q.v) === i);

  // Defusing uses up one turn; if attacked turns remain, the top card comes back to *you*.
  const readout = pos === 0
    ? (turnsLeft > 1 ? '⚠️ On top, but you still have another turn, so YOU draw it next!' : 'On top: the next player draws it! 😈')
    : pos >= deckCount ? 'At the very bottom'
    : `${ordinal(pos + 1)} card from the top`;
  const bars = Math.min(deckCount, 48);
  const markerAt = deckCount === 0 ? 0 : Math.round((pos / deckCount) * bars);

  const submit = async (position) => {
    setBusy(true);
    await onRespond({ position });
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      dismissable={false}
      title="🧯 Defused! Now hide the kitten"
      subtitle="Secretly put the Kaboom Kitten back into the draw pile. Nobody else sees where."
      actions={<>
        <button className="btn" disabled={busy} onClick={() => submit(Math.floor(Math.random() * (deckCount + 1)))}>🎲 Random</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => submit(pos)}>Hide it here</button>
      </>}
    >
      <div className={s.defuse}>
        <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>
          <Card type="kaboom" size="lg" />
        </motion.div>
        <div className={s.picker}>
          <div className={s.deckStrip} aria-hidden="true">
            {Array.from({ length: bars + 1 }).map((_, i) => (
              <motion.span key={i} className={i === markerAt ? s.kitten : ''} layout />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={deckCount}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Position in deck (0 is top)"
          />
          <div className={s.readout}>{readout}</div>
          <div className={s.quick}>
            {quick.map((q) => (
              <button key={q.label} className={`btn btn-sm ${pos === q.v ? 'on' : ''}`} onClick={() => setPos(q.v)}>{q.label}</button>
            ))}
          </div>
          {timer}
        </div>
      </div>
    </Modal>
  );
}

function AlterModal({ open, prompt, timer, onRespond }) {
  const cards = prompt?.cards ?? [];
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  useEffect(() => { setOrder(cards.map((_, i) => i)); }, [prompt?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (from, to) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };

  return (
    <Modal
      open={open}
      dismissable={false}
      wide
      title="🪄 Alter the Future"
      subtitle="Drag the cards (or use the arrows) to set the order. The leftmost card is drawn next."
      actions={<button className="btn btn-primary" onClick={() => onRespond({ order })}>Lock it in</button>}
    >
      <Reorder.Group axis="x" values={order} onReorder={setOrder} className={s.reorder}>
        {order.map((idx, pos) => (
          <Reorder.Item key={idx} value={idx} className={s.reorderItem} whileDrag={{ scale: 1.08, zIndex: 5 }}>
            <div className={s.pos}>{pos === 0 ? '⬆ Next draw' : `${ordinal(pos + 1)}`}</div>
            <Card type={cards[idx]} size="lg" />
            <div className={s.arrows}>
              <button className="btn btn-sm" onClick={() => move(pos, pos - 1)} disabled={pos === 0} aria-label="Move left">◀</button>
              <button className="btn btn-sm" onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1} aria-label="Move right">▶</button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {timer}
    </Modal>
  );
}

function CardPicker({ cards, chosen, onChoose }) {
  return (
    <div className={s.pickGrid}>
      {cards.map((c) => (
        <Card
          key={c.id}
          type={c.type}
          size="sm"
          interactive
          selected={chosen === c.id}
          onClick={() => onChoose(c.id)}
          whileHover={{ y: -6, scale: 1.05 }}
          animate={{ y: chosen === c.id ? -6 : 0 }}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(c.id); } }}
        />
      ))}
    </div>
  );
}

function FavorModal({ open, hand, toName, timer, onRespond }) {
  const [chosen, setChosen] = useState(null);
  return (
    <Modal
      open={open}
      dismissable={false}
      wide
      title={`🎁 ${toName} asked you for a favor`}
      subtitle="Choose one card from your hand to give away."
      actions={<button className="btn btn-primary" disabled={!chosen} onClick={() => onRespond({ cardId: chosen })}>Give card</button>}
    >
      <CardPicker cards={hand} chosen={chosen} onChoose={setChosen} />
      {timer}
    </Modal>
  );
}

function PickDiscardModal({ open, prompt, discard, timer, onRespond }) {
  const [chosen, setChosen] = useState(null);
  const options = useMemo(() => {
    const ex = new Set(prompt?.exclude ?? []);
    return [...discard].reverse().filter((c) => !ex.has(c.id));
  }, [discard, prompt]);
  return (
    <Modal
      open={open}
      dismissable={false}
      wide
      title="🗑️ Pick any card from the discard pile"
      subtitle="Your five-card combo paid off. Take whatever you want."
      actions={<button className="btn btn-primary" disabled={!chosen} onClick={() => onRespond({ cardId: chosen })}>Take card</button>}
    >
      <CardPicker cards={options} chosen={chosen} onChoose={setChosen} />
      {timer}
    </Modal>
  );
}
