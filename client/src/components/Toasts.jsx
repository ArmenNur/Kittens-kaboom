import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { sound } from '../lib/sound.js';
import s from './Toasts.module.css';

let toasts = [];
let nextId = 1;
const listeners = new Set();
const notify = () => { for (const l of listeners) l(); };

/** content may be a string or a React node */
export function toast(content, { kind = 'info', ms = 3200 } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, content, kind }].slice(-4);
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, ms);
}

export function errorToast(message) {
  toast(`⚠️ ${message}`, { kind: 'err' });
  sound.play('error');
}

export function Toasts() {
  const list = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
  );
  return (
    <div className={s.root} aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`${s.toast} ${t.kind === 'err' ? s.err : ''} ${t.kind === 'good' ? s.good : ''}`}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {t.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
