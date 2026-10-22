// Hoja "Filtros" de la pantalla de movimientos: fecha, categoría, banco y monto.
// Edita un borrador: nada se aplica hasta tocar el botón de abajo, que dice cuántos movimientos quedan.

import { useMemo, useState } from 'react';
import { Field } from '../components/formControls.jsx';
import { CategoryIcon } from '../components/Icon.jsx';
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

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const BANK_KEYS = Object.keys(BANKS);
const CATEGORY_ICON_SIZE = 22;

/** Una pastilla que se enciende al tocarla y se apaga al tocarla otra vez. */
function Pill({ label, isOn, onToggle, icon = null }) {
  return (
    <button type="button" className="fchip" aria-pressed={isOn} onClick={onToggle}>
      {icon}
      {label}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="fsec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Pastillas de una lista de opciones; tocar la que está encendida quita el filtro. */
function PillGroup({ label, options, selected, onSelect }) {
  return (
    <div className="fchips" role="group" aria-label={label}>
      {options.map((option) => (
        <Pill
          key={option.value}
          label={option.label}
          icon={option.icon}
          isOn={selected === option.value}
          onToggle={() => onSelect(selected === option.value ? '' : option.value)}
        />
      ))}
    </div>
  );
}

const CATEGORY_OPTIONS = CATEGORY_KEYS.map((key) => ({
  value: key,
  label: CATEGORIES[key].name,
  icon: <CategoryIcon category={key} size={CATEGORY_ICON_SIZE} />,
}));
const BANK_OPTIONS = BANK_KEYS.map((key) => ({ value: key, label: BANKS[key].name }));

function DateSection({ draft, setDraft }) {
  const presets = useMemo(() => datePresets(), []);
  const isOn = (preset) => draft.fromDay === preset.fromDay && draft.toDay === preset.toDay;
  const togglePreset = (preset) =>
    setDraft({ ...draft, fromDay: isOn(preset) ? '' : preset.fromDay, toDay: isOn(preset) ? '' : preset.toDay });
  const setDay = (name) => (event) => setDraft({ ...draft, [name]: event.target.value });

  return (
    <Section title="Fecha">
      <div className="fchips" role="group" aria-label="Período">
        {presets.map((preset) => (
          <Pill key={preset.id} label={preset.label} isOn={isOn(preset)} onToggle={() => togglePreset(preset)} />
        ))}
      </div>
      <div className="field-pair">
        <Field htmlFor="filterFromDay" label="Fecha desde">
          <input id="filterFromDay" type="date" value={draft.fromDay} onChange={setDay('fromDay')} />
        </Field>
        <Field htmlFor="filterToDay" label="Fecha hasta">
          <input id="filterToDay" type="date" value={draft.toDay} onChange={setDay('toDay')} />
        </Field>
      </div>
    </Section>
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

function AmountSection({ draft, setDraft, warnings }) {
  const setAmount = (name) => (value) => setDraft({ ...draft, [name]: value });
  return (
    <Section title="Monto">
      <div className="field-pair">
        <AmountField
          id="filterMinAmount"
          label="Monto desde"
          value={draft.minAmountText}
          onChange={setAmount('minAmountText')}
        />
        <AmountField
          id="filterMaxAmount"
          label="Monto hasta"
          value={draft.maxAmountText}
          onChange={setAmount('maxAmountText')}
        />
      </div>
      <p className="hint filters-hint">Montos en colones. Llena solo uno para buscar mayores o menores.</p>
      {warnings.map((warning) => (
        <p className="hint filters-hint warn" key={warning}>
          {warning}
        </p>
      ))}
    </Section>
  );
}

/** "Ver 12 movimientos", "Ver 1 movimiento" o "Sin resultados". */
const applyLabel = (count) => {
  if (count === 0) return 'Sin resultados';
  return `Ver ${count} movimiento${count === 1 ? '' : 's'}`;
};

/** Cuántos movimientos quedarían con lo que hay en el borrador; se actualiza al tocar cada filtro. */
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
  const setField = (name) => (value) => setDraft({ ...draft, [name]: value });

  const apply = () => {
    setMovementFilters(draft);
    closeModal();
  };

  return (
    <>
      <ModalHeader title="Filtros" />
      <div role="search" aria-label="Filtros de movimientos" className="fsheet">
        <DateSection draft={draft} setDraft={setDraft} />
        <Section title="Categoría">
          <PillGroup
            label="Categoría"
            options={CATEGORY_OPTIONS}
            selected={draft.category}
            onSelect={setField('category')}
          />
        </Section>
        <Section title="Banco">
          <PillGroup label="Banco" options={BANK_OPTIONS} selected={draft.bank} onSelect={setField('bank')} />
        </Section>
        <AmountSection draft={draft} setDraft={setDraft} warnings={warnings} />

        <div className="fsheet-foot">
          {countSheetFilters(draft) > 0 && (
            <button type="button" className="link" onClick={() => setDraft(clearSheetFilters(draft))}>
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
