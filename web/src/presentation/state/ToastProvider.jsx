import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const TOAST_DURATION_MS = 3400;

const ToastContext = createContext(() => {});

/** Mensaje breve en la parte de abajo de la pantalla. Se usa con `useToast()`. */
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const hideTimer = useRef(null);

  const showToast = useCallback((text) => {
    setMessage(text);
    setIsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setIsVisible(false), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${isVisible ? ' on' : ''}`} role="status">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

/** @returns {(message: string) => void} */
export const useToast = () => useContext(ToastContext);
