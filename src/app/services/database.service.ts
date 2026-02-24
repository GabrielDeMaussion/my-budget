import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    private dbName = 'MyBudgetDB';
    private dbVersion = 2;
    private db: IDBDatabase | null = null;

    private initPromise: Promise<IDBDatabase>;

    constructor() {
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('paymentTypes')) {
                    db.createObjectStore('paymentTypes', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('paymentCategories')) {
                    db.createObjectStore('paymentCategories', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentsStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentsStore.createIndex('userId', 'userId', { unique: false });
                    paymentsStore.createIndex('paymentTypeId', 'paymentTypeId', { unique: false });
                }
                if (!db.objectStoreNames.contains('paymentInstances')) {
                    const instancesStore = db.createObjectStore('paymentInstances', { keyPath: 'id', autoIncrement: true });
                    instancesStore.createIndex('paymentId', 'paymentId', { unique: false });
                }
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    usersStore.createIndex('email', 'email', { unique: true });
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                this.seedInitialData().then(() => resolve(this.db!));
            };

            request.onerror = (event: any) => {
                reject('Error abriendo IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    private async getDb(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        return this.initPromise;
    }

    private async seedInitialData() {
        const types = await this.getAll('paymentTypes');
        if (types.length === 0) {
            await this.add('paymentTypes', { id: 1, value: 'Ingreso' });
            await this.add('paymentTypes', { id: 2, value: 'Egreso' });
        }

        const categories = await this.getAll('paymentCategories');
        if (categories.length === 0) {
            await this.add('paymentCategories', { id: 1, value: 'Salario' });
            await this.add('paymentCategories', { id: 2, value: 'Alimentación' });
            await this.add('paymentCategories', { id: 3, value: 'Servicios' });
        }

        const users = await this.getAll('users');
        if (users.length === 0) {
            await this.add('users', {
                id: 1,
                email: 'admin@gmail.com',
                password: 'admin',
                name: 'Admin',
                lastName: 'Usuario',
                theme: 'dark'
            });
        }
    }

    async getAll<T>(storeName: string): Promise<T[]> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById<T>(storeName: string, id: number | string): Promise<T> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(Number(id));

            request.onsuccess = () => {
                if (request.result) resolve(request.result);
                else reject(new Error(`Registro no encontrado en ${storeName} con id ${id}`));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value); // Assuming value matches exactly

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /** Busca un único registro por índice. Retorna null si no existe. */
    async getOneByIndex<T>(storeName: string, indexName: string, value: any): Promise<T | null> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.get(value);

            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async add<T>(storeName: string, item: T): Promise<T> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => {
                // Return item with generated ID
                resolve({ ...item, id: request.result } as unknown as T);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async update<T>(storeName: string, id: number | string, changes: Partial<T>): Promise<T> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);

            const getReq = store.get(Number(id));
            getReq.onsuccess = () => {
                if (!getReq.result) {
                    reject(new Error(`Registro no encontrado en ${storeName} con id ${id}`));
                    return;
                }

                const updatedItem = { ...getReq.result, ...changes, id: Number(id) };
                const putReq = store.put(updatedItem);

                putReq.onsuccess = () => resolve(updatedItem);
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    async delete(storeName: string, id: number | string): Promise<void> {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async exportBackup(): Promise<string> {
        const db = await this.getDb();
        const stores = Array.from(db.objectStoreNames);
        const data: any = {};

        for (const storeName of stores) {
            data[storeName] = await this.getAll(storeName);
        }

        return JSON.stringify(data);
    }

    async restoreBackup(jsonString: string): Promise<void> {
        const db = await this.getDb();
        let data: any;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            throw new Error('Archivo de respaldo inválido');
        }

        const stores = Array.from(db.objectStoreNames);

        for (const storeName of stores) {
            if (data[storeName] && Array.isArray(data[storeName])) {
                // Clear existing data
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    const req = store.clear();
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });

                // Insert new data
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    for (const item of data[storeName]) {
                        store.add(item);
                    }
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            }
        }
    }
}
