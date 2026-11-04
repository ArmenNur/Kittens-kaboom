import s from './Avatar.module.css';

export function Avatar({ player, size = 38, glow = false, dead = false }) {
  if (!player) return null;
  return (
    <div
      className={`${s.avatar} ${glow ? s.glow : ''} emoji`}
      style={{ '--pc': player.color, width: size, height: size, fontSize: size * 0.58 }}
      aria-hidden="true"
    >
      {player.avatar}
      {dead && <span className={s.skull}>💀</span>}
    </div>
  );
}
