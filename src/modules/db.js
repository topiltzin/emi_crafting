import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let db = null;
let SQL = null;

export async function initDB() {
  if (db) return db;

  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl
  });

  // Try loading from IndexedDB
  const stored = await loadFromIndexedDB();
  if (stored) {
    db = new SQL.Database(stored);
    await migrateSchema();
  } else {
    db = new SQL.Database();
    await createSchema();
  }

  return db;
}

// Additive, idempotent migrations for databases created before a given column existed.
async function migrateSchema() {
  const columnsResult = db.exec('PRAGMA table_info(Photos)');
  const columns = columnsResult.length > 0 ? columnsResult[0].values.map((row) => row[1]) : [];

  if (!columns.includes('is_favorite')) {
    db.run('ALTER TABLE Photos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
    await persistDB();
  }
}

async function createSchema() {
  // Albums table
  db.run(`
    CREATE TABLE IF NOT EXISTS Albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_date DATE NOT NULL UNIQUE,
      title TEXT,
      photo_count INTEGER DEFAULT 0,
      sort_order INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )
  `);

  // Photos table
  db.run(`
    CREATE TABLE IF NOT EXISTS Photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      photo_date DATE,
      upload_date DATETIME NOT NULL,
      photo_data_base64 LONGTEXT NOT NULL,
      thumbnail_base64 LONGTEXT,
      exif_json TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY (album_id) REFERENCES Albums(id)
    )
  `);

  // AlbumOrder table
  db.run(`
    CREATE TABLE IF NOT EXISTS AlbumOrder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL UNIQUE,
      position INTEGER NOT NULL UNIQUE,
      last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (album_id) REFERENCES Albums(id)
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_album_date ON Albums(album_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_album_id ON Photos(album_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_album_sort ON Albums(sort_order)');
  db.run('CREATE INDEX IF NOT EXISTS idx_deleted_at ON Albums(deleted_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_photo_deleted_at ON Photos(deleted_at)');

  await persistDB();
}

// Test-only helper: clears all rows so each test file's tests don't collide on unique
// constraints (e.g. Albums.album_date) via the cached module-level `db` singleton. Not used
// by any application code path.
export async function resetDatabaseForTests() {
  if (!db) return;
  db.run('DELETE FROM Photos');
  db.run('DELETE FROM Albums');
  db.run('DELETE FROM AlbumOrder');
  await persistDB();
}

export async function persistDB() {
  if (!db) return;
  // db.export() already returns a Uint8Array, which IndexedDB can store
  // directly via structured clone — no Buffer (Node-only) conversion needed.
  const data = db.export();
  await saveToIndexedDB(data);
}

async function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PhotoOrganizerDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('database')) {
        db.createObjectStore('database');
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('database', 'readwrite');
      const store = tx.objectStore('database');
      store.put(data, 'db');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}

async function loadFromIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('PhotoOrganizerDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('database')) {
        db.createObjectStore('database');
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('database')) {
        resolve(null);
        return;
      }

      const tx = db.transaction('database', 'readonly');
      const store = tx.objectStore('database');
      const getRequest = store.get('db');

      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };

      getRequest.onerror = () => {
        resolve(null);
      };
    };

    request.onerror = () => resolve(null);
  });
}

// CRUD operations

export async function createAlbum(albumDate, title = null) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    INSERT INTO Albums (album_date, title, photo_count, created_at, updated_at)
    VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  stmt.bind([albumDate, title]);
  stmt.step();
  stmt.free();

  const result = db.exec('SELECT last_insert_rowid() as id')[0];
  const id = result.values[0][0];

  await persistDB();

  return getAlbum(id);
}

export function getAlbum(albumId) {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec(
    'SELECT * FROM Albums WHERE id = ? AND deleted_at IS NULL',
    [albumId]
  );

  if (result.length === 0 || result[0].values.length === 0) return null;

  return rowToAlbum(result[0].columns, result[0].values[0]);
}

export function getAlbums(sortByCustom = true) {
  if (!db) throw new Error('Database not initialized');

  // upload_date has only second-level resolution, so ties are broken by the highest id
  // (the most recently inserted row) to deterministically pick one cover photo per album.
  const coverJoin = `
    LEFT JOIN (
      SELECT p1.album_id, p1.thumbnail_base64
      FROM Photos p1
      WHERE p1.deleted_at IS NULL
        AND p1.id = (
          SELECT p2.id FROM Photos p2
          WHERE p2.album_id = p1.album_id AND p2.deleted_at IS NULL
          ORDER BY p2.upload_date DESC, p2.id DESC
          LIMIT 1
        )
    ) cover ON cover.album_id = a.id
  `;

  let query;
  if (sortByCustom) {
    query = `
      SELECT a.*, cover.thumbnail_base64 AS cover_thumbnail_base64 FROM Albums a
      LEFT JOIN AlbumOrder ao ON a.id = ao.album_id
      ${coverJoin}
      WHERE a.deleted_at IS NULL
      ORDER BY COALESCE(ao.position, -1) ASC, a.album_date DESC
    `;
  } else {
    query = `
      SELECT a.*, cover.thumbnail_base64 AS cover_thumbnail_base64 FROM Albums a
      ${coverJoin}
      WHERE a.deleted_at IS NULL
      ORDER BY a.album_date DESC
    `;
  }

  const result = db.exec(query);
  if (result.length === 0) return [];

  return result[0].values.map((row) => rowToAlbum(result[0].columns, row));
}

export function getPhotos(albumId, offset = 0, limit = 50) {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec(
    `SELECT * FROM Photos WHERE album_id = ? AND deleted_at IS NULL
     ORDER BY upload_date DESC LIMIT ? OFFSET ?`,
    [albumId, limit, offset]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row) => rowToPhoto(result[0].columns, row));
}

export function getAllPhotos({ favoritesOnly = false, offset = 0, limit = 50 } = {}) {
  if (!db) throw new Error('Database not initialized');

  const favoriteClause = favoritesOnly ? 'AND p.is_favorite = 1' : '';

  const result = db.exec(
    `SELECT p.*, a.album_date, a.title AS album_title FROM Photos p
     JOIN Albums a ON a.id = p.album_id
     WHERE p.deleted_at IS NULL AND a.deleted_at IS NULL ${favoriteClause}
     ORDER BY p.photo_date DESC, p.upload_date DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row) => rowToPhoto(result[0].columns, row));
}

export async function createPhoto(albumId, photoData) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(`
    INSERT INTO Photos (
      album_id, filename, file_size, mime_type, photo_date, upload_date,
      photo_data_base64, thumbnail_base64, exif_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  stmt.bind([
    albumId,
    photoData.filename,
    photoData.file_size,
    photoData.mime_type,
    photoData.photo_date || null,
    photoData.photo_data_base64,
    photoData.thumbnail_base64 || null,
    photoData.exif_json ? JSON.stringify(photoData.exif_json) : null
  ]);

  stmt.step();
  stmt.free();

  const result = db.exec('SELECT last_insert_rowid() as id')[0];
  const id = result.values[0][0];

  // Increment album photo count
  db.run('UPDATE Albums SET photo_count = photo_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [albumId]);

  await persistDB();

  return getPhoto(id);
}

export function getPhoto(photoId) {
  if (!db) throw new Error('Database not initialized');

  const result = db.exec('SELECT * FROM Photos WHERE id = ? AND deleted_at IS NULL', [photoId]);

  if (result.length === 0 || result[0].values.length === 0) return null;

  return rowToPhoto(result[0].columns, result[0].values[0]);
}

export async function deletePhoto(photoId, hard = false) {
  if (!db) throw new Error('Database not initialized');

  const photo = getPhoto(photoId);
  if (!photo) throw new Error('Photo not found');

  if (hard) {
    db.run('DELETE FROM Photos WHERE id = ?', [photoId]);
  } else {
    db.run('UPDATE Photos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [photoId]);
  }

  // Decrement album photo count
  db.run(
    'UPDATE Albums SET photo_count = photo_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [photo.album_id]
  );

  await persistDB();
}

export async function toggleFavorite(photoId) {
  if (!db) throw new Error('Database not initialized');

  const photo = getPhoto(photoId);
  if (!photo) throw new Error('Photo not found');

  const newValue = photo.is_favorite ? 0 : 1;
  db.run('UPDATE Photos SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    newValue,
    photoId
  ]);

  await persistDB();

  return getPhoto(photoId);
}

export async function deleteAlbum(albumId, hard = false) {
  if (!db) throw new Error('Database not initialized');

  const album = getAlbum(albumId);
  if (!album) throw new Error('Album not found');

  if (hard) {
    db.run('DELETE FROM Photos WHERE album_id = ?', [albumId]);
    db.run('DELETE FROM AlbumOrder WHERE album_id = ?', [albumId]);
    db.run('DELETE FROM Albums WHERE id = ?', [albumId]);
  } else {
    db.run('UPDATE Photos SET deleted_at = CURRENT_TIMESTAMP WHERE album_id = ?', [albumId]);
    db.run('DELETE FROM AlbumOrder WHERE album_id = ?', [albumId]);
    db.run('UPDATE Albums SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [albumId]);
  }

  await persistDB();
}

export async function updateAlbumOrder(albumId, newPosition) {
  if (!db) throw new Error('Database not initialized');

  // Get total albums
  const totalResult = db.exec(
    'SELECT COUNT(*) as total FROM Albums WHERE deleted_at IS NULL'
  );
  const total = totalResult[0].values[0][0];

  if (newPosition < 0 || newPosition >= total) {
    throw new Error(`Invalid position. Must be between 0 and ${total - 1}`);
  }

  // Get all albums with current order
  const albumsResult = db.exec(`
    SELECT a.id FROM Albums a
    LEFT JOIN AlbumOrder ao ON a.id = ao.album_id
    WHERE a.deleted_at IS NULL
    ORDER BY COALESCE(ao.position, -1) ASC, a.album_date DESC
  `);

  const albumIds = albumsResult[0].values.map((row) => row[0]);

  // Find current position of album
  const currentPosition = albumIds.indexOf(albumId);
  if (currentPosition === -1) throw new Error('Album not found');

  // Remove from current position
  albumIds.splice(currentPosition, 1);

  // Insert at new position
  albumIds.splice(newPosition, 0, albumId);

  // Update AlbumOrder table
  db.run('DELETE FROM AlbumOrder');
  for (let i = 0; i < albumIds.length; i++) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO AlbumOrder (album_id, position, last_modified_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.bind([albumIds[i], i]);
    stmt.step();
    stmt.free();
  }

  await persistDB();
}

// Helper functions

function rowToAlbum(columns, row) {
  const obj = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });
  return obj;
}

function rowToPhoto(columns, row) {
  const obj = {};
  columns.forEach((col, idx) => {
    if (col === 'exif_json' && row[idx]) {
      obj[col] = JSON.parse(row[idx]);
    } else {
      obj[col] = row[idx];
    }
  });
  return obj;
}
