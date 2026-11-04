// Imperative particle bursts (Web Animations API) — cheaper than mounting React nodes per particle.
function root() {
  let el = document.getElementById('fx-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-root';
    Object.assign(el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '85' });
    document.body.appendChild(el);
  }
  return el;
}

export function burst(x, y, colors, count = 60) {
  const host = root();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed', left: `${x}px`, top: `${y}px`, width: '10px', height: '10px',
      borderRadius: Math.random() < 0.5 ? '50%' : '2px', background: colors[i % colors.length],
    });
    host.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 380;
    p.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 160}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 900, easing: 'cubic-bezier(.15,.7,.4,1)' }).onfinish = () => p.remove();
  }
}

export function confetti() {
  const colors = ['#ff4d6d', '#ffb020', '#2fd17e', '#3d8bff', '#9b5cff', '#ff6fb5'];
  for (let i = 0; i < 4; i++) {
    setTimeout(() => burst(window.innerWidth * (0.2 + 0.2 * i), window.innerHeight * 0.3, colors, 50), i * 250);
  }
}

export function explosion(defused) {
  burst(window.innerWidth / 2, window.innerHeight / 2,
    defused ? ['#2fd17e', '#b7ffd6', '#ffffff'] : ['#ff3b3b', '#ffb020', '#ff7a1a', '#222222'],
    defused ? 40 : 90);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
  return Promise.resolve();
}
