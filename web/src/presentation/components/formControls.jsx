// Controles de formulario que se repiten en varias pantallas.

import { AUTOMATIC_ONLY_CATEGORY_KEYS, CATEGORIES } from '../../domain/categories.js';
import { CategoryIcon } from './Icon.jsx';

/** Etiqueta y campo juntos. Si el hijo es un campo de texto, debe usar el mismo `id` que `htmlFor`. */
export function Field({ htmlFor, label, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/** Monto grande, centrado. Solo deja escribir números, comas y puntos. */
export function AmountInput({ value, onChange, currencySymbol = '₡', hint = '' }) {
  const widthInCharacters = Math.max(2, value.length || 1) + 0.5;
  return (
    <div className="amount">
      <div className="wrap">
        <span>{currencySymbol}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          placeholder="0"
          aria-label="Monto"
          autoComplete="off"
          data-autofocus
          style={{ width: `${widthInCharacters}ch` }}
        />
      </div>
      <div className="hint">{hint}</div>
    </div>
  );
}

/** Botones para elegir una opción. `options` es una lista de { value, label }. */
export function SegmentedControl({ options, value, onChange, label, isCompact = false }) {
  return (
    <div className={`seg${isCompact ? ' compact' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Cuadrícula de categorías. Nunca ofrece las que Movo asigna sola (ingresos y entre mis cuentas).
 * `hidden` son otras claves que tampoco se ofrecen.
 */
export function CategoryPicker({ selected, onSelect, hidden = [] }) {
  const keys = Object.keys(CATEGORIES).filter(
    (key) => !AUTOMATIC_ONLY_CATEGORY_KEYS.includes(key) && !hidden.includes(key),
  );
  return (
    <div className="catgrid" role="group" aria-label="Categoría">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className="catopt"
          aria-pressed={key === selected}
          onClick={() => onSelect(key)}
        >
          <CategoryIcon category={key} />
          {CATEGORIES[key].name}
        </button>
      ))}
    </div>
  );
}
