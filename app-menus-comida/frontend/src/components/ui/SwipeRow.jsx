// A row you can swipe to the left to delete (familiar mobile pattern).
// Deleting is also possible from the item's detail sheet, for mouse/keyboard users.
import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

const DELETE_THRESHOLD_PX = 110;

export default function SwipeRow({ onDelete, children }) {
  const [offset, setOffset] = useState(0);
  const start = useRef(null); // { x, y } where the touch began
  const dragging = useRef(false);

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse') return; // swiping is for touch
    start.current = { x: event.clientX, y: event.clientY };
    dragging.current = false;
  }

  function handlePointerMove(event) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    // Only a mostly-horizontal move counts as a swipe; otherwise the user is scrolling.
    if (!dragging.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) dragging.current = true;
    if (dragging.current) setOffset(Math.min(0, dx));
  }

  function handlePointerUp() {
    if (dragging.current && offset < -DELETE_THRESHOLD_PX) onDelete();
    start.current = null;
    dragging.current = false;
    setOffset(0);
  }

  return (
    <div className="swipe-row">
      <div className="swipe-row-delete" aria-hidden="true">
        <Trash2 size={20} /> Quitar
      </div>
      <div
        className="swipe-row-content"
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.2s' : 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
