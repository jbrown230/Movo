// Lista desplegable con el diseño de la app (la lista nativa del navegador no se puede estilizar).
// Se abre debajo del campo, empujando lo que sigue; así no se corta dentro de una hoja que se desplaza.

import { useEffect, useRef, useState } from 'react';
import { Field } from './formControls.jsx';
import { Icon } from './Icon.jsx';

/** Cierra la lista al tocar fuera de ella. */
function useCloseOnOutsidePress(ref, isOpen, close) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeIfOutside = (event) => {
      if (!ref.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', closeIfOutside);
    return () => document.removeEventListener('pointerdown', closeIfOutside);
  }, [ref, isOpen, close]);
}

/**
 * @param {{ id: string, label: string, value: string, emptyLabel: string,
 *           options: Array<{ value: string, label: string }>, onChange: (value: string) => void }} props
 *   `emptyLabel` es la primera opción: la que quita el filtro (su valor es '').
 */
export function Dropdown({ id, label, value, emptyLabel, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const close = () => setIsOpen(false);
  useCloseOnOutsidePress(wrapperRef, isOpen, close);

  const all = [{ value: '', label: emptyLabel }, ...options];
  const selectedLabel = all.find((option) => option.value === value)?.label ?? emptyLabel;
  const pick = (next) => {
    onChange(next);
    close();
  };

  return (
    <Field htmlFor={id} label={label}>
      <div className="dd" ref={wrapperRef}>
        <button
          id={id}
          type="button"
          className={`dd-btn${value ? '' : ' empty'}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedLabel}</span>
          <Icon name="chevron" />
        </button>
        {isOpen && (
          <div className="dd-list" role="listbox" aria-label={label}>
            {all.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="dd-opt"
                onClick={() => pick(option.value)}
              >
                {option.label}
                {option.value === value && <Icon name="check" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
