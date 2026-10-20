// Exportar los movimientos de un rango de fechas a un archivo CSV para Excel.

import { useMemo, useState } from 'react';
import { Field, SegmentedControl } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { CsvSeparator } from '../../application/exportTransactions.js';
import { downloadTextFile } from '../../composition/platform.js';
import { toDayString } from '../../domain/period.js';
import { useModal } from '../state/ModalProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { useToast } from '../state/ToastProvider.jsx';

const SEPARATOR_OPTIONS = [
  { value: CsvSeparator.SEMICOLON, label: 'Punto y coma' },
  { value: CsvSeparator.COMMA, label: 'Coma' },
];

/** Por defecto, lo que va del mes. */
function thisMonth() {
  const today = new Date();
  return { fromDay: toDayString(new Date(today.getFullYear(), today.getMonth(), 1)), toDay: toDayString(today) };
}

/** La opción de Ajustes que abre la exportación. */
export function ExportSettings() {
  const { openModal } = useModal();
  return (
    <div className="group list">
      <button type="button" className="row" onClick={() => openModal(<ExportModal />)}>
        <span>Exportar movimientos a CSV</span>
      </button>
      <p className="hint">Para abrirlos en Excel o Google Sheets. El archivo se arma en este teléfono.</p>
    </div>
  );
}

export function ExportModal() {
  const { services } = useSession();
  const { closeModal } = useModal();
  const showToast = useToast();
  const [range, setRange] = useState(thisMonth);
  const [separator, setSeparator] = useState(CsvSeparator.SEMICOLON);

  const isBackwards = Boolean(range.fromDay && range.toDay && range.fromDay > range.toDay);
  const file = useMemo(() => services.exportTransactions({ ...range, separator }), [services, range, separator]);
  const setDay = (name) => (event) => setRange({ ...range, [name]: event.target.value });

  const download = () => {
    downloadTextFile(file.fileName, file.content);
    closeModal();
    showToast(`Se exportaron ${file.count} movimiento(s).`);
  };

  return (
    <>
      <ModalHeader title="Exportar movimientos" />
      <p className="meta">
        Descarga un archivo CSV con fecha, comercio, monto, moneda, categoría, tipo, medio y banco. Se abre en Excel o
        Google Sheets. Deja una fecha vacía para no poner límite.
      </p>
      <div className="field-pair">
        <Field htmlFor="exportFromDay" label="Desde">
          <input id="exportFromDay" type="date" value={range.fromDay} onChange={setDay('fromDay')} />
        </Field>
        <Field htmlFor="exportToDay" label="Hasta">
          <input id="exportToDay" type="date" value={range.toDay} onChange={setDay('toDay')} />
        </Field>
      </div>
      <SegmentedControl label="Separador" options={SEPARATOR_OPTIONS} value={separator} onChange={setSeparator} />
      <p className="meta">Punto y coma para Excel en español; coma para Excel en inglés y Google Sheets.</p>
      {isBackwards && <div className="notebox neg">La fecha de inicio es posterior a la fecha final.</div>}
      <button type="button" className="cta" disabled={isBackwards || file.count === 0} onClick={download}>
        {file.count === 0 ? 'No hay movimientos en esas fechas' : `Descargar ${file.count} movimiento(s)`}
      </button>
    </>
  );
}
