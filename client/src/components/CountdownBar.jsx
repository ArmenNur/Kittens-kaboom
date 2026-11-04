import { motion } from 'framer-motion';
import { serverNow } from '../lib/store.js';
import s from './CountdownBar.module.css';

/**
 * Linear bar that drains until `expiresAt` (server clock). Keyed on expiresAt so a
 * restarted window (e.g. after a Nope) animates from full again.
 */
export function CountdownBar({ expiresAt, totalMs, width = 220, tone = 'hot' }) {
  if (!expiresAt) return null;
  const remaining = Math.max(0, expiresAt - serverNow());
  const frac = Math.min(1, remaining / totalMs);
  return (
    <div className={s.track} style={{ width }}>
      <motion.span
        key={expiresAt}
        className={`${s.fill} ${s[tone]}`}
        initial={{ width: `${frac * 100}%` }}
        animate={{ width: '0%' }}
        transition={{ duration: remaining / 1000, ease: 'linear' }}
      />
    </div>
  );
}
