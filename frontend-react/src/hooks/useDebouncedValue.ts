import { useEffect, useState } from 'react';

/** Classic debounce hook: re-renders with the latest value only after it stops changing. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id); // cancel on change/unmount — no stale timers
  }, [value, delayMs]);

  return debounced;
}
