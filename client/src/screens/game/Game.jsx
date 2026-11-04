import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARD_TYPES } from '@shared/cards.js';
import { useScreenState, onGameEvent, emit } from '../../lib/store.js';
import { analyzeSelection, playDescription } from '../../lib/combo.js';
import { sound } from '../../lib/sound.js';
import { confetti, explosion } from '../../lib/fx.js';
import { TopBar } from '../../components/TopBar.jsx';
import { Card } from '../../components/Card.jsx';
import { toast, errorToast } from '../../components/Toasts.jsx';
import { Seats } from './Seats.jsx';
import { TableCenter } from './TableCenter.jsx';
import { Hand } from './Hand.jsx';
import { Sidebar } from './Sidebar.jsx';
import { PromptModals } from './PromptModals.jsx';
import { NameCardModal, FutureModal, DiscardModal } from './InfoModals.jsx';
import { BoomOverlay } from './BoomOverlay.jsx';
import { GameOver } from './GameOver.jsx';
import s from './Game.module.css';

const call = async (event, payload) => {
  try {
    await emit(event, payload);
    return true;
  } catch (err) {
    errorToast(err.message);
    return false;
  }
};

export function Game() {
  const { room, game, you } = useScreenState((st) => !!(st.room && st.game));

  // Merge lobby identity (avatar, colour, connection) with in-game state.
  const players = useMemo(() => game.players.map((gp) => {
    const rp = room.players.find((p) => p.id === gp.id);
    return { avatar: '🙀', color: '#555', connected: false, isBot: false, ...rp, ...gp };
  }), [game.players, room.players]);
  const playersRef = useRef(players);
  playersRef.current = players;
  const nameOf = (id) => (id === you ? 'You' : playersRef.current.find((p) => p.id === id)?.name ?? 'Someone');

  const me = players.find((p) => p.id === you);
  const playing = game.phase === 'playing';
  const idle = playing && !game.pending && !game.prompt;
  const myTurn = playing && game.turnPlayerId === you;
  const canAct = myTurn && idle && me?.alive;
  const hasNope = game.hand.some((c) => c.type === 'nope');
  // Hide the button when noping would only undo your own move (your un-noped action, or your own last Nope).
  const lastNoper = game.pending?.nopeChain?.[game.pending.nopeChain.length - 1];
  const canNope = playing && !!game.pending && me?.alive && hasNope
    && !(game.pending.playerId === you && game.pending.nopes % 2 === 0)
    && lastNoper !== you;

  // ----- local UI state -----
  const [selected, setSelected] = useState([]);
  const [targeting, setTargeting] = useState(null); // { cardIds, analysis }
  const [naming, setNaming] = useState(null); // { cardIds, targetId }
  const [future, setFuture] = useState(null);
  const [boom, setBoom] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handKey = game.hand.map((c) => c.id).join(',');
  useEffect(() => {
    setSelected((sel) => sel.filter((id) => game.hand.some((c) => c.id === id)));
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canAct) { setTargeting(null); setNaming(null); }
  }, [canAct]);

  const selectedCards = selected.map((id) => game.hand.find((c) => c.id === id)).filter(Boolean);
  const analysis = analyzeSelection(selectedCards);

  // ----- game events → sound, toasts, fx -----
  useEffect(() => onGameEvent((ev) => {
    const mini = (type) => <Card type={type} size="xs" />;
    switch (ev.type) {
      case 'played':
        sound.play('card');
        if (ev.targetId === you && ev.playerId !== you) {
          toast(<>🎯 <b>{nameOf(ev.playerId)}</b> targets you with {playDescription({ kind: ev.kind, cardTypes: ev.cardTypes })}!</>, { kind: 'err' });
        }
        break;
      case 'noped':
        sound.play('nope');
        break;
      case 'drew':
        sound.play('draw');
        toast(<>{mini(ev.card.type)} You drew <b>{CARD_TYPES[ev.card.type].name}</b>{ev.fromBottom ? ' from the bottom' : ''}</>);
        break;
      case 'stolen':
        sound.play('steal');
        if (ev.toId === you) toast(<>{mini(ev.card.type)} You got <b>{CARD_TYPES[ev.card.type].name}</b> from {nameOf(ev.fromId)}</>, { kind: 'good' });
        else if (ev.fromId === you) toast(<>{mini(ev.card.type)} {nameOf(ev.toId)} took your <b>{CARD_TYPES[ev.card.type].name}</b></>, { kind: 'err' });
        break;
      case 'gave':
        sound.play('steal');
        if (ev.toId === you) toast(<>{mini(ev.card.type)} {nameOf(ev.fromId)} gave you <b>{CARD_TYPES[ev.card.type].name}</b></>, { kind: 'good' });
        break;
      case 'future':
        if (ev.altered) {
          toast('🪄 The future has been rearranged', { kind: 'good' });
        } else {
          setFuture(ev.cards);
        }
        break;
      case 'kaboom':
        sound.play('boom');
        if (ev.defused) setTimeout(() => sound.play('defuse'), 700);
        explosion(ev.defused);
        setShakeKey((k) => k + 1);
        setBoom({ key: Date.now(), defused: ev.defused, isMe: ev.playerId === you, name: nameOf(ev.playerId) });
        break;
      case 'turn':
        if (ev.playerId === you) {
          sound.play('turn');
          toast(ev.turnsRemaining > 1 ? `⏰ Your turn! (${ev.turnsRemaining} turns)` : '⏰ Your turn!', { ms: 1800 });
        }
        break;
      case 'shuffled':
        toast('🌪️ The deck was shuffled', { ms: 1800 });
        break;
      case 'win':
        setTimeout(() => { confetti(); sound.play('win'); }, ev.playerId === you ? 400 : 1600);
        break;
      default:
        break;
    }
  }), [you]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- actions -----
  const play = useCallback(async (cardIds, targetId, namedType) => {
    if (await call('game:play', { cardIds, targetId, namedType })) setSelected([]);
  }, []);

  const onPlay = () => {
    if (!analysis || analysis.error || !canAct) return;
    if (analysis.needsTarget) setTargeting({ cardIds: [...selected], analysis });
    else play(selected);
  };

  const onPickTarget = (p) => {
    if (!targeting || !p.alive || p.handCount === 0 || p.id === you) return;
    if (targeting.analysis.needsName) setNaming({ cardIds: targeting.cardIds, targetId: p.id });
    else play(targeting.cardIds, p.id);
    setTargeting(null);
  };

  const draw = () => { if (canAct) call('game:draw'); };
  const nope = () => { if (canNope) call('game:nope'); };
  const respond = (payload) => call('game:respond', { promptId: game.prompt.id, ...payload });

  const toggleCard = (id) => {
    setTargeting(null);
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  };

  // ----- keyboard shortcuts -----
  const keyState = useRef({});
  keyState.current = { draw, nope, onPlay, canAct, canNope };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [role=dialog]')) return;
      const k = keyState.current;
      if (e.key === 'd' || e.key === 'D') k.draw();
      else if (e.key === 'n' || e.key === 'N') k.nope();
      else if (e.key === 'Enter') k.onPlay();
      else if (e.key === 'Escape') { setSelected([]); setTargeting(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const opponents = useMemo(() => {
    const idx = players.findIndex((p) => p.id === you);
    if (idx < 0) return players;
    return [...players.slice(idx + 1), ...players.slice(0, idx)];
  }, [players, you]);

  return (
    <div className={s.game}>
      <TopBar code={room.code} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className={s.main}>
        <div className={s.tableArea}>
          <Seats
            players={opponents}
            game={game}
            room={room}
            you={you}
            targeting={targeting}
            onPick={onPickTarget}
            onCancelTarget={() => setTargeting(null)}
          />
          <TableCenter
            game={game}
            room={room}
            players={players}
            you={you}
            canDraw={canAct}
            onDraw={draw}
            onOpenDiscard={() => setShowDiscard(true)}
            shakeKey={shakeKey}
          />
          <Hand
            me={me}
            game={game}
            selected={selected}
            onToggle={toggleCard}
            analysis={analysis}
            canAct={canAct}
            myTurn={myTurn}
            onPlay={onPlay}
            onDraw={draw}
            onClear={() => { setSelected([]); setTargeting(null); }}
            canNope={canNope}
            onNope={nope}
          />
        </div>
        <Sidebar game={game} room={room} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <PromptModals game={game} players={players} you={you} onRespond={respond} />
      <NameCardModal
        open={!!naming}
        expansion={room.settings.expansion}
        targetName={naming ? nameOf(naming.targetId) : ''}
        onClose={() => setNaming(null)}
        onPick={(type) => { play(naming.cardIds, naming.targetId, type); setNaming(null); }}
      />
      <FutureModal cards={future} onClose={() => setFuture(null)} />
      <DiscardModal open={showDiscard} discard={game.discard} onClose={() => setShowDiscard(false)} />
      <BoomOverlay boom={boom} onDone={() => setBoom(null)} />
      <GameOver game={game} players={players} room={room} you={you} />
    </div>
  );
}
