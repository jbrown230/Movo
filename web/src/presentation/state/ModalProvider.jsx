import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const SLIDE_IN_DELAY_MS = 280;

const ModalContext = createContext(null);

/**
 * Estado de la hoja (modal) que sube desde abajo. Se usa con `useModal()`:
 *   const { openModal, closeModal } = useModal();
 *   openModal(<MiContenido />);
 *
 * Este proveedor solo guarda el estado. Lo que se dibuja es <ModalSheet />, que debe
 * colocarse DENTRO de todos los proveedores que el contenido de la hoja necesite.
 */
export function ModalProvider({ children }) {
  const [content, setContent] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0); // cambia en cada apertura para reiniciar el estado del contenido
  const focusBeforeOpen = useRef(null);

  const openModal = useCallback((element) => {
    focusBeforeOpen.current = document.activeElement;
    setContent(element);
    setOpenCount((count) => count + 1);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    focusBeforeOpen.current?.focus?.();
  }, []);

  const value = useMemo(
    () => ({ openModal, closeModal, content, isOpen, openCount }),
    [openModal, closeModal, content, isOpen, openCount],
  );
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModal() {
  const value = useContext(ModalContext);
  if (!value) throw new Error('useModal debe usarse dentro de <ModalProvider>');
  return value;
}

/**
 * La hoja en sí: fondo oscuro y panel. El contenido se queda montado mientras la hoja baja,
 * para que la animación de salida se vea completa.
 */
export function ModalSheet() {
  const { content, isOpen, openCount, closeModal } = useModal();
  const sheetRef = useRef(null);

  // Al abrir, el foco va al campo marcado con data-autofocus (o al primer botón o campo),
  // salvo que la persona ya haya tocado algo dentro de la hoja.
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      if (sheetRef.current?.contains(document.activeElement)) return;
      const target =
        sheetRef.current?.querySelector('[data-autofocus]') ||
        sheetRef.current?.querySelector('button, input, textarea');
      target?.focus();
    }, SLIDE_IN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen, openCount]);

  // Escape cierra la hoja.
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, closeModal]);

  return (
    <>
      <div className={`scrim${isOpen ? ' on' : ''}`} onClick={closeModal} />
      <div
        ref={sheetRef}
        className={`modal${isOpen ? ' on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="grab" />
        {content && <div key={openCount}>{content}</div>}
      </div>
    </>
  );
}
