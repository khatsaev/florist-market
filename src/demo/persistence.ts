/** Read, modify and persist within one IndexedDB transaction, including across tabs.
 * The callback must remain synchronous: awaiting would let the transaction auto-commit.
 */
export function updateSnapshot<T>(
  database: IDBDatabase,
  update: (previous?: Uint8Array) => { bytes: Uint8Array; result: T },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("snapshots", "readwrite");
    const store = transaction.objectStore("snapshots");
    const request = store.get("main");
    let result: T;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        const next = update(request.result as Uint8Array | undefined);
        result = next.result;
        store.put(next.bytes, "main");
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () =>
      reject(
        failure ??
          transaction.error ??
          new Error("Не удалось сохранить данные в браузере"),
      );
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
  });
}

export function openSnapshots(
  factory: IDBFactory,
  name: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("snapshots");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onblocked = () =>
      reject(
        new Error("Закройте другие вкладки приложения и повторите попытку"),
      );
  });
}
