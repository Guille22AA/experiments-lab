// Ways to take the list to the supermarket.
import { Copy, Download, Printer, Share2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { buildListText, canShare, copyText, downloadText, shareText } from '../../lib/exportList.js';
import Sheet from '../ui/Sheet.jsx';

export default function ExportSheet({ items, sections, onClose }) {
  const showToast = useToast();
  const text = buildListText(items, sections);

  async function attempt(action, okMessage) {
    try {
      await action();
      if (okMessage) showToast(okMessage);
      onClose();
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <Sheet title="Llevar la lista" onClose={onClose}>
      <pre className="export-preview">{text}</pre>
      <div className="export-actions">
        {canShare() && (
          <button type="button" className="button full" onClick={() => attempt(() => shareText(text))}>
            <Share2 size={18} aria-hidden="true" /> Compartir
          </button>
        )}
        <button type="button" className={`button full ${canShare() ? 'secondary' : ''}`} onClick={() => attempt(() => copyText(text), 'Lista copiada')}>
          <Copy size={18} aria-hidden="true" /> Copiar texto
        </button>
        <button
          type="button"
          className="button secondary full"
          onClick={() => attempt(() => downloadText(text, `lista-compra-${new Date().toLocaleDateString('sv-SE')}.txt`))}
        >
          <Download size={18} aria-hidden="true" /> Descargar .txt
        </button>
        <button
          type="button"
          className="button secondary full"
          onClick={() => {
            onClose();
            setTimeout(() => window.print(), 100); // let the sheet close first
          }}
        >
          <Printer size={18} aria-hidden="true" /> Imprimir o guardar en PDF
        </button>
      </div>
    </Sheet>
  );
}
