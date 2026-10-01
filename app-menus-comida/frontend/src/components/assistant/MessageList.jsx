// List of chat bubbles, shared by the assistant panel and the onboarding interview.
import { useEffect, useRef } from 'react';

/**
 * @param {{ messages: {id, role, content}[], pending?: boolean, error?: string|null }} props
 * role can be 'user', 'assistant' or 'error'.
 */
export default function MessageList({ messages, pending = false, error = null }) {
  const endRef = useRef(null);

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, pending, error]);

  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
          {message.content}
        </div>
      ))}
      {pending && <div className="message assistant pending">Escribiendo…</div>}
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
