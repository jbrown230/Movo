import { useCallback } from 'react';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { useModal } from '../state/ModalProvider.jsx';

function ConfirmModal({ title, text, confirmLabel, onConfirm, onCancel, danger = true }) {
  const { closeModal } = useModal();
  const confirm = async () => {
    closeModal();
    await onConfirm();
  };
  return (
    <>
      <ModalHeader title={title} />
      <p className="meta">{text}</p>
      <button type="button" className={danger ? 'cta danger' : 'cta'} onClick={confirm}>
        {confirmLabel}
      </button>
      <button type="button" className="ghost" onClick={onCancel ?? closeModal}>
        Cancelar
      </button>
    </>
  );
}

/**
 * Pide confirmación antes de una acción que cambia o borra datos:
 *   const confirm = useConfirm();
 *   confirm({ title, text, confirmLabel, onConfirm: () => ... });
 *
 * - `danger: false` muestra el botón con el color normal (cambios que no borran nada).
 * - `onCancel` decide qué pasa al cancelar; por ejemplo, volver a la hoja de donde se vino.
 *   Sin él, cancelar solo cierra el diálogo.
 */
export function useConfirm() {
  const { openModal } = useModal();
  return useCallback((options) => openModal(<ConfirmModal {...options} />), [openModal]);
}
