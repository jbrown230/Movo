import { useCallback } from 'react';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { useModal } from '../state/ModalProvider.jsx';

function ConfirmModal({ title, text, confirmLabel, onConfirm }) {
  const { closeModal } = useModal();
  const confirm = async () => {
    closeModal();
    await onConfirm();
  };
  return (
    <>
      <ModalHeader title={title} />
      <p className="meta">{text}</p>
      <button type="button" className="cta danger" onClick={confirm}>
        {confirmLabel}
      </button>
      <button type="button" className="ghost" onClick={closeModal}>
        Cancelar
      </button>
    </>
  );
}

/**
 * Pide confirmación antes de una acción delicada:
 *   const confirm = useConfirm();
 *   confirm({ title, text, confirmLabel, onConfirm: () => ... });
 */
export function useConfirm() {
  const { openModal } = useModal();
  return useCallback((options) => openModal(<ConfirmModal {...options} />), [openModal]);
}
