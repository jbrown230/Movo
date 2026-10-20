// Descargar un archivo generado en el teléfono, sin pasar por el servidor.

const RELEASE_DELAY_MS = 1000; // se libera la dirección temporal después de que el navegador empezó la descarga

/** Descarga un texto como archivo con ese nombre. */
export function downloadTextFile(fileName, content, mimeType = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), RELEASE_DELAY_MS);
}
