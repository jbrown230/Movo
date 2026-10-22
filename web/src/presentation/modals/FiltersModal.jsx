// Hoja "Filtros" de la pantalla de movimientos. A la vista quedan lo más usado (período y categoría);
// el banco y el monto se despliegan con "Más filtros".
// Edita un borrador: nada se aplica hasta tocar el botón de abajo, que dice cuántos movimientos quedan.

import { useMemo, useState } from 'react';
import { Dropdown } from '../components/Dropdown.jsx';
import { Field } from '../components/formControls.jsx';
import { Icon } from '../components/Icon.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { BANKS } from '../../domain/banks.js';
import { CATEGORIES } from '../../domain/categories.js';
import { useModal } from '../state/ModalProvider.jsx';
import {
  clearSheetFilters,
  countSheetFilters,
  datePresets,
  rangeWarnings,
  toSearchFilters,
} from '../state/movementFilters.js';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';

const CUSTOM_PERIOD = 'custom';
const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, { name }]) => ({ value, label: name }));
const BANK_OPTIONS = Object.entries(BANKS).map(([value, { name }]) => ({ value, label: name }));

/** Período: una lista con los atajos y "Personalizado", que muestra los dos campos de fecha. */
function PeriodFields({ draft, setDraft }) {
  const presets = useMemo(() => datePresets(), []);
  const matching = presets.find((preset) => draft.fromDay === preset.fromDay && draft.toDay === preset.toDay);
  // Si ya hay un rango que no es un atajo, se abre "Personalizado"; si no, el que coincide, o ninguno.
  const [isCustom, setIsCustom] = useState(Boolean(draft.fromDay || draft.toDay) && !matching);
  const selected = isCustom ? CUSTOM_PERIOD : (matching?.id ?? '');

  const choose = (value) => {
    const preset = presets.find((candidate) => candidate.id === value);
    setIsCustom(value === CUSTOM_PERIOD);
    if (value === CUSTOM_PERIOD) return;
    setDraft({ ...draft, fromDay: preset?.fromDay ?? '', toDay: preset?.toDay ?? '' });
  };
  const setDay = (name) => (event) => setDraft({ ...draft, [name]: event.target.value });

  return (
    <>
      <Dropdown
        id="filterPeriod"
        label="Período"
        value={selected}
        emptyLabel="Cualquier fecha"
        options={[
          ...presets.map(({ id, label }) => ({ value: id, label })),
          { value: CUSTOM_PERIOD, label: 'Personalizado' },
        ]}
        onChange={choose}
      />
      {selected === CUSTOM_PERIOD && (
        <div className="field-pair">
          <Field htmlFor="filterFromDay" label="Fecha desde">
            <input id="filterFromDay" type="date" value={draft.fromDay} onChange={setDay('fromDay')} />
          </Field>
          <Field htmlFor="filterToDay" label="Fecha hasta">
            <input id="filterToDay" type="date" value={draft.toDay} onChange={setDay('toDay')} />
          </Field>
        </div>
      )}
    </>
  );
}

function AmountField({ id, label, value, onChange }) {
  return (
    <Field htmlFor={id} label={label}>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
        inputMode="decimal"
        placeholder="₡"
        autoComplete="off"
      />
    </Field>
  );
}

/** Banco y monto, plegados detrás de "Más filtros" (se abren solos si ya hay uno puesto). */
function MoreFilters({ draft, setDraft, warnings }) {
  const hasValues = Boolean(draft.bank || draft.minAmountText || draft.maxAmountText);
  const [isOpen, setIsOpen] = useState(hasValues);
  const setField = (name) => (value) => setDraft({ ...draft, [name]: value });

  return (
    <>
      <button type="button" className="fmore" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        Más filtros
        <span className="fmore-hint">{isOpen || !hasValues ? 'Banco y monto' : 'Hay filtros puestos'}</span>
        <Icon name="chevron" />
      </button>
      {isOpen && (
        <div className="fmore-body">
          <Dropdown
            id="filterBank"
            label="Banco"
            value={draft.bank}
            emptyLabel="Todos"
            options={BANK_OPTIONS}
            onChange={setField('bank')}
          />
          <div className="field-pair">
            <AmountField
              id="filterMinAmount"
              label="Monto desde"
              value={draft.minAmountText}
              onChange={setField('minAmountText')}
            />
            <AmountField
              id="filterMaxAmount"
              label="Monto hasta"
              value={draft.maxAmountText}
              onChange={setField('maxAmountText')}
            />
          </div>
          {warnings.map((warning) => (
            <p className="hint filters-hint warn" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

/** "Ver 12 movimientos", "Ver 1 movimiento" o "Sin resultados". */
const applyLabel = (count) => {
  if (count === 0) return 'Sin resultados';
  return `Ver ${count} movimiento${count === 1 ? '' : 's'}`;
};

/** Cuántos movimientos quedarían con lo que hay en el borrador; se actualiza al cambiar cada filtro. */
function useResultCount(draft, hasWarnings) {
  const { services, dataVersion } = useSession();
  return useMemo(
    () => (hasWarnings ? 0 : services.queries.searchTransactions(toSearchFilters(draft)).length),
    // dataVersion hace que se cuente de nuevo después de cada cambio en los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, dataVersion, draft, hasWarnings],
  );
}

export function FiltersModal() {
  const { movementFilters, setMovementFilters } = useNavigation();
  const { closeModal } = useModal();
  const [draft, setDraft] = useState(movementFilters);
  const warnings = rangeWarnings(draft);
  const resultCount = useResultCount(draft, warnings.length > 0);

  const apply = () => {
    setMovementFilters(draft);
    closeModal();
  };

  return (
    <>
      <ModalHeader title="Filtros" />
      <div role="search" aria-label="Filtros de movimientos" className="fsheet">
        <PeriodFields draft={draft} setDraft={setDraft} />
        <Dropdown
          id="filterCategory"
          label="Categoría"
          value={draft.category}
          emptyLabel="Todas"
          options={CATEGORY_OPTIONS}
          onChange={(category) => setDraft({ ...draft, category })}
        />
        <MoreFilters draft={draft} setDraft={setDraft} warnings={warnings} />

        <div className="fsheet-foot">
          {countSheetFilters(draft) > 0 && (
            <button type="button" className="ghost" onClick={() => setDraft(clearSheetFilters(draft))}>
              Limpiar
            </button>
          )}
          <button type="button" className="cta" disabled={warnings.length > 0} onClick={apply}>
            {applyLabel(resultCount)}
          </button>
        </div>
      </div>
    </>
  );
}
