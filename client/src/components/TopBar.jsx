import { useState } from 'react';
import { sound } from '../lib/sound.js';
import { leaveRoom } from '../lib/store.js';
import { Modal } from './Modal.jsx';
import { RulesModal } from './RulesModal.jsx';
import s from './TopBar.module.css';

export function TopBar({ code, extra, onToggleSidebar }) {
  const [muted, setMuted] = useState(sound.muted);
  const [rules, setRules] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <header className={s.bar}>
      <div className={s.brand}>
        <span className="emoji">💣</span> <span className={s.brandText}>Kitten Kaboom</span>
        {code && <small className={s.code}>Room <b>{code}</b></small>}
      </div>
      <div className={s.actions}>
        {extra}
        <button className="btn btn-sm btn-ghost" onClick={() => setRules(true)} title="How to play">📖 <span className={s.hideSm}>Rules</span></button>
        <button
          className="btn btn-sm btn-ghost btn-icon"
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          onClick={() => { sound.setMuted(!muted); setMuted(!muted); if (muted) sound.play('card'); }}
        >
          <span className="emoji">{muted ? '🔇' : '🔊'}</span>
        </button>
        {onToggleSidebar && (
          <button className={`btn btn-sm btn-ghost btn-icon ${s.onlyMobile}`} onClick={onToggleSidebar} aria-label="Log and chat">💬</button>
        )}
        {code && <button className="btn btn-sm" onClick={() => setConfirmLeave(true)}>Leave</button>}
      </div>

      <RulesModal open={rules} onClose={() => setRules(false)} />
      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave the room?"
        subtitle="If a game is running you'll be counted as out and your cards are discarded."
        actions={<>
          <button className="btn" onClick={() => setConfirmLeave(false)}>Stay</button>
          <button className="btn btn-danger" onClick={() => { setConfirmLeave(false); leaveRoom(); }}>Leave</button>
        </>}
      />
    </header>
  );
}
