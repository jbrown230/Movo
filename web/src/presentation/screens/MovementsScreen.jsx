// Vista de movimientos: la lista completa con filtros. Los filtros se conservan al cambiar de pestaña.

import { useEffect, useMemo, useState } from 'react';
import { Field } from '../components/formControls.jsx';
import { Icon } from '../components/Icon.jsx';
import { TransactionList } from '../components/TransactionList.jsx';
import { BANKS } from '../../domain/banks.js';
import { CATEGORIES } from '../../domain/categories.js';
import { Direction } from '../../domain/types.js';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';
import { NO_MOVEMENT_FILTERS, countActiveFilters, rangeWarnings, toSearchFilters } from '../state/movementFilters.js';

const DIRECTION_OPTIONS = [
  { value: Direction.EXPENSE, label: 'Gasto' },
  { value: Direction.INCOME, label: 'Ingreso' },
  { value: Direction.OWN_TRANSFER, label: 'Entre mis cuentas' },
];
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

/** Los campos de los filtros. Editan un borrador: nada se aplica hasta tocar "Aplicar". */
function FilterFields({ filters, setFilters }) {
  const setField = (name) => (event) => setFilters({ ...filters, [name]: event.target.value });

  return (
    <>
      <div className="field-pair">
        <Field htmlFor="filterFromDay" label="Fecha desde">
          <input id="filterFromDay" type="date" value={filters.fromDay} onChange={setField('fromDay')} />
        </Field>
        <Field htmlFor="filterToDay" label="Fecha hasta">
          <input id="filterToDay" type="date" value={filters.toDay} onChange={setField('toDay')} />
        </Field>
      </div>
      <SelectField
        id="filterCategory"
        label="Categoría"
        value={filters.category}
        options={CATEGORY_OPTIONS}
        onChange={setField('category')}
      />
      <div className="field-pair">
        <SelectField
          id="filterDirection"
          label="Tipo"
          value={filters.direction}
          options={DIRECTION_OPTIONS}
          onChange={setField('direction')}
        />
        <SelectField
          id="filterBank"
          label="Banco"
          value={filters.bank}
          options={BANK_OPTIONS}
          onChange={setField('bank')}
        />
      </div>
      <div className="field-pair">
        <AmountField
          id="filterMinAmount"
          label="Monto desde"
          value={filters.minAmountText}
          onChange={setField('minAmountText')}
        />
        <AmountField
          id="filterMaxAmount"
          label="Monto hasta"
          value={filters.maxAmountText}
          onChange={setField('maxAmountText')}
        />
      </div>
      <p className="hint">Montos en colones. Llena solo uno para buscar montos mayores o menores a ese valor.</p>
    </>
  );
}

/** Lo que dura la animación de abrir o cerrar el panel (debe coincidir con `.filters-collapse` en app.css). */
const PANEL_ANIMATION_MS = 220;

/**
 * Si el panel debe estar en pantalla: aparece al abrirlo y, al cerrarlo, se queda lo que dura la animación
 * de cierre. Se usa un temporizador y no el fin de la animación porque, con "reducir movimiento", no hay animación.
 */
function useStaysWhileClosing(isOpen) {
  const [isShown, setIsShown] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setIsShown(true);
      return undefined;
    }
    const timer = setTimeout(() => setIsShown(false), PANEL_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);
  return isOpen || isShown;
}

/** El panel con los campos, "Aplicar" y "Limpiar". Se despliega hacia abajo al abrir y se recoge al cerrar. */
function FiltersPanel({ isOpen, draft, setDraft, onApply }) {
  const warnings = rangeWarnings(draft);
  return (
    <div className={`filters-collapse${isOpen ? '' : ' closing'}`}>
      <div className="filters-collapse-inner">
        <div id="movementFiltersPanel" className="group filters" role="search" aria-label="Filtros de movimientos">
          <FilterFields filters={draft} setFilters={setDraft} />
          {warnings.map((warning) => (
            <p className="hint warn" key={warning}>
              {warning}
            </p>
          ))}
          <button type="button" className="cta" disabled={warnings.length > 0} onClick={onApply}>
            Aplicar
          </button>
          <button type="button" className="ghost" onClick={() => setDraft(NO_MOVEMENT_FILTERS)}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Botón "Filtros" que abre un panel, como en las tiendas en línea. Lo que se elige en el panel
 * se aplica al tocar "Aplicar"; "Limpiar" vacía el panel sin aplicar todavía.
 */
function MovementFilters({ filters, setFilters, panelRequest }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  // Otra pantalla pidió llegar con el panel abierto (por ejemplo, "Ver las categorías" del inicio).
  useEffect(() => {
    if (!panelRequest) return;
    setDraft(filters);
    setIsOpen(true);
    // Solo cuando llega un pedido nuevo; `filters` ya viene con lo que se pidió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRequest]);
  const activeCount = countActiveFilters(filters);
  const isPanelShown = useStaysWhileClosing(isOpen);

  const toggle = () => {
    if (!isOpen) setDraft(filters); // al abrir, el panel muestra lo que está aplicado
    setIsOpen(!isOpen);
  };
  const apply = () => {
    setFilters(draft);
    setIsOpen(false);
  };

  return (
    <div className="filters-bar">
      <div className="filters-head">
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={isOpen}
          aria-controls="movementFiltersPanel"
          onClick={toggle}
        >
          <Icon name="filter" />
          Filtros{activeCount ? ` (${activeCount})` : ''}
          <span className="chevron">
            <Icon name="chevron" />
          </span>
        </button>
        {activeCount > 0 && !isOpen && (
          <button type="button" className="link" onClick={() => setFilters(NO_MOVEMENT_FILTERS)}>
            Quitar filtros
          </button>
        )}
      </div>
      {isPanelShown && <FiltersPanel isOpen={isOpen} draft={draft} setDraft={setDraft} onApply={apply} />}
    </div>
  );
}

export function MovementsScreen() {
  const { services, dataVersion } = useSession();
  const { movementFilters, setMovementFilters, filtersPanelRequest } = useNavigation();

  const transactions = useMemo(
    () => services.queries.searchTransactions(toSearchFilters(movementFilters)),
    // dataVersion hace que se busque de nuevo después de cada cambio en los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, dataVersion, movementFilters],
  );
  const isFiltered = countActiveFilters(movementFilters) > 0;

  return (
    <section aria-label="Movimientos">
      <div className="ihead">
        <h1>Movimientos</h1>
        <p>
          {transactions.length} {transactions.length === 1 ? 'movimiento' : 'movimientos'}
          {isFiltered ? ' con estos filtros' : ''}
        </p>
      </div>
      <div className="settings">
        <MovementFilters filters={movementFilters} setFilters={setMovementFilters} panelRequest={filtersPanelRequest} />
        <TransactionList
          transactions={transactions}
          emptyText={isFiltered ? 'Ningún movimiento cumple estos filtros.' : 'Todavía no hay movimientos.'}
        />
      </div>
    </section>
  );
}
