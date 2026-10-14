/**
 * storage_proxy.js
 * 
 * Replaces window.localStorage with an in-memory proxy that persists to both
 * native localStorage (for synchronous, crash-safe persistence) and IndexedDB
 * (to circumvent the 5MB quota limit).
 */

(function() {
  const DB_NAME = 'NeonPlannerStorage';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyval';
  
  // Keep reference to native localStorage before overriding
  const origLocalStorage = window.localStorage;
  
  class StorageProxyClass {
    constructor() {
      this.memoryMap = new Map();
      this.ready = new Promise((resolve, reject) => {
        this._resolveReady = resolve;
        this._rejectReady = reject;
      });
      this.db = null;

      // 1. Immediately pre-populate memory map from native localStorage synchronously
      try {
        if (origLocalStorage) {
          for (let i = 0; i < origLocalStorage.length; i++) {
            const key = origLocalStorage.key(i);
            if (key !== null) {
              this.memoryMap.set(key, origLocalStorage.getItem(key));
            }
          }
        }
      } catch (e) {
        console.warn("[StorageProxy] Could not pre-read native localStorage:", e);
      }

      this.initDB();
    }
    
    initDB() {
      if (!window.indexedDB) {
        console.warn("[StorageProxy] IndexedDB not available, falling back to native localStorage only.");
        this._resolveReady();
        return;
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
          console.error("[StorageProxy] IndexedDB open error:", event);
          this._resolveReady();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.loadAllFromDB();
        };
      } catch (e) {
        console.error("[StorageProxy] IndexedDB initialization exception:", e);
        this._resolveReady();
      }
    }
    
    loadAllFromDB() {
      if (!this.db) {
        this._resolveReady();
        return;
      }
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            // If memoryMap already has a newer or equal value, keep it; otherwise set from DB
            if (!this.memoryMap.has(cursor.key)) {
              this.memoryMap.set(cursor.key, cursor.value);
            }
            cursor.continue();
          } else {
            // DB keys loaded, now ensure all current memoryMap items are safely in DB
            this._syncMemoryToDB();
            this._resolveReady();
          }
        };
        
        request.onerror = (event) => {
          console.error("[StorageProxy] Load from IndexedDB error:", event);
          this._resolveReady();
        };
      } catch (e) {
        console.error("[StorageProxy] Cursor exception:", e);
        this._resolveReady();
      }
    }

    _syncMemoryToDB() {
      if (!this.db) return;
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        for (const [key, value] of this.memoryMap.entries()) {
          store.put(value, key);
        }
      } catch (e) {
        console.warn("[StorageProxy] Memory to DB sync warning:", e);
      }
    }
    
    _saveToDB(key, value) {
      if (!this.db) return;
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(value, key);
      } catch (e) {
        console.warn(`[StorageProxy] Failed to persist key '${key}' to DB:`, e);
      }
    }
    
    _removeFromDB(key) {
      if (!this.db) return;
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(key);
      } catch (e) {
        console.warn(`[StorageProxy] Failed to delete key '${key}' from DB:`, e);
      }
    }
    
    _clearDB() {
      if (!this.db) return;
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
      } catch (e) {
        console.warn("[StorageProxy] Failed to clear DB:", e);
      }
    }
    
    // localStorage API Implementation
    get length() {
      return this.memoryMap.size;
    }
    
    key(index) {
      const keys = Array.from(this.memoryMap.keys());
      return keys[index] !== undefined ? keys[index] : null;
    }
    
    getItem(key) {
      if (this.memoryMap.has(key)) {
        return this.memoryMap.get(key);
      }
      // Fallback check in native storage
      try {
        if (origLocalStorage) {
          const val = origLocalStorage.getItem(key);
          if (val !== null) {
            this.memoryMap.set(key, val);
            return val;
          }
        }
      } catch (e) {}
      return null;
    }
    
    setItem(key, value) {
      const strKey = String(key);
      const strValue = String(value);
      
      // 1. In-memory update
      this.memoryMap.set(strKey, strValue);
      
      // 2. Dual persistence: Write synchronously to native localStorage (for instant persistence)
      try {
        if (origLocalStorage) {
          origLocalStorage.setItem(strKey, strValue);
        }
      } catch (e) {
        // Native 5MB quota exceeded, IndexedDB will handle large storage
      }
      
      // 3. Write asynchronously to IndexedDB
      this._saveToDB(strKey, strValue);
    }
    
    removeItem(key) {
      const strKey = String(key);
      this.memoryMap.delete(strKey);
      try {
        if (origLocalStorage) {
          origLocalStorage.removeItem(strKey);
        }
      } catch (e) {}
      this._removeFromDB(strKey);
    }
    
    clear() {
      this.memoryMap.clear();
      try {
        if (origLocalStorage) {
          origLocalStorage.clear();
        }
      } catch (e) {}
      this._clearDB();
    }
  }

  // Create our proxy instance
  const customStorage = new StorageProxyClass();
  window.StorageProxy = customStorage;

  // Override window.localStorage using a Proxy to catch all accesses
  try {
    const proxy = new Proxy(customStorage, {
      get(target, prop) {
        if (typeof target[prop] === 'function') {
          return target[prop].bind(target);
        }
        if (prop in target) {
          return target[prop];
        }
        return target.getItem(prop);
      },
      set(target, prop, value) {
        target.setItem(prop, value);
        return true;
      },
      deleteProperty(target, prop) {
        target.removeItem(prop);
        return true;
      }
    });

    Object.defineProperty(window, 'localStorage', {
      value: proxy,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    console.error("Failed to override window.localStorage.", e);
  }
})();
