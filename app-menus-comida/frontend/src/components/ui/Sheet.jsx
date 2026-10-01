// Bottom sheet (a panel that slides up from the bottom) for small forms.
import { X } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus.js';

export default function Sheet({ title, onClose, children }) {
  const dialogRef = useDialogFocus(onClose);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
