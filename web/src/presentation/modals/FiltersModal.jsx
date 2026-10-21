// Hoja "Filtros" de la pantalla de movimientos: fecha, categoría, banco y monto.
// Edita un borrador: nada se aplica hasta tocar "Aplicar".

import { useState } from 'react';
import { Field } from '../components/formControls.jsx';
import { ModalHeader } from '../components/ModalHeader.jsx';
import { BANKS } from '../../domain/banks.js';
import { CATEGORIES } from '../../domain/categories.js';
import { clearSheetFilters, rangeWarnings } from '../state/movementFilters.js';
import { useModal } from '../state/ModalProvider.jsx';
import { useNavigation } from '../state/NavigationProvider.jsx';

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, { name }]) => ({ value, label: name }));
const BANK_OPTIONS = Object.entries(BANKS).map(([value, { name }]) => ({ value, label: name }));

/** Lista desplegable con una primera opción "Todos" que quita el filtro. */
function SelectField({ id, label, value, options, onChange }) {
  return (
    <Field htmlFor={id} label={label}>
      <select id={id} value={value} onChange={onChange}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function AmountField({ id, label, value, onChange }) {
  return (
    <Field htmlFor={id} label={label}>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange({ target: { value: event.target.value.replace(/[^\d.,]/g, '') } })}
        inputMode="decimal"
        placeholder="₡"
        autoComplete="off"
      />
    </Field>
  );
}

export function FiltersModal() {
  const { movementFilters, setMovementFilters } = useNavigation();
  const { closeModal } = useModal();
  const [draft, setDraft] = useState(movementFilters);
  const warnings = rangeWarnings(draft);
  const setField = (name) => (event) => setDraft({ ...draft, [name]: event.target.value });

  const apply = () => {
    setMovementFilters(draft);
    closeModal();
  };

  return (
    <>
      <ModalHeader title="Filtros" />
      <div role="search" aria-label="Filtros de movimientos">
        <div className="field-pair">
          <Field htmlFor="filterFromDay" label="Fecha desde">
            <input id="filterFromDay" type="date" value={draft.fromDay} onChange={setField('fromDay')} />
          </Field>
          <Field htmlFor="filterToDay" label="Fecha hasta">
            <input id="filterToDay" type="date" value={draft.toDay} onChange={setField('toDay')} />
          </Field>
        </div>
        <SelectField
          id="filterCategory"
          label="Categoría"
          value={draft.category}
          options={CATEGORY_OPTIONS}
          onChange={setField('category')}
        />
        <SelectField
          id="filterBank"
          label="Banco"
          value={draft.bank}
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
        <p className="hint filters-hint">
          Montos en colones. Llena solo uno para buscar montos mayores o menores a ese valor.
        </p>
        {warnings.map((warning) => (
          <p className="hint filters-hint warn" key={warning}>
            {warning}
          </p>
        ))}
        <button type="button" className="cta" disabled={warnings.length > 0} onClick={apply}>
          Aplicar
        </button>
        <button type="button" className="ghost" onClick={() => setDraft(clearSheetFilters(draft))}>
          Limpiar
        </button>
      </div>
    </>
  );
}
