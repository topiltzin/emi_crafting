// Read-only access to the pre-Supabase local database (sql.js persisted into IndexedDB by the
// old src/modules/db.js). Used ONLY by src/modules/migration.js to copy existing local albums
// and photos into Supabase once; nothing here ever writes back to this local database (FR-005).
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_NAME = 'PhotoOrganizerDB';
const STORE_NAME = 'database';

export async function hasLegacyLocalData() {
  const raw = await loadRawIndexedDbBlob();
  return !!raw;
}

// Returns { albums, photos } as plain row objects matching the old sql.js schema's column
// names (album_date, title, filename, file_size, mime_type, photo_date, upload_date,
// photo_data_base64, thumbnail_base64, exif_json (a JSON string), is_favorite, ...).
export async function readLegacyAlbumsAndPhotos() {
  const raw = await loadRawIndexedDbBlob();
  if (!raw) return { albums: [], photos: [] };

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const db = new SQL.Database(raw);

  try {
    const albums = execToObjects(db, 'SELECT * FROM Albums WHERE deleted_at IS NULL');
    const photos = execToObjects(db, 'SELECT * FROM Photos WHERE deleted_at IS NULL');
    return { albums, photos };
  } finally {
    db.close();
  }
}

function execToObjects(db, sql) {
  const result = db.exec(sql);
  if (result.length === 0) return [];

  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function loadRawIndexedDbBlob() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve(null);
        return;
      }

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get('db');

      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };

    request.onerror = () => resolve(null);
  });
}
