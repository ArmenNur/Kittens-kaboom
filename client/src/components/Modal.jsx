import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import s from './Modal.module.css';

/** Animated modal. Pass `open` and wrap usage so AnimatePresence can run exit animations. */
export function Modal({ open, onClose, title, subtitle, wide = false, children, actions, dismissable = true }) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={s.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            className={`panel ${s.modal} ${wide ? s.wide : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            {title && <h2 className={s.title}>{title}</h2>}
            {subtitle && <p className={s.sub}>{subtitle}</p>}
            {children}
            {actions && <div className={s.actions}>{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
