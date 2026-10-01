// When the assistant changes data (an accepted card, an undo), the screen
// underneath must refresh. The chat announces it with a window event and the
// pages listen with this hook.
import { useEffect } from 'react';

const EVENT = 'app-data-changed';

export const announceDataChanged = () => window.dispatchEvent(new Event(EVENT));

/** Calls `reload` every time some data changed elsewhere. */
export function useDataChanged(reload) {
  useEffect(() => {
    window.addEventListener(EVENT, reload);
    return () => window.removeEventListener(EVENT, reload);
  }, [reload]);
}
