// Fila de las listas de Ajustes.

/** Una fila de una lista de ajustes: botón si tiene `onClick`, texto si no. */
export function SettingsRow({ label, value, onClick, danger = false }) {
  const className = `row${danger ? ' danger' : ''}`;
  const content = (
    <>
      <span>{label}</span>
      {value !== undefined && <b>{value}</b>}
    </>
  );
  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
