// Almacén de clave y valor sobre IndexedDB. Guarda el archivo de la base SQLite de cada usuario.

const DATABASE_NAME = 'movo';
const STORE_NAME = 'kv';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runInStore(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => { resolve(request?.result); database.close(); };
    transaction.onerror = () => { reject(transaction.error); database.close(); };
  });
}

export const readValue = (key) => runInStore('readonly', (store) => store.get(key));
export const writeValue = (key, value) => runInStore('readwrite', (store) => store.put(value, key));
export const removeValue = (key) => runInStore('readwrite', (store) => store.delete(key));
