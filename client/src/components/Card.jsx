import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CARD_TYPES } from '@shared/cards.js';
import s from './Card.module.css';

const GROUP_CLASS = { kaboom: s.gKaboom, defuse: s.gDefuse };

/**
 * A playing card (face or back). It's a motion.div, so callers can pass any
 * framer-motion props (layout, initial, animate, whileHover, exit…).
 */
export const Card = forwardRef(function Card(
  { type, size = 'md', selected = false, dim = false, disabled = false, interactive = false, className = '', style, ...motionProps },
  ref,
) {
  const classes = [
    s.card, s[size],
    selected && s.selected, dim && s.dim, disabled && s.disabled, interactive && s.interactive,
    className,
  ];

  if (type === 'back') {
    return <motion.div ref={ref} className={[...classes, s.back].filter(Boolean).join(' ')} style={style} aria-label="Face-down card" {...motionProps} />;
  }

  const t = CARD_TYPES[type];
  if (!t) return null;
  return (
    <motion.div
      ref={ref}
      className={[...classes, GROUP_CLASS[t.group]].filter(Boolean).join(' ')}
      style={{ '--c1': t.colors[0], '--c2': t.colors[1], '--accent': t.accent, ...style }}
      title={`${t.name} — ${t.desc}`}
      role="img"
      aria-label={t.name}
      data-type={type}
      {...motionProps}
    >
      <div className={s.inner}>
        <span className={`${s.corner} emoji`}>{t.icon}</span>
        <span className={`${s.cornerBr} emoji`}>{t.icon}</span>
        <div className={s.title}>{t.name}</div>
        <div className={s.art}>
          <span className={`${s.artMain} emoji`}>{t.art}</span>
          <span className={`${s.artSub} emoji`}>{t.icon}</span>
        </div>
        <div className={s.desc}>{t.desc}</div>
        <div className={s.flavor}>“{t.flavor}”</div>
      </div>
    </motion.div>
  );
});
