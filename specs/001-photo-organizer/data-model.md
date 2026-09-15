# Data Model: Photo Organizer

**Date**: 2026-09-14

**Purpose**: Define entities, relationships, schema, and state transitions for the photo organizer application

---

## Database Schema

### Table: Albums

Represents a collection of photos grouped by date.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique album identifier |
| `album_date` | DATE | NOT NULL, UNIQUE | Date used for grouping (YYYY-MM-DD format) |
| `title` | TEXT | OPTIONAL | User-assigned album title (default: formatted date) |
| `photo_count` | INTEGER | DEFAULT 0 | Denormalized count for display performance |
| `sort_order` | INTEGER | DEFAULT NULL | Custom sort position on main page (NULL = chronological) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Album creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification timestamp |
| `deleted_at` | DATETIME | DEFAULT NULL | Soft delete marker (NULL = active) |

**Relationships**:
- Contains many Photos (one-to-many)
- Cannot be nested in other albums (flat hierarchy only)

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `album_date` (ensures one album per date)
- INDEX on `sort_order` (for custom ordering queries)
- INDEX on `deleted_at` (for soft delete filtering)

**Validation Rules**:
- `album_date` must be valid ISO 8601 date (YYYY-MM-DD)
- `title` max length 255 characters
- `photo_count` must be >= 0
- `sort_order` must be unique among active albums (or NULL)

---

### Table: Photos

Individual photo files and metadata.

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique photo identifier |
| `album_id` | INTEGER | NOT NULL, FOREIGN KEY | Reference to Albums(id) |
| `filename` | TEXT | NOT NULL | Original filename (e.g., "IMG_1234.jpg") |
| `file_size` | INTEGER | NOT NULL | File size in bytes |
| `mime_type` | TEXT | NOT NULL | MIME type (image/jpeg, image/png) |
| `photo_date` | DATE | OPTIONAL | Photo date from EXIF, NULL if unavailable |
| `upload_date` | DATETIME | NOT NULL | When photo was uploaded to album |
| `photo_data_base64` | LONGTEXT | NOT NULL | Photo data as base64-encoded string |
| `thumbnail_base64` | LONGTEXT | OPTIONAL | Thumbnail data (base64, ~150x150px) |
| `exif_json` | JSON | OPTIONAL | Raw EXIF metadata as JSON object |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Photo record creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification timestamp |
| `deleted_at` | DATETIME | DEFAULT NULL | Soft delete marker (NULL = active) |

**Relationships**:
- Belongs to exactly one Album (many-to-one)
- Cannot reference other photos

**Indexes**:
- PRIMARY KEY on `id`
- FOREIGN KEY on `album_id` (with CASCADE DELETE or soft delete only)
- INDEX on `album_id` (for querying photos by album)
- INDEX on `upload_date` (for ordering within album)
- INDEX on `deleted_at` (for soft delete filtering)

**Validation Rules**:
- `album_id` must reference existing active album
- `filename` max length 255 characters
- `file_size` must be > 0
- `mime_type` must be image/jpeg or image/png (or image/webp post-MVP)
- `photo_date` must be valid ISO 8601 date if provided (YYYY-MM-DD)
- `photo_data_base64` must be valid base64 string
- `exif_json` must be valid JSON object if provided

---

### Table: AlbumOrder

Tracks custom sort order on main page (for drag-and-drop persistence).

| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Record identifier |
| `album_id` | INTEGER | NOT NULL, UNIQUE, FOREIGN KEY | Reference to Albums(id) |
| `position` | INTEGER | NOT NULL, UNIQUE | Sort position (0-indexed) |
| `last_modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last drag-drop operation |

**Relationships**:
- References Albums (one-to-one custom ordering)

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `album_id`
- UNIQUE on `position` (ensures no gaps, no duplicates)

**Validation Rules**:
- `album_id` must reference existing active album
- `position` must be >= 0 and < total album count
- Cannot have duplicate positions

**Business Logic**:
- When album is deleted, its AlbumOrder record is also deleted (cascade)
- When album is reordered, positions of adjacent albums are updated atomically
- When no custom order exists (all positions NULL), albums display by `album_date` DESC (most recent first)

---

## Entity Relationships Diagram

```
Albums (1)
  ↓ (1-to-many)
Photos (many)

Albums (1)
  ↓ (1-to-1)
AlbumOrder (1, optional)
```

---

## State Transitions

### Album Lifecycle

```
[Created] 
  ↓
[Active with Photos]
  ↓
[Empty] (all photos deleted)
  ↓
[Deleted / Auto-removed]
```

**States**:
- **Created**: Album exists but has no photos yet (from upload initiation)
- **Active**: Album has ≥1 photos, displayed on main page
- **Empty**: All photos removed, album marked for deletion or kept for future use
- **Deleted**: Soft delete (deleted_at != NULL) or hard delete if user confirms

**Transitions**:
- Created → Active: When first photo uploaded
- Active → Empty: When last photo deleted
- Empty → Deleted: Auto-delete after N seconds, or manual deletion
- Any → Active: When photo added to archived/empty album

---

### Photo Lifecycle

```
[Uploaded]
  ↓
[In Album]
  ↓
[Deleted] (soft delete)
  ↓
[Permanently Removed] (optional hard delete)
```

**States**:
- **Uploaded**: Photo received, EXIF extracted, album assigned
- **In Album**: Photo visible in album tile grid
- **Deleted**: Soft delete (deleted_at != NULL), not displayed but recoverable
- **Permanently Removed**: Hard delete from database

**Transitions**:
- Uploaded → In Album: Automatically on successful upload
- In Album → Deleted: On user delete action (soft delete)
- Deleted → Permanently Removed: Optional hard delete or auto-cleanup (post-MVP)

---

## Key Data Flows

### Photo Upload Flow

```
User selects files
  ↓
File validation (mime type, size)
  ↓
Extract EXIF metadata
  ↓
Determine album_date (from EXIF photo_date or upload_date)
  ↓
Find or create Album with album_date
  ↓
Generate thumbnail (canvas-based resize)
  ↓
Convert photo to base64
  ↓
Insert Photo record into database
  ↓
Increment Album.photo_count
  ↓
Update Album.updated_at
  ↓
Re-render album grid
```

### Album Reordering (Drag-Drop) Flow

```
User drags Album A to new position
  ↓
Detect drop zone, validate drop position
  ↓
Update AlbumOrder positions atomically
  ↓
Update Album.updated_at for affected albums
  ↓
Persist to SQLite
  ↓
Re-render main page with new order
```

### Album Display Flow

```
App loads
  ↓
Query: SELECT * FROM Albums WHERE deleted_at IS NULL ORDER BY sort_order, album_date DESC
  ↓
For each album, SELECT COUNT(*) FROM Photos WHERE album_id = X AND deleted_at IS NULL
  ↓
Render album cards with photo count and album date
  ↓
On album click, fetch Photos for that album and render tile grid
```

---

## Constraints & Guarantees

### Data Integrity

- **Referential Integrity**: Foreign key constraints enforced at database level
- **Uniqueness**: One album per date (album_date UNIQUE), one sort order per position
- **Atomicity**: Album updates and photo insertions are atomic transactions
- **Validation**: All input data validated before insertion (type, range, format)

### Soft Deletes

- Photos and Albums use `deleted_at` timestamp for soft deletes
- Active records filtered by `WHERE deleted_at IS NULL`
- Soft deletes allow recovery (post-MVP feature)
- Hard delete possible after N days of soft deletion (configurable)

### Performance Optimizations

- **Denormalization**: Album.photo_count kept in sync to avoid COUNT(*) queries
- **Indexes**: Critical paths indexed (album_date, album_id, sort_order)
- **Lazy Loading**: Photos loaded only when album viewed (not on main page load)
- **Pagination**: Large albums paginated in tile grid (50 photos per page) to avoid UI lag

### Multi-Tab Consistency

- SQLite + IndexedDB handles concurrent browser tab access
- Refresh synchronizes with database (sql.js loads from IndexedDB)
- Conflicting updates: Last-write-wins or manual merge (TBD in implementation)

---

## Migration Considerations

### Version 1.0 Schema

Initial release. No migration needed (greenfield).

### Future Versions (Post-MVP)

- Add `cloud_sync_status` to albums (for eventual cloud backup feature)
- Add `tags` column to Albums (for filtering beyond date)
- Add `collections` table if nested grouping is desired (backwards-incompatible)
- Add `photo_rotations` for EXIF orientation handling
- Add `duplicates` table to track similar photos

---

## Testing & Validation

### Unit Test Coverage

- Schema initialization and DDL validation
- CRUD operations for each entity
- Foreign key constraint enforcement
- Uniqueness constraints
- State transition validation

### Integration Test Coverage

- Photo upload → Album creation → Album display
- Album reordering → Persistence → Reload validation
- Photo deletion → Album count decrement → Display update
- Large dataset performance (100+ photos, 20+ albums)

### Edge Cases

- Empty album deletion
- Duplicate filename handling (append timestamp)
- EXIF missing/corrupted metadata fallback
- Concurrent edits (tab 1 uploads while tab 2 reorders)
- Database quota exceeded (IndexedDB limit ~50MB)
