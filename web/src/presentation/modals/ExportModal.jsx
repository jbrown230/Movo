// Exportar a un archivo CSV para Excel los movimientos que se ven en la pantalla de movimientos,
// con los mismos filtros que la persona tiene puestos.

import { useMemo, useState } from 'react';
import { SegmentedControl } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { CsvSeparator } from '../../application/exportTransactions.js';
import { downloadTextFile } from '../../composition/platform.js';
import { useModal } from '../state/ModalProvider.jsx';
import { describeMovementFilters, toSearchFilters } from '../state/movementFilters.js';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const SEPARATOR_OPTIONS = [
  { value: CsvSeparator.SEMICOLON, label: 'Excel en español' },
  { value: CsvSeparator.COMMA, label: 'Google Sheets' },
];

export function ExportModal() {
  const { services } = useSession();
  const { movementFilters } = useNavigation();
  const { closeModal } = useModal();
  const showToast = useToast();
  const [separator, setSeparator] = useState(CsvSeparator.SEMICOLON);

  const filterLabels = describeMovementFilters(movementFilters);
  const file = useMemo(
    () => services.exportTransactions({ ...toSearchFilters(movementFilters), separator }),
    [services, movementFilters, separator],
  );

  const download = () => {
    downloadTextFile(file.fileName, file.content);
    closeModal();
    showToast(`Se exportaron ${file.count} movimiento(s).`);
  };

  return (
    <>
      <ModalHeader title="Exportar movimientos" />
      <div className="xsum">
        <b>
          {file.count} movimiento{file.count === 1 ? '' : 's'}
        </b>
        <span>{filterLabels.length ? 'con los filtros que tienes puestos' : 'todos tus movimientos'}</span>
        {filterLabels.length > 0 && (
          <ul className="xtags" aria-label="Filtros aplicados">
            {filterLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </div>
      <SegmentedControl label="Formato" options={SEPARATOR_OPTIONS} value={separator} onChange={setSeparator} />
      <p className="meta">
        Incluye fecha, comercio, monto, moneda, categoría, tipo, medio y banco. El archivo se arma en este teléfono.
      </p>
      <button type="button" className="cta" disabled={file.count === 0} onClick={download}>
        {file.count === 0 ? 'No hay movimientos para exportar' : 'Descargar CSV'}
      </button>
    </>
  );
}
