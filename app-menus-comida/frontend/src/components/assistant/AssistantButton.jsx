import { MessageCircle } from 'lucide-react';

/** Floating button that opens the assistant from any screen. */
export default function AssistantButton({ onClick }) {
  return (
    <button className="fab" onClick={onClick} aria-label="Abrir asistente">
      <MessageCircle size={28} aria-hidden="true" />
    </button>
  );
}
