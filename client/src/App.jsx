import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppState, onGameEvent } from './lib/store.js';
import { Home } from './screens/Home.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { Game } from './screens/game/Game.jsx';
import { Toasts, toast } from './components/Toasts.jsx';

export default function App() {
  const { room, game, connected } = useAppState();

  useEffect(() => onGameEvent((ev) => {
    if (ev.type === 'kicked') toast(`👋 ${ev.reason}`, { kind: 'err', ms: 5000 });
  }), []);

  const screen = !room ? 'home' : game ? 'game' : 'lobby';

  return (
    <>
      {!connected && <div className="conn-banner" style={banner}>Connecting to server…</div>}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ height: '100%' }}
        >
          {screen === 'home' && <Home />}
          {screen === 'lobby' && <Lobby />}
          {screen === 'game' && <Game />}
        </motion.div>
      </AnimatePresence>
      <Toasts />
    </>
  );
}

const banner = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#7a2c3a',
  textAlign: 'center', padding: 6, fontWeight: 600, fontSize: 14,
};
