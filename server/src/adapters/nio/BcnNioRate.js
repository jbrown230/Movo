// Córdobas por dólar: la tasa de cambio oficial del Banco Central de Nicaragua (BCN), por su servicio web (SOAP).
// Documentación del BCN: https://www.bcn.gob.ni/servicio-web-tipo-de-cambio
//
// El servicio entrega la tasa de cada día de un mes (`RecuperaTC_Mes`), también los días futuros del mes: el BCN la
// publica con un mes de anticipación.
//
// OJO con la seguridad: el servidor del BCN solo habla TLS 1.0, un protocolo que Node rechaza por defecto. Aquí se
// permite, y solo para esta conexión (nunca de forma global). Lo que viaja es una tasa de cambio pública; el
// certificado (DigiCert, *.bcn.gob.ni) sí se verifica, y el valor recibido se descarta si no es razonable.

import https from 'node:https';

const SERVICE_URL = 'https://servicios.bcn.gob.ni/Tc_Servicio/ServicioTC.asmx';
const NAMESPACE = 'http://servicios.bcn.gob.ni/';
const MONTH_OPERATION = 'RecuperaTC_Mes';
const REQUEST_TIMEOUT_MS = 8000;
const MONTHS_OF_HISTORY = 3; // cubre los 60 días de historial del tipo de cambio

// Un valor fuera de este rango es una respuesta rota, no un córdoba: la tasa ronda 36-37 por dólar.
const MIN_PLAUSIBLE_NIO_PER_USD = 20;
const MAX_PLAUSIBLE_NIO_PER_USD = 100;

const DAY_RATE = /<Fecha>(\d{4}-\d{2}-\d{2})<\/Fecha>\s*<Valor>([\d.]+)<\/Valor>/g;

/**
 * Una llamada SOAP al servicio del BCN.
 * @returns {Promise<{ status: number, text: string }>}
 */
function postSoap(operation, parametersXml) {
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    `<${operation} xmlns="${NAMESPACE}">${parametersXml}</${operation}></soap:Body></soap:Envelope>`;
  return new Promise((resolve, reject) => {
    const request = https.request(
      SERVICE_URL,
      {
        method: 'POST',
        // El servidor del BCN solo acepta TLS 1.0 (ver el aviso de arriba).
        minVersion: 'TLSv1',
        maxVersion: 'TLSv1',
        ciphers: 'DEFAULT@SECLEVEL=0',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          SOAPAction: `"${NAMESPACE}${operation}"`,
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          text += chunk;
        });
        response.on('end', () => resolve({ status: response.statusCode, text }));
      },
    );
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('el BCN no respondió a tiempo')));
    request.end(body);
  });
}

/** Las tasas { date, value } de la respuesta de un mes, sin las que no son un valor razonable. */
export function parseMonthRates(xml) {
  return [...xml.matchAll(DAY_RATE)]
    .map(([, date, value]) => ({ date, value: Number(value) }))
    .filter(({ value }) => value > MIN_PLAUSIBLE_NIO_PER_USD && value < MAX_PLAUSIBLE_NIO_PER_USD);
}

/** El mes de `now` y los anteriores, del más reciente al más viejo: [{ year, month }] (el mes va de 1 a 12). */
export function lastMonths(now, count) {
  return Array.from({ length: count }, (_, back) => {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
}

/**
 * @param {Object} [options]  Solo para pruebas.
 * @param {typeof postSoap} [options.post]
 * @param {() => Date} [options.now]
 * @returns {() => Promise<Array<{ date: string, value: number }>>}  Pide los córdobas por dólar de cada día de los
 *   últimos meses, del día más viejo al más nuevo. Lanza un error si el mes actual no se puede leer; un mes anterior
 *   que falle simplemente no aparece.
 */
export function createBcnNioRate({ post = postSoap, now = () => new Date() } = {}) {
  async function fetchMonth({ year, month }) {
    const { status, text } = await post(MONTH_OPERATION, `<Ano>${year}</Ano><Mes>${month}</Mes>`);
    if (status !== 200) throw new Error('BCN ' + status);
    const rates = parseMonthRates(text);
    if (!rates.length) throw new Error('el BCN respondió sin tasas válidas');
    return rates;
  }

  return async function fetchNioRates() {
    const [current, ...earlier] = lastMonths(now(), MONTHS_OF_HISTORY);
    const [currentRates, ...earlierRates] = await Promise.all([
      fetchMonth(current),
      ...earlier.map((month) => fetchMonth(month).catch(() => [])),
    ]);
    return [...earlierRates.flat(), ...currentRates].sort((first, second) => first.date.localeCompare(second.date));
  };
}
