// Archivos ZIP sin compresión ("store"). Un libro de Excel (.xlsx) es un ZIP de archivos XML, y a esos tamaños
// no hace falta comprimir: así no se necesita ninguna librería.

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_RECORD_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const UTF8_NAMES_FLAG = 0x0800;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

/** Suma de verificación CRC-32 de unos bytes, como la que pide el formato ZIP. */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Hora y fecha en el formato de 16 bits que usa ZIP (MS-DOS). */
function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** Datos de un archivo ya listos para escribirse en el ZIP. */
function describeFile({ name, data }, date) {
  const nameBytes = new TextEncoder().encode(name);
  return { nameBytes, data, crc: crc32(data), ...dosDateTime(date) };
}

function writeLocalEntry(view, bytes, offset, file) {
  view.setUint32(offset, LOCAL_HEADER_SIGNATURE, true);
  view.setUint16(offset + 4, ZIP_VERSION, true);
  view.setUint16(offset + 6, UTF8_NAMES_FLAG, true);
  view.setUint16(offset + 8, 0, true); // sin compresión
  view.setUint16(offset + 10, file.time, true);
  view.setUint16(offset + 12, file.day, true);
  view.setUint32(offset + 14, file.crc, true);
  view.setUint32(offset + 18, file.data.length, true);
  view.setUint32(offset + 22, file.data.length, true);
  view.setUint16(offset + 26, file.nameBytes.length, true);
  view.setUint16(offset + 28, 0, true);
  bytes.set(file.nameBytes, offset + LOCAL_HEADER_SIZE);
  bytes.set(file.data, offset + LOCAL_HEADER_SIZE + file.nameBytes.length);
}

function writeCentralEntry(view, bytes, offset, file) {
  view.setUint32(offset, CENTRAL_HEADER_SIGNATURE, true);
  view.setUint16(offset + 4, ZIP_VERSION, true);
  view.setUint16(offset + 6, ZIP_VERSION, true);
  view.setUint16(offset + 8, UTF8_NAMES_FLAG, true);
  view.setUint16(offset + 10, 0, true);
  view.setUint16(offset + 12, file.time, true);
  view.setUint16(offset + 14, file.day, true);
  view.setUint32(offset + 16, file.crc, true);
  view.setUint32(offset + 20, file.data.length, true);
  view.setUint32(offset + 24, file.data.length, true);
  view.setUint16(offset + 28, file.nameBytes.length, true);
  view.setUint32(offset + 42, file.localOffset, true);
  bytes.set(file.nameBytes, offset + CENTRAL_HEADER_SIZE);
}

/**
 * Empaqueta archivos en un ZIP.
 *
 * @param {Array<{ name: string, data: Uint8Array }>} files
 * @param {Date} [date]  Fecha que se anota en cada archivo.
 * @returns {Uint8Array}
 */
export function zipStore(files, date = new Date()) {
  const described = files.map((file) => describeFile(file, date));
  const localSize = described.reduce(
    (sum, file) => sum + LOCAL_HEADER_SIZE + file.nameBytes.length + file.data.length,
    0,
  );
  const centralSize = described.reduce((sum, file) => sum + CENTRAL_HEADER_SIZE + file.nameBytes.length, 0);
  const bytes = new Uint8Array(localSize + centralSize + END_RECORD_SIZE);
  const view = new DataView(bytes.buffer);

  let localOffset = 0;
  let centralOffset = localSize;
  for (const file of described) {
    writeLocalEntry(view, bytes, localOffset, file);
    writeCentralEntry(view, bytes, centralOffset, { ...file, localOffset });
    localOffset += LOCAL_HEADER_SIZE + file.nameBytes.length + file.data.length;
    centralOffset += CENTRAL_HEADER_SIZE + file.nameBytes.length;
  }

  const endOffset = localSize + centralSize;
  view.setUint32(endOffset, END_RECORD_SIGNATURE, true);
  view.setUint16(endOffset + 8, described.length, true);
  view.setUint16(endOffset + 10, described.length, true);
  view.setUint32(endOffset + 12, centralSize, true);
  view.setUint32(endOffset + 16, localSize, true);
  return bytes;
}
