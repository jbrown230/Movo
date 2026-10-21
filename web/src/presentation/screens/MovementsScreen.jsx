import { useMemo } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TransactionList } from '../components/TransactionList.jsx';
import { Direction } from '../../domain/types.js';
import { useAppData } from '../hooks/useAppData.js';
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

const DIRECTION_CHIPS = [
  { value: '', label: 'Todos' },
  { value: Direction.EXPENSE, label: 'Gastos' },
  { value: Direction.INCOME, label: 'Ingresos' },
  { value: Direction.OWN_TRANSFER, label: 'Entre mis cuentas' },
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
    <button type="button" className="filters-toggle" onClick={() => openModal(<FiltersModal />)}>
      <Icon name="filter" />
      Filtros{count ? ` (${count})` : ''}
    </button>
  );
}

/** Tipo de movimiento, con un toque: todos, gastos, ingresos o entre mis cuentas. */
function DirectionChips({ value, onChange }) {
  return (
    <div className="chips" role="group" aria-label="Tipo de movimiento">
      {DIRECTION_CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          className="chip plain"
          aria-pressed={chip.value === value}
          onClick={() => onChange(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
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
      <div className="ihead">
        <h1>Movimientos</h1>
        <p>{countText}</p>
      </div>
      <div className="mv-body">
        <div className="mv-tools">
          <SearchBox value={movementFilters.text} onChange={setFilter('text')} />
          <FiltersButton count={countSheetFilters(movementFilters)} />
        </div>
        <DirectionChips value={movementFilters.direction} onChange={setFilter('direction')} />
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
