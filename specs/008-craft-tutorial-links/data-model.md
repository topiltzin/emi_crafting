# Data Model: Craft Tutorial Links

**Date**: 2026-09-20

**Scope**: Define entities, relationships, validation rules, and state transitions for tutorial linking feature

---

## Entities

### 1. Photo (Extended)

**Description**: Existing photo entity, extended with optional tutorial link field

**Fields**:

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| id | UUID | No | crypto.randomUUID() | Primary key | Existing field |
| owner_id | UUID | No | — | Foreign key → users | Existing field |
| album_id | UUID | No | — | Foreign key → albums | Existing field |
| filename | String | No | — | Max 255 chars | Existing field |
| file_size | Integer | No | — | > 0 bytes | Existing field |
| mime_type | String | No | — | One of: image/jpeg, image/png, image/webp | Existing field |
| photo_date | ISO 8601 | No | — | Valid date | Existing field |
| storage_path | String | No | — | Supabase bucket path | Existing field |
| thumbnail_storage_path | String | Yes | NULL | Supabase bucket path | Existing field |
| exif_json | JSON | Yes | NULL | Valid EXIF data | Existing field |
| deleted_at | Timestamp | Yes | NULL | Soft delete flag | Existing field |
| updated_at | Timestamp | No | NOW() | Last modified | Existing field |
| created_at | Timestamp | No | NOW() | Creation time | Existing field |
| **tutorial_link** | **JSONB** | **Yes** | **NULL** | **Embedded object** | **NEW FIELD** |

**Tutorial Link Structure** (when present):

```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ",
  "title": "RickRoll Full Video",
  "creator": "The Rick Astley Show",
  "channelId": "UCZLooOQkVB6F4FKkrfmDzRA",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 211,
  "addedAt": "2026-09-20T14:30:00Z"
}
```

**Validation Rules**:
- `url`: Must be valid YouTube URL (checked before storage)
- `videoId`: Exactly 11 alphanumeric characters + underscore/hyphen
- `title`: Max 255 characters, non-empty
- `creator`: Max 255 characters, non-empty
- `channelId`: Exactly 24 characters, alphanumeric
- `thumbnail`: Must be valid HTTPS URL
- `duration`: Positive integer (seconds), ≤ 12 hours (43200 seconds)
- `addedAt`: ISO 8601 timestamp, must be ≤ current time

**Backward Compatibility**:
- Existing photos have `tutorial_link = NULL`
- Column is optional; queries work with or without field
- No migration needed for existing data
- Queries must use `IS NULL` or `.ne('tutorial_link', null)` for filtering

---

### 2. TutorialLink (Embedded Entity)

**Description**: Represents the connection between a photo and a YouTube video; embedded within Photo

**Lifecycle**:
- **Created**: When user submits YouTube URL in modal → metadata fetched → stored
- **Updated**: When user edits URL → old metadata replaced with new video's metadata
- **Deleted**: When user clicks delete → tutorial_link field set to NULL
- **Orphaned**: If parent photo deleted → tutorial_link also deleted (cascade)

**Data Dependency**:
- Cannot exist without associated Photo
- Deleted when Photo is deleted (soft or hard)
- One tutorial link per photo (1:1 relationship)

**Timestamp Semantics**:
- `addedAt`: When user first linked this video (preserved on edits? TBD)
  - Recommendation: Update on edit (track latest tutorial, not original)
  - Alternative: Keep original (track learning history)
  - For MVP: Update on edit (simpler mental model)

---

### 3. Creator/Channel (Derived Entity)

**Description**: Aggregated view of unique YouTube creators/channels across user's tutorial-linked photos

**Derivation**: Created from unique `channelId` values in tutorial_link fields across all photos

**Structure** (used in Phase 2):
```javascript
{
  channelId: "UCZLooOQkVB6F4FKkrfmDzRA",
  name: "The Rick Astley Show",
  thumbnail: "https://yt3.googleusercontent.com/...",
  photoCount: 5,
  firstLinkedAt: "2026-09-15T10:00:00Z",
  lastLinkedAt: "2026-09-20T14:30:00Z"
}
```

**Storage**: No separate table needed
- Computed on-demand when user views "Tutorials" tab
- Query: Distinct channelIds from all user's tutorial_link fields, grouped with counts
- Performance: <2 sec for 500 photos (index on channelId helps)

**Relationships**:
- Creator 1:N Photos (one creator linked in many photos)
- Bidirectional via channelId in tutorial_link

---

## Relationships

### Photo ↔ TutorialLink (1:1, optional)

```
┌─────────────────────────────┐
│ Photo                       │
├─────────────────────────────┤
│ id: UUID                    │
│ owner_id: UUID              │
│ album_id: UUID              │
│ filename: String            │
│ ...                         │
│ tutorial_link: JSONB (NULL) │── Contains ─────────────→ TutorialLink
└─────────────────────────────┘                         ┌──────────────────┐
                                                        │ {url, videoId,   │
                                                        │  title, creator, │
                                                        │  channelId, ...} │
                                                        └──────────────────┘
```

**Constraints**:
- Photo can exist without TutorialLink (NULL)
- TutorialLink cannot exist without Photo
- Each Photo has at most one TutorialLink
- When Photo deleted, TutorialLink also deleted

**Cascade Behavior**:
- Delete Photo → Delete TutorialLink (implicit, field is cleared)
- Delete TutorialLink → No impact on Photo (field set to NULL)

### Photo ← User → Creator (Many:Many, via TutorialLink)

```
User
  ├─ owns ─→ Photo 1 ─→ has tutorial by ─→ Creator A
  ├─ owns ─→ Photo 2 ─→ has tutorial by ─→ Creator A
  ├─ owns ─→ Photo 3 ─→ has tutorial by ─→ Creator B
  └─ owns ─→ Photo 4 ─→ (no tutorial)
```

**Query Examples**:
- "All photos by user X linked to Creator Y": Filter by `owner_id=X` AND `tutorial_link->channelId=Y`
- "All creators used by user X": Distinct `tutorial_link->channelId` where `owner_id=X`

---

## State Transitions

### Photo Lifecycle with Tutorial Link

```
[No Tutorial]
      ↓
   User clicks "Add Tutorial Link"
      ↓
   [Modal Open - User Enters URL]
      ↓
   System fetches metadata (success)
      ↓
   [Modal Shows Preview]
      ↓
   User clicks Save
      ↓
   [Tutorial Link Saved to DB]
      ↓
   [Display on Card/Detail View]
      ↓
   User can Edit or Delete
      ↓
   [Back to No Tutorial] or [Different Tutorial]
```

### Detailed States

| State | Condition | UI Display | Available Actions |
|-------|-----------|-----------|------------------|
| No Tutorial | tutorial_link == NULL | "Add Tutorial Link" CTA | Add |
| Tutorial Linked | tutorial_link != NULL | Card with thumbnail, title, creator | View, Edit, Delete |
| Metadata Pending | tutorial_link exists but only has URL (API still loading) | "Loading..." spinner | Cancel |
| Metadata Unavailable | tutorial_link has URL but no title/thumbnail (API failed) | URL + "Try again?" button | Edit, Retry, Delete |
| Video Deleted | tutorial_link exists but YouTube returns 404 | Cached metadata + "Video unavailable" label | Edit, Delete |

---

## Indexes & Query Optimization

### Indexes Needed

**For MVP (Phase 1)**:
- Existing index on `photos.owner_id` (filters user's photos)
- Existing index on `photos.album_id` (filters album's photos)
- No new indexes strictly required (JSONB query not performance-critical yet)

**For Phase 2 (if needed)**:
- Index on `tutorial_link->>'channelId'` (for filtering by creator)
  ```sql
  CREATE INDEX idx_photos_tutorial_link_channel_id 
  ON photos USING GIN ((tutorial_link -> 'channelId'));
  ```

**Query Patterns**:
1. "Get single photo": `SELECT * FROM photos WHERE id = $1` → Covers by primary key
2. "Get all user's photos": `SELECT * FROM photos WHERE owner_id = $1 ORDER BY photo_date DESC` → Uses index on owner_id
3. "Get photos by creator": `SELECT * FROM photos WHERE owner_id = $1 AND tutorial_link->>'channelId' = $2` → Sequential scan OK for MVP (small dataset)
4. "Get unique creators": `SELECT DISTINCT tutorial_link->>'channelId' FROM photos WHERE owner_id = $1` → Sequential scan, acceptable for <1000 photos

---

## Persistence & Storage

### Column Definition (PostgreSQL/Supabase)

```sql
ALTER TABLE photos ADD COLUMN tutorial_link JSONB DEFAULT NULL;

-- Optional: Add constraint to validate structure
ALTER TABLE photos ADD CONSTRAINT check_tutorial_link_structure CHECK (
  tutorial_link IS NULL OR (
    tutorial_link->>'url' IS NOT NULL AND
    tutorial_link->>'videoId' IS NOT NULL AND
    LENGTH(tutorial_link->>'videoId') = 11 AND
    tutorial_link->>'title' IS NOT NULL AND
    tutorial_link->>'creator' IS NOT NULL AND
    tutorial_link->>'channelId' IS NOT NULL AND
    LENGTH(tutorial_link->>'channelId') = 24 AND
    tutorial_link->>'thumbnail' IS NOT NULL AND
    (tutorial_link->>'duration')::integer > 0
  )
);
```

### Migration Strategy

**Phase 1 Migration**:
```sql
-- Add column (non-breaking, NULL by default)
ALTER TABLE photos ADD COLUMN tutorial_link JSONB DEFAULT NULL;

-- No data migration needed (existing photos get NULL)
```

**Rollback**:
```sql
-- If needed: DROP COLUMN tutorial_link CASCADE;
```

---

## Access Patterns

### Create Tutorial Link

```javascript
// Frontend
async function saveTutorialLink(photoId, youtubeUrl) {
  const metadata = await fetchYoutubeMetadata(youtubeUrl);
  
  const tutorialLink = {
    url: youtubeUrl,
    videoId: metadata.videoId,
    title: metadata.title,
    creator: metadata.creator,
    channelId: metadata.channelId,
    thumbnail: metadata.thumbnail,
    duration: metadata.duration,
    addedAt: new Date().toISOString()
  };
  
  await supabase
    .from('photos')
    .update({ tutorial_link: tutorialLink })
    .eq('id', photoId);
}
```

### Read Tutorial Link

```javascript
// Frontend: Display on photo detail
async function getPhotoWithTutorial(photoId) {
  const { data: photo } = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .single();
  
  if (photo.tutorial_link) {
    // Render tutorial card
    displayTutorialCard(photo.tutorial_link);
  } else {
    // Show "Add Tutorial Link" CTA
    showAddTutorialCTA();
  }
}
```

### Update Tutorial Link

```javascript
// Same as Create (upsert/update operation)
async function updateTutorialLink(photoId, youtubeUrl) {
  // Fetch new metadata for new URL
  const metadata = await fetchYoutubeMetadata(youtubeUrl);
  const tutorialLink = { ...metadata, addedAt: new Date().toISOString() };
  
  await supabase
    .from('photos')
    .update({ tutorial_link: tutorialLink })
    .eq('id', photoId);
}
```

### Delete Tutorial Link

```javascript
// Frontend: Remove tutorial from photo
async function removeTutorialLink(photoId) {
  await supabase
    .from('photos')
    .update({ tutorial_link: null })
    .eq('id', photoId);
}
```

### Query by Creator (Phase 2)

```javascript
async function getPhotosByCreator(ownerId, channelId) {
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('tutorial_link->channelId', channelId)
    .order('photo_date', { ascending: false });
  
  return photos;
}
```

### Get Unique Creators (Phase 2)

```javascript
async function getCreatorsForUser(ownerId) {
  const { data: photos } = await supabase
    .from('photos')
    .select('tutorial_link')
    .eq('owner_id', ownerId)
    .not('tutorial_link', 'is', null);
  
  const creators = {};
  photos.forEach(photo => {
    const { channelId, name, thumbnail } = photo.tutorial_link;
    if (!creators[channelId]) {
      creators[channelId] = { 
        channelId, 
        name, 
        thumbnail, 
        photoCount: 0 
      };
    }
    creators[channelId].photoCount++;
  });
  
  return Object.values(creators);
}
```

---

## Validation Rules Summary

**At Time of Creation/Update**:
- URL must be valid YouTube format (validated in research.md)
- VideoId must be exactly 11 chars (or extracted from URL)
- Title, creator must be non-empty and ≤255 chars
- ChannelId must be exactly 24 chars
- Thumbnail must be valid HTTPS URL (or YouTube CDN URL)
- Duration must be positive integer, ≤43200 (12 hours)
- addedAt must be ISO 8601 timestamp ≤ current time

**On Read**:
- If tutorial_link exists but video not found (API returns 404), show graceful "Video unavailable" message
- If tutorial_link exists but thumbnail URL 404s, show fallback placeholder
- No validation errors should break the UI

---

## Testing Considerations

**Unit Tests**:
- Extract videoId from various URL formats
- Validate videoId/channelId format
- Parse ISO 8601 duration
- Cascade deletion (photo delete → tutorial_link deleted)

**Integration Tests**:
- Create photo → Add tutorial link → Verify stored in DB
- Update photo → Edit tutorial link → Verify metadata refreshed
- Delete photo → Verify tutorial_link also deleted
- Query photos by creator → Verify filtering works

**End-to-End Tests**:
- User adds tutorial → Card displays → Click opens YouTube
- User edits tutorial → New video metadata loads → Card updates
- User deletes tutorial → "Add Tutorial Link" CTA reappears

