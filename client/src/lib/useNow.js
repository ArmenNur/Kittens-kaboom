import { useEffect, useState } from 'react';
import { serverNow } from './store.js';

/** Re-renders every `ms` while `active`, returning the current server time. */
export function useServerNow(active, ms = 250) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!active) return undefined;
    setNow(serverNow());
    const t = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
