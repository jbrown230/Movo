// Abre un archivo .xlsx con ExcelJS para poder revisar en las pruebas lo que el usuario vería en Excel.
import ExcelJS from 'exceljs';

export async function loadWorkbook(bytes) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook;
}

/** El color de una tipografía o relleno de ExcelJS ("FF5A33E6") sin el canal alfa ("5A33E6"). */
export const rgb = (color) => color?.argb?.slice(2) ?? null;

/** La primera celda de la hoja con ese valor (en una celda combinada, la de arriba a la izquierda). */
export function findCell(sheet, value, { fromRow = 1 } = {}) {
  for (let rowNumber = fromRow; rowNumber <= sheet.rowCount; rowNumber++) {
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = sheet.getCell(rowNumber, column);
      if (cell.value === value) return cell;
    }
  }
  throw new Error(`No hay ninguna celda con "${value}"`);
}

/** Lo que ve la persona en una celda: su tipografía, relleno, formato de número y alineación. */
export function lookOf(cell) {
  return {
    fontColor: rgb(cell.font?.color),
    isBold: Boolean(cell.font?.bold),
    fontSize: cell.font?.size,
    fillColor: rgb(cell.fill?.fgColor),
    numFmt: cell.numFmt,
    horizontal: cell.alignment?.horizontal,
  };
}

/** Los valores de una fila, de la columna A a la I. */
export const valuesOfRow = (sheet, rowNumber) =>
  Array.from({ length: 9 }, (_, index) => sheet.getCell(rowNumber, index + 1).value);
