// Text box + send button. Enter sends, Shift+Enter makes a new line.
import { SendHorizontal } from 'lucide-react';
import { useState } from 'react';

export default function Composer({ onSend, disabled = false, placeholder = 'Escribe un mensaje…' }) {
  const [text, setText] = useState('');

  function send() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor="composer-input" className="visually-hidden">
        Mensaje
      </label>
      <textarea
        id="composer-input"
        rows={1}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={2000}
      />
      <button type="submit" className="send" disabled={disabled || !text.trim()} aria-label="Enviar">
        <SendHorizontal size={22} aria-hidden="true" />
      </button>
    </form>
  );
}
