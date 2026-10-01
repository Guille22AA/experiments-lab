// Short messages at the bottom of the screen ("Quitado. [Deshacer]").
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);
const DURATION_MS = 5000;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { text, actionLabel?, onAction? }
  const timer = useRef(null);

  const showToast = useCallback((text, { actionLabel, onAction } = {}) => {
    clearTimeout(timer.current);
    setToast({ text, actionLabel, onAction });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  function runAction() {
    clearTimeout(timer.current);
    toast.onAction();
    setToast(null);
  }

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.text}</span>
            {toast.actionLabel && (
              <button type="button" onClick={runAction}>
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
