import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import s from './BoomOverlay.module.css';

export function BoomOverlay({ boom, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!boom) return undefined;
    const t = setTimeout(() => doneRef.current(), 2100);
    return () => clearTimeout(t);
  }, [boom]);

  return (
    <AnimatePresence>
      {boom && (
        <motion.div
          key={boom.key}
          className={`${s.overlay} ${boom.defused ? s.defused : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          <motion.div
            className={s.inner}
            initial={{ scale: 0.2, rotate: -8 }}
            animate={{ scale: [0.2, 1.2, 1], rotate: [-8, 4, 0] }}
            transition={{ duration: 0.55, times: [0, 0.6, 1] }}
          >
            <motion.div
              className={`${s.emoji} emoji`}
              animate={{ rotate: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 0.35 }}
            >
              {boom.defused ? '🧯' : '💥'}
            </motion.div>
            <div className={s.word}>{boom.defused ? 'DEFUSED!' : 'KABOOM!'}</div>
            <div className={s.sub}>
              {boom.isMe
                ? (boom.defused ? 'Phew! You survived… this time.' : 'You exploded! 💀')
                : (boom.defused ? `${boom.name} survived… this time.` : `${boom.name} exploded!`)}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
