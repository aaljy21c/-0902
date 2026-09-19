/**
 * storage_proxy.js
 * 
 * Replaces window.localStorage with an in-memory proxy that persists to IndexedDB.
 * This circumvents the 5MB quota limit of native localStorage.
 */

(function() {
  const DB_NAME = 'NeonPlannerStorage';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyval';
  
  class StorageProxyClass {
    constructor() {
      this.memoryMap = new Map();
      this.ready = new Promise((resolve, reject) => {
        this._resolveReady = resolve;
        this._rejectReady = reject;
      });
      this.db = null;
      this.initDB();
    }
    
    initDB() {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error("StorageProxy IndexedDB Error:", event);
        // Fallback to empty memory map if DB fails
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
    }
    
    loadAllFromDB() {
      if (!this.db) return;
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          this.memoryMap.set(cursor.key, cursor.value);
          cursor.continue();
        } else {
          // Finished loading all keys
          console.log(`[StorageProxy] Loaded ${this.memoryMap.size} items from IndexedDB`);
          this._resolveReady();
        }
      };
      
      request.onerror = (event) => {
        console.error("StorageProxy load Error:", event);
        this._resolveReady();
      };
    }
    
    _saveToDB(key, value) {
      if (!this.db) return;
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(value, key);
    }
    
    _removeFromDB(key) {
      if (!this.db) return;
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(key);
    }
    
    _clearDB() {
      if (!this.db) return;
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    }
    
    // localStorage API Implementation
    get length() {
      return this.memoryMap.size;
    }
    
    key(index) {
      const keys = Array.from(this.memoryMap.keys());
      return keys[index] || null;
    }
    
    getItem(key) {
      if (this.memoryMap.has(key)) {
        return this.memoryMap.get(key);
      }
      return null;
    }
    
    setItem(key, value) {
      const strValue = String(value);
      this.memoryMap.set(key, strValue);
      this._saveToDB(key, strValue);
    }
    
    removeItem(key) {
      this.memoryMap.delete(key);
      this._removeFromDB(key);
    }
    
    clear() {
      this.memoryMap.clear();
      this._clearDB();
    }
  }

  // Create our proxy instance
  const customStorage = new StorageProxyClass();
  window.StorageProxy = customStorage;
  
  // Migrate existing data from native localStorage if custom storage is empty
  customStorage.ready.then(() => {
    try {
      const nativeLocalStorage = window.localStorage;
      if (customStorage.length === 0 && nativeLocalStorage.length > 0) {
        console.log("[StorageProxy] Migrating data from native localStorage...");
        for (let i = 0; i < nativeLocalStorage.length; i++) {
          const key = nativeLocalStorage.key(i);
          const value = nativeLocalStorage.getItem(key);
          customStorage.setItem(key, value);
        }
        console.log("[StorageProxy] Migration complete.");
      }
    } catch (e) {
      console.warn("[StorageProxy] Could not access native localStorage for migration.", e);
    }
  });

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
