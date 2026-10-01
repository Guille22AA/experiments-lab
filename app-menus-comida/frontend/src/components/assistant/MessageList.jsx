// List of chat bubbles, shared by the assistant panel and the onboarding interview.
import { Fragment, useEffect, useRef } from 'react';

/**
 * @param {{ messages: {id, role, content}[], pending?: boolean, error?: string|null,
 *           renderAfter?: (message) => React.ReactNode }} props
 * role can be 'user', 'assistant' or 'error'. `renderAfter` adds things under a
 * message (the assistant's confirmation cards).
 */
export default function MessageList({ messages, pending = false, error = null, renderAfter }) {
  const endRef = useRef(null);

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, pending, error]);

  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <Fragment key={message.id}>
          <div className={`message ${message.role}`}>{message.content}</div>
          {renderAfter?.(message)}
        </Fragment>
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
