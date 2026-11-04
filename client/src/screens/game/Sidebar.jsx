import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Chat } from '../../components/Chat.jsx';
import { sound } from '../../lib/sound.js';
import s from './Sidebar.module.css';

export function Sidebar({ game, room, open, onClose }) {
  const [tab, setTab] = useState('log');
  const [seenChat, setSeenChat] = useState(room.chat.length);
  const logRef = useRef(null);
  const unread = tab === 'chat' ? 0 : Math.max(0, room.chat.length - seenChat);

  useEffect(() => {
    if (tab === 'chat') setSeenChat(room.chat.length);
  }, [tab, room.chat.length]);

  const lastChat = room.chat[room.chat.length - 1];
  useEffect(() => {
    if (lastChat?.playerId && tab !== 'chat') sound.play('chat');
  }, [lastChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [game.log.length, tab]);

  return (
    <>
      {open && <div className={s.scrim} onClick={onClose} aria-hidden="true" />}
      <aside className={`${s.sidebar} ${open ? s.open : ''}`}>
        <div className={s.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? s.on : ''} onClick={() => setTab('log')}>📜 Game log</button>
          <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? s.on : ''} onClick={() => setTab('chat')}>
            💬 Chat {unread > 0 && <span className={s.unread}>{unread}</span>}
          </button>
        </div>
        <div className={s.body}>
          {tab === 'log' ? (
            <div className={s.log} ref={logRef}>
              <AnimatePresence initial={false}>
                {game.log.map((e) => (
                  <motion.div
                    key={e.id}
                    className={`${s.entry} ${s[e.tone] ?? ''}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {e.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Chat chat={room.chat} players={room.players} />
          )}
        </div>
      </aside>
    </>
  );
}
