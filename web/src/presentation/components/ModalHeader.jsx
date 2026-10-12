import { Icon } from './Icon.jsx';
import { useModal } from '../state/ModalProvider.jsx';

/** Título de una hoja (modal) con su botón de cerrar. */
export function ModalHeader({ title }) {
  const { closeModal } = useModal();
  return (
    <div className="mh">
      <h2 id="modalTitle">{title}</h2>
      <button type="button" className="close" aria-label="Cerrar" onClick={closeModal}><Icon name="close" /></button>
    </div>
  );
}
