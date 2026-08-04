import { Injectable } from '@angular/core';

/**
 * Servicio para gestionar IndexedDB
 * Proporciona persistencia robusta que NO se pierde al limpiar localStorage
 */
@Injectable({ providedIn: 'root' })
export class IndexedDBService {
  private dbName = 'GymAppDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  /**
   * Inicializa la base de datos IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        // Crear object store para el cronómetro si no existe
        if (!db.objectStoreNames.contains('timer')) {
          const timerStore = db.createObjectStore('timer', { keyPath: 'id' });
          timerStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
        }

        // Crear object store para preferencias si no existe
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Asegura que la DB está lista
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  /**
   * Guarda el estado del cronómetro
   */
  async saveTimerState(state: {
    endTime?: number;
    total?: number;
    paused?: number;
  }): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['timer'], 'readwrite');
    const store = transaction.objectStore('timer');

    const timerData = {
      id: 'current-timer',
      endTime: state.endTime || null,
      total: state.total || null,
      paused: state.paused || null,
      lastUpdate: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(timerData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene el estado del cronómetro
   */
  async getTimerState(): Promise<{
    endTime: number | null;
    total: number | null;
    paused: number | null;
  } | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['timer'], 'readonly');
    const store = transaction.objectStore('timer');

    return new Promise((resolve, reject) => {
      const request = store.get('current-timer');

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
        } else {
          resolve({
            endTime: result.endTime,
            total: result.total,
            paused: result.paused
          });
        }
      };

      request.onerror = () => {
        console.error('Error al leer timer de IndexedDB:', request.error);
        resolve(null);
      };
    });
  }

  /**
   * Limpia el estado del cronómetro
   */
  async clearTimerState(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['timer'], 'readwrite');
    const store = transaction.objectStore('timer');

    return new Promise((resolve, reject) => {
      const request = store.delete('current-timer');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Guarda una preferencia
   */
  async savePreference(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['preferences'], 'readwrite');
    const store = transaction.objectStore('preferences');

    const data = {
      key,
      value,
      lastUpdate: Date.now()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene una preferencia
   */
  async getPreference(key: string): Promise<any | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['preferences'], 'readonly');
    const store = transaction.objectStore('preferences');

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => {
        console.error('Error al leer preferencia de IndexedDB:', request.error);
        resolve(null);
      };
    });
  }

  /**
   * Sincroniza localStorage con IndexedDB para el cronómetro
   */
  async syncTimerFromLocalStorage(): Promise<void> {
    const endTime = localStorage.getItem('crono_endTime');
    const total = localStorage.getItem('crono_total');
    const paused = localStorage.getItem('crono_paused');

    if (endTime || total || paused) {
      await this.saveTimerState({
        endTime: endTime ? Number(endTime) : undefined,
        total: total ? Number(total) : undefined,
        paused: paused ? Number(paused) : undefined
      });
    }
  }

  /**
   * Restaura el cronómetro desde IndexedDB a localStorage
   */
  async restoreTimerToLocalStorage(): Promise<void> {
    const state = await this.getTimerState();
    if (state) {
      if (state.endTime) localStorage.setItem('crono_endTime', String(state.endTime));
      if (state.total) localStorage.setItem('crono_total', String(state.total));
      if (state.paused) localStorage.setItem('crono_paused', String(state.paused));
    }
  }
}
