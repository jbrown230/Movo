// Nombres de lo que se guarda en `local_state` (estado que solo importa en este teléfono).
// Si cambias un valor aquí, agrega una migración que renombre la clave en las bases ya guardadas.

export const LocalStateKey = Object.freeze({
  EXCHANGE_RATE_INFO: 'exchange_rate_info', // { rate, source, date } del último tipo de cambio
  CLOUD_BACKUP_ENABLED: 'cloud_backup_enabled', // true si la persona activó el respaldo
  SYNC_CURSOR: 'sync_cursor', // hasta dónde se bajó del servidor
  LAST_SYNC_AT: 'last_sync', // milisegundos de la última sincronización
  LAST_SCAN_AT: 'last_scan', // milisegundos de la última búsqueda en Gmail
  PARSER_VERSION: 'parser_version', // versión del lector con la que se leyó todo
  DEMO_DATA_LOADED: 'demo_data_loaded', // true si ya se cargaron los datos de ejemplo
});
