import { useEffect, useRef, useState } from 'react';
import { emit } from '../lib/store.js';
import { errorToast } from './Toasts.jsx';
import s from './Chat.module.css';

export function Chat({ chat, players }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const colorOf = (id) => players.find((p) => p.id === id)?.color;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const send = async (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    try { await emit('chat:send', { text: msg }); } catch (err) { errorToast(err.message); }
  };

  return (
    <div className={s.chat}>
      <div className={s.list} ref={listRef}>
        {chat.length === 0 && <div className={s.sys}>Say hi 👋</div>}
        {chat.map((m) => (m.playerId ? (
          <div key={m.id} className={s.msg}>
            <b style={{ color: colorOf(m.playerId) ?? m.color }}>{m.name}</b>: {m.text}
          </div>
        ) : (
          <div key={m.id} className={s.sys}>{m.text}</div>
        )))}
      </div>
      <form className={s.form} onSubmit={send}>
        <input className="input" value={text} maxLength={200} placeholder="Message…" onChange={(e) => setText(e.target.value)} aria-label="Chat message" />
        <button className="btn btn-sm" type="submit">Send</button>
      </form>
    </div>
  );
}
