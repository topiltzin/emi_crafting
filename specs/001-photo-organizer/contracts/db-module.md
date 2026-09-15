# Contract: db Module (Database Layer)

**Purpose**: Encapsulates all SQLite database initialization, queries, and persistence.

**File**: `src/modules/db.js`

---

## Exports

### `initDB(): Promise<Database>`

Initialize SQLite database, create schema if needed, and return database instance.

**Signature**:
```javascript
async function initDB()
```

**Returns**: 
- `Promise<Database>` - Active sql.js Database instance with schema ready

**Side Effects**:
- Creates or loads database from IndexedDB
- Creates all tables (Albums, Photos, AlbumOrder) if schema doesn't exist
- Creates indexes for performance

**Throws**:
- `Error` if database initialization fails

**Example**:
```javascript
const db = await initDB();
// db is now ready for queries
```

---

### `getAlbums(sortByCustom?: boolean): Promise<Album[]>`

Fetch all active albums, optionally sorted by custom order or chronological date.

**Signature**:
```javascript
async function getAlbums(sortByCustom = true)
```

**Parameters**:
- `sortByCustom` (boolean, default true): If true, sort by AlbumOrder.position; if false, sort by album_date DESC

**Returns**:
- `Promise<Album[]>` - Array of album objects with photo_count

**Throws**:
- `Error` if query fails

**Example**:
```javascript
const albums = await getAlbums(); // Custom order if exists, else chronological
const chronological = await getAlbums(false); // Always chronological
```

---

### `getAlbum(albumId: number): Promise<Album | null>`

Fetch single album by ID.

**Signature**:
```javascript
async function getAlbum(albumId)
```

**Parameters**:
- `albumId` (number): Album ID

**Returns**:
- `Promise<Album | null>` - Album object or null if not found

**Throws**:
- `Error` if query fails

---

### `createAlbum(albumDate: string, title?: string): Promise<Album>`

Create new album for given date.

**Signature**:
```javascript
async function createAlbum(albumDate, title)
```

**Parameters**:
- `albumDate` (string, required): ISO 8601 date (YYYY-MM-DD)
- `title` (string, optional): User-assigned title

**Returns**:
- `Promise<Album>` - Created album object with id

**Throws**:
- `Error` if album_date already exists (UNIQUE constraint)
- `Error` if date format invalid

**Example**:
```javascript
const album = await createAlbum('2026-09-14', 'Handcraft Workshop');
```

---

### `deleteAlbum(albumId: number, hard?: boolean): Promise<void>`

Delete album (soft delete by default).

**Signature**:
```javascript
async function deleteAlbum(albumId, hard = false)
```

**Parameters**:
- `albumId` (number): Album ID
- `hard` (boolean, default false): If true, permanent deletion; if false, soft delete

**Returns**:
- `Promise<void>`

**Side Effects**:
- If soft delete: sets deleted_at timestamp
- If hard delete: removes album and all associated photos
- Removes AlbumOrder record (cascade)

**Throws**:
- `Error` if album not found
- `Error` if deletion fails

---

### `updateAlbumOrder(albumId: number, newPosition: number): Promise<void>`

Update custom sort order for album (used by drag-drop).

**Signature**:
```javascript
async function updateAlbumOrder(albumId, newPosition)
```

**Parameters**:
- `albumId` (number): Album ID
- `newPosition` (number): New position (0-indexed)

**Returns**:
- `Promise<void>`

**Side Effects**:
- Inserts/updates AlbumOrder record
- Reorders adjacent albums atomically
- Updates Album.updated_at

**Throws**:
- `Error` if album not found
- `Error` if position invalid or duplicate

**Example**:
```javascript
// Move album to position 2 (third position)
await updateAlbumOrder(albumId, 2);
```

---

### `getPhotos(albumId: number, offset?: number, limit?: number): Promise<Photo[]>`

Fetch photos for album with pagination.

**Signature**:
```javascript
async function getPhotos(albumId, offset = 0, limit = 50)
```

**Parameters**:
- `albumId` (number): Album ID
- `offset` (number, default 0): Pagination offset
- `limit` (number, default 50): Max photos to return

**Returns**:
- `Promise<Photo[]>` - Array of photo objects (includes thumbnail, not full photo_data)

**Throws**:
- `Error` if album not found
- `Error` if query fails

**Example**:
```javascript
const photos = await getPhotos(albumId, 0, 50); // First 50 photos
```

---

### `getPhoto(photoId: number): Promise<Photo | null>`

Fetch single photo by ID (includes full photo_data).

**Signature**:
```javascript
async function getPhoto(photoId)
```

**Parameters**:
- `photoId` (number): Photo ID

**Returns**:
- `Promise<Photo | null>` - Photo object with full photo_data (base64) or null if not found

**Throws**:
- `Error` if query fails

---

### `createPhoto(albumId: number, photoData: object): Promise<Photo>`

Create new photo record in album.

**Signature**:
```javascript
async function createPhoto(albumId, photoData)
```

**Parameters**:
- `albumId` (number): Album ID
- `photoData` (object, required): Photo data object with properties:
  - `filename` (string, required)
  - `file_size` (number, required)
  - `mime_type` (string, required)
  - `photo_date` (string, optional): ISO 8601 date
  - `photo_data_base64` (string, required): Full photo as base64
  - `thumbnail_base64` (string, optional): Thumbnail as base64
  - `exif_json` (object, optional): Raw EXIF metadata

**Returns**:
- `Promise<Photo>` - Created photo object with id

**Side Effects**:
- Increments Album.photo_count
- Updates Album.updated_at

**Throws**:
- `Error` if album not found
- `Error` if required fields missing
- `Error` if data validation fails

**Example**:
```javascript
const photo = await createPhoto(albumId, {
  filename: 'IMG_1234.jpg',
  file_size: 2048000,
  mime_type: 'image/jpeg',
  photo_date: '2026-09-14',
  photo_data_base64: '...',
  thumbnail_base64: '...',
  exif_json: { ... }
});
```

---

### `deletePhoto(photoId: number, hard?: boolean): Promise<void>`

Delete photo from album (soft delete by default).

**Signature**:
```javascript
async function deletePhoto(photoId, hard = false)
```

**Parameters**:
- `photoId` (number): Photo ID
- `hard` (boolean, default false): If true, permanent deletion; if false, soft delete

**Returns**:
- `Promise<void>`

**Side Effects**:
- If soft delete: sets deleted_at timestamp
- Decrements Album.photo_count
- Updates Album.updated_at
- If album becomes empty: (handled by business logic, not DB)

**Throws**:
- `Error` if photo not found
- `Error` if deletion fails

---

### `persistDB(): Promise<void>`

Explicitly save database to IndexedDB (usually automatic, but can force).

**Signature**:
```javascript
async function persistDB()
```

**Returns**:
- `Promise<void>`

**Side Effects**:
- Writes entire database to IndexedDB

**Throws**:
- `Error` if persistence fails

---

## Data Types

### Album

```javascript
{
  id: number,
  album_date: string,       // ISO 8601 (YYYY-MM-DD)
  title: string | null,
  photo_count: number,
  sort_order: number | null,
  created_at: string,       // ISO 8601 datetime
  updated_at: string,       // ISO 8601 datetime
  deleted_at: string | null
}
```

### Photo

```javascript
{
  id: number,
  album_id: number,
  filename: string,
  file_size: number,
  mime_type: string,
  photo_date: string | null,     // ISO 8601 (YYYY-MM-DD)
  upload_date: string,           // ISO 8601 datetime
  photo_data_base64: string,     // Full image data
  thumbnail_base64: string | null,
  exif_json: object | null,
  created_at: string,
  updated_at: string,
  deleted_at: string | null
}
```

---

## Error Handling

All database functions throw `Error` with descriptive messages:

- `"Album with date {date} already exists"` - UNIQUE constraint violation
- `"Album {id} not found"` - Record not found
- `"Database initialization failed: {reason}"` - Init error
- `"Query failed: {SQL error message}"` - SQL execution error

---

## Testing

Unit tests must verify:
- Schema creation on first init
- CRUD operations for albums and photos
- Pagination with offset/limit
- Cascade deletes (album deletion removes photos)
- Transaction atomicity (album reorder updates)
- Error cases (duplicate dates, missing albums, invalid data)
- Soft delete filtering (deleted_at correctly filters)
