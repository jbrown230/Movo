// Lee un archivo .xlsx (un ZIP sin compresión) para poder revisar su contenido en las pruebas.
import assert from 'node:assert/strict';
import { crc32 } from '../../web/src/domain/zip.js';

const END_RECORD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_RECORD_SIZE = 22;
const LOCAL_HEADER_SIZE = 30;

/** Los archivos del ZIP como { nombre: texto }, comprobando las firmas, el CRC y los tamaños. */
export function readZipTexts(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = bytes.length - END_RECORD_SIZE;
  assert.equal(view.getUint32(endOffset, true), END_RECORD_SIGNATURE, 'falta el registro final del ZIP');

  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  const files = {};

  for (let index = 0; index < entryCount; index++) {
    assert.equal(view.getUint32(offset, true), CENTRAL_SIGNATURE, 'entrada del directorio central dañada');
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    assert.equal(view.getUint32(localOffset, true), LOCAL_SIGNATURE, `encabezado local dañado en ${name}`);
    const dataStart = localOffset + LOCAL_HEADER_SIZE + view.getUint16(localOffset + 26, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, `el CRC de ${name} no coincide`);

    files[name] = decoder.decode(data);
    offset += 46 + nameLength;
  }
  return files;
}

const KNOWN_ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+);/y;

/** Revisa que un XML esté bien formado: etiquetas que abren y cierran en orden, y sin `&` ni `<` sueltos. */
export function assertWellFormedXml(xml, name = 'xml') {
  const stack = [];
  const tokens = xml.matchAll(/<\?[^>]*\?>|<\/([\w:]+)>|<([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*(\/?)>|([^<]+)/g);
  for (const [, closing, opening, , selfClosing, text] of tokens) {
    if (closing) assert.equal(stack.pop(), closing, `${name}: la etiqueta </${closing}> no cierra a la que abrió`);
    else if (opening && !selfClosing) stack.push(opening);
    else if (text) {
      for (const [index, character] of [...text].entries()) {
        if (character !== '&') continue;
        KNOWN_ENTITY.lastIndex = text.indexOf('&', index);
        assert.ok(KNOWN_ENTITY.test(text), `${name}: hay un & sin escapar`);
      }
    }
  }
  assert.deepEqual(stack, [], `${name}: quedaron etiquetas sin cerrar`);
  assert.ok(!/<(?![\w/?])/.test(xml), `${name}: hay un < sin escapar`);
}
