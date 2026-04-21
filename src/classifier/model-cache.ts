// IndexedDB model cache for ONNX classifier models.
// Stores model ArrayBuffers with version tracking to avoid re-downloading
// unchanged models on subsequent visits.

const DB_NAME = 'glymo-classifier';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const MANIFEST_URL = '/models/manifest.json';

interface CachedModel {
  name: string;
  version: string;
  data: ArrayBuffer;
  cachedAt: number;
}

export interface ModelManifest {
  version: string;
  models: Record<string, { file: string; version: string; categories: number }>;
}

// Module-level cached connection to avoid opening a new IDB connection per call
let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openModelDB();
  return dbInstance;
}

/**
 * Open (or create) the IndexedDB database for model caching.
 */
export async function openModelDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve a cached model if it exists and matches the expected version.
 */
export async function getCachedModel(
  db: IDBDatabase,
  name: string,
  version: string,
): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => {
      const result = request.result as CachedModel | undefined;
      if (result && result.version === version) {
        resolve(result.data);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Store a model in the IndexedDB cache.
 */
export async function cacheModel(
  db: IDBDatabase,
  name: string,
  version: string,
  data: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: CachedModel = { name, version, data, cachedAt: Date.now() };
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetch the model manifest from the server.
 */
export async function fetchManifest(): Promise<ModelManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch model manifest: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Load a model by name using the manifest. Checks IndexedDB first,
 * downloads from server if missing or version mismatch, then caches the result.
 */
export async function loadModel(
  name: string,
  manifest: ModelManifest,
): Promise<ArrayBuffer> {
  const modelInfo = manifest.models[name];
  if (!modelInfo) {
    throw new Error(`Model "${name}" not found in manifest`);
  }

  const db = await getDB();

  // Check cache first
  const cached = await getCachedModel(db, name, modelInfo.version);
  if (cached) {
    return cached;
  }

  // Download the model
  const response = await fetch(`/models/${modelInfo.file}`);
  if (!response.ok) {
    throw new Error(`Failed to download model "${name}": ${response.status} ${response.statusText}`);
  }

  const data = await response.arrayBuffer();

  // Cache for next time
  try {
    await cacheModel(db, name, modelInfo.version, data);
  } catch (cacheError) {
    // Caching failure is non-fatal; the model still loaded successfully
    console.warn(`Failed to cache model "${name}":`, cacheError);
  }

  return data;
}
