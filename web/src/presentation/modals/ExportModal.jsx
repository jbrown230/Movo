// Exportar los movimientos que se ven en la pantalla de movimientos (con los mismos filtros) a un Excel con la
// apariencia de Movo, o a un CSV sencillo.

import { useMemo, useState } from 'react';
import { SegmentedControl } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { CsvSeparator, ExportFormat } from '../../application/exportTransactions.js';
import { downloadTextFile } from '../../composition/platform.js';
import { useModal } from '../state/ModalProvider.jsx';
import { describeMovementFilters, toSearchFilters } from '../state/movementFilters.js';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const FORMAT_OPTIONS = [
  { value: ExportFormat.XLSX, label: 'Excel' },
  { value: ExportFormat.CSV, label: 'CSV' },
];
const SEPARATOR_OPTIONS = [
  { value: CsvSeparator.SEMICOLON, label: 'Excel en español' },
  { value: CsvSeparator.COMMA, label: 'Google Sheets' },
];

const FORMAT_HINT = {
  [ExportFormat.XLSX]:
    'Un libro con el diseño de Movo y los totales arriba: gastos, ingresos y balance. Abre en Excel, Google Sheets y Numbers.',
  [ExportFormat.CSV]: 'Texto simple, sin diseño ni totales. Elige el separador según el programa donde lo vas a abrir.',
};

export function ExportModal() {
  const { services } = useSession();
  const { movementFilters } = useNavigation();
  const { closeModal } = useModal();
  const showToast = useToast();
  const [format, setFormat] = useState(ExportFormat.XLSX);
  const [separator, setSeparator] = useState(CsvSeparator.SEMICOLON);

  const filterLabels = describeMovementFilters(movementFilters);
  const file = useMemo(
    () => services.exportTransactions({ ...toSearchFilters(movementFilters), format, separator, filterLabels }),
    // filterLabels sale de movementFilters: basta con vigilar los filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, movementFilters, format, separator],
  );

  const download = () => {
    downloadTextFile(file.fileName, file.content, file.mimeType);
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
      <SegmentedControl label="Formato del archivo" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
      {format === ExportFormat.CSV && (
        <SegmentedControl label="Separador" options={SEPARATOR_OPTIONS} value={separator} onChange={setSeparator} />
      )}
      <p className="meta">{FORMAT_HINT[format]}</p>
      <button type="button" className="cta" disabled={file.count === 0} onClick={download}>
        {file.count === 0
          ? 'No hay movimientos para exportar'
          : `Descargar ${format === ExportFormat.XLSX ? 'Excel' : 'CSV'}`}
      </button>
    </>
  );
}
