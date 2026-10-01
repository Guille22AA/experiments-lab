// Bottom sheet (a panel that slides up from the bottom) for small forms.
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
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
