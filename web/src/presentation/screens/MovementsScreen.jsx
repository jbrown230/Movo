import { useMemo } from 'react';
import { SegmentedControl } from '../components/formControls.jsx';
import { Icon } from '../components/Icon.jsx';
import { TransactionList } from '../components/TransactionList.jsx';
import { Direction } from '../../domain/types.js';
import { useAppData } from '../hooks/useAppData.js';
import { ExportModal } from '../modals/ExportModal.jsx';
import { FiltersModal } from '../modals/FiltersModal.jsx';
import { useModal } from '../state/ModalProvider.jsx';
import {
  NO_MOVEMENT_FILTERS,
  countActiveFilters,
  countSheetFilters,
  toSearchFilters,
} from '../state/movementFilters.js';
import { useNavigation } from '../state/NavigationProvider.jsx';
import { useSession } from '../state/SessionProvider.jsx';

const DIRECTION_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: Direction.EXPENSE, label: 'Gastos' },
  { value: Direction.INCOME, label: 'Ingresos' },
  { value: Direction.OWN_TRANSFER, label: 'Mis cuentas' },
];

/** Campo de búsqueda por comercio o persona, con botón para borrar lo escrito. */
function SearchBox({ value, onChange }) {
  return (
    <div className="searchbox">
      <Icon name="search" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar comercio o persona"
        aria-label="Buscar movimientos"
        autoComplete="off"
      />
      {value && (
        <button type="button" aria-label="Borrar búsqueda" onClick={() => onChange('')}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

/** Botón que abre la hoja "Filtros"; lleva el número de filtros puestos. */
function FiltersButton({ count }) {
  const { openModal } = useModal();
  return (
    <button
      type="button"
      className="filters-toggle"
      aria-label={`Filtros${count ? ` (${count})` : ''}`}
      onClick={() => openModal(<FiltersModal />)}
    >
      <Icon name="filter" />
      {count > 0 && <span className="fbadge">{count}</span>}
    </button>
  );
}

/** Botón redondo que exporta a CSV lo que se ve en la lista, con los mismos filtros. */
function ExportButton({ isDisabled }) {
  const { openModal } = useModal();
  return (
    <button
      type="button"
      className="roundbtn"
      aria-label="Exportar movimientos a CSV"
      disabled={isDisabled}
      onClick={() => openModal(<ExportModal />)}
    >
      <Icon name="download" />
    </button>
  );
}

/** Movimientos: todos, con búsqueda, tipo y la hoja de filtros. */
export function MovementsScreen() {
  const { profile, services, dataVersion } = useSession();
  const { movementFilters, setMovementFilters } = useNavigation();
  const { transactions } = useAppData();
  const isFiltered = countActiveFilters(movementFilters) > 0;
  const setFilter = (name) => (value) => setMovementFilters({ ...movementFilters, [name]: value });

  const filtered = useMemo(
    () => (isFiltered ? services.queries.searchTransactions(toSearchFilters(movementFilters)) : null),
    // dataVersion hace que se busque de nuevo después de cada cambio en los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, dataVersion, movementFilters, isFiltered],
  );
  const visible = filtered ?? transactions;

  let emptyText = 'Cuando tu banco te envíe una notificación, aparecerá aquí sola.';
  if (profile.demo) emptyText = 'Usa el simulador del inicio para hacer un SINPE.';
  if (isFiltered) emptyText = 'Ningún movimiento cumple estos filtros.';

  let countText = transactions.length ? `${transactions.length} en total` : 'Aún no hay movimientos.';
  if (isFiltered) countText = `${filtered.length} con estos filtros`;

  return (
    <section aria-label="Movimientos">
      <div className="ihead mv-head">
        <div>
          <h1>Movimientos</h1>
          <p>{countText}</p>
        </div>
        <ExportButton isDisabled={visible.length === 0} />
      </div>
      <div className="mv-body">
        <div className="mv-tools">
          <SearchBox value={movementFilters.text} onChange={setFilter('text')} />
          <FiltersButton count={countSheetFilters(movementFilters)} />
        </div>
        <SegmentedControl
          label="Tipo de movimiento"
          options={DIRECTION_OPTIONS}
          value={movementFilters.direction}
          onChange={setFilter('direction')}
          isCompact
        />
        {isFiltered && (
          <button type="button" className="link mv-clear" onClick={() => setMovementFilters(NO_MOVEMENT_FILTERS)}>
            Quitar filtros
          </button>
        )}
        <TransactionList transactions={visible} emptyText={emptyText} />
      </div>
    </section>
  );
}
