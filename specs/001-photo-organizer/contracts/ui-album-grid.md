# Contract: album-grid UI Module (Main Page)

**Purpose**: Render main page album grid, handle drag-drop reordering, and respond to user interactions.

**File**: `src/ui/album-grid.js`

---

## Exports

### `renderAlbumGrid(albums: Album[]): HTMLElement`

Render the main album grid display.

**Signature**:
```javascript
function renderAlbumGrid(albums)
```

**Parameters**:
- `albums` (Array<Album>): Array of album objects from database

**Returns**:
- `HTMLElement` - Grid container element (ready to append to DOM)

**Structure** (expected):
```html
<div class="album-grid" data-total-albums="${albums.length}">
  <div class="album-card" draggable="true" data-album-id="${album.id}">
    <img class="album-thumbnail" src="data:image/jpeg;base64,${firstPhotoThumb}" alt="${album.title}">
    <h3 class="album-title">${album.title || formatDate(album.album_date)}</h3>
    <p class="album-count">${album.photo_count} photos</p>
    <div class="album-actions">
      <button class="btn-view" data-album-id="${album.id}">View</button>
      <button class="btn-delete" data-album-id="${album.id}">Delete</button>
    </div>
  </div>
  <!-- repeat for each album -->
</div>
```

**Accessibility**:
- Album cards are keyboard-focusable (tabindex handled)
- ARIA labels: `aria-label="Album: {date}, {count} photos"`
- Delete button requires confirmation dialog

**Side Effects**:
- Attaches drag-drop event listeners to album cards
- Attaches click listeners to "View" and "Delete" buttons
- Does NOT modify database (that's caller's responsibility)

**Example**:
```javascript
const albums = await getAlbums();
const gridElement = renderAlbumGrid(albums);
document.querySelector('main').innerHTML = '';
document.querySelector('main').appendChild(gridElement);
```

---

### `attachDragDropHandlers(gridElement: HTMLElement, onReorder: Function): void`

Attach drag-and-drop event handlers to album grid for reordering.

**Signature**:
```javascript
function attachDragDropHandlers(gridElement, onReorder)
```

**Parameters**:
- `gridElement` (HTMLElement): Album grid container
- `onReorder` (Function): Callback when drop succeeds. Signature: `onReorder(albumId, newPosition)`

**Returns**:
- `void`

**Event Handlers Attached**:
- `dragstart` on album cards: Set drag image, store dragged album ID
- `dragover` on album cards: Allow drop, show insertion indicator
- `drop` on album cards: Validate drop, call onReorder callback
- `dragend` on album cards: Clean up visual feedback

**Visual Feedback**:
- Dragging album: opacity 0.5, custom cursor
- Drag over target: border highlight, insertion line
- Drop invalid: snap back to original position

**Drag Data Structure** (internal):
```javascript
event.dataTransfer.effectAllowed = 'move';
event.dataTransfer.setData('text/html', albumCardHTML);
// Also store: draggedAlbumId = album.id
```

**Throws**:
- `Error` if gridElement not found or invalid

**Example**:
```javascript
const gridElement = renderAlbumGrid(albums);
attachDragDropHandlers(gridElement, async (albumId, newPosition) => {
  await updateAlbumOrder(albumId, newPosition);
  // Caller handles re-render
});
```

---

### `onAlbumCardClick(event: Event, onViewAlbum: Function, onDeleteAlbum: Function): void`

Handle clicks on album cards (View or Delete buttons).

**Signature**:
```javascript
function onAlbumCardClick(event, onViewAlbum, onDeleteAlbum)
```

**Parameters**:
- `event` (Event): Click event object
- `onViewAlbum` (Function): Callback when "View" clicked. Signature: `onViewAlbum(albumId)`
- `onDeleteAlbum` (Function): Callback when "Delete" clicked. Signature: `onDeleteAlbum(albumId)`

**Returns**:
- `void`

**Behavior**:
- If "View" button clicked: Call `onViewAlbum(albumId)`
- If "Delete" button clicked: Show confirmation dialog, call `onDeleteAlbum(albumId)` if confirmed
- Stops event propagation to prevent double-handling

**Confirmation Dialog**:
- Message: "Delete album and all photos? This cannot be undone."
- Buttons: Cancel, Delete

**Example**:
```javascript
document.addEventListener('click', (event) => {
  onAlbumCardClick(event,
    (albumId) => {
      // View album
      loadAlbumView(albumId);
    },
    (albumId) => {
      // Delete album
      deleteAlbum(albumId);
      reloadMainPage();
    }
  );
});
```

---

### `getAlbumThumbnail(album: Album): string`

Extract first photo thumbnail for album card display.

**Signature**:
```javascript
function getAlbumThumbnail(album)
```

**Parameters**:
- `album` (Album): Album object (note: doesn't include photos list, needs DB query)

**Returns**:
- `string` - Base64 data URL (e.g., "data:image/jpeg;base64,...") or fallback placeholder URL

**Side Effects**:
- Queries database for first photo thumbnail (caller may optimize with prefetch)

**Throws**:
- `Error` if album not found

**Example**:
```javascript
const thumbUrl = await getAlbumThumbnail(album);
// Use in <img src="${thumbUrl}">
```

---

### `formatAlbumDate(dateString: string): string`

Format album date for display.

**Signature**:
```javascript
function formatAlbumDate(dateString)
```

**Parameters**:
- `dateString` (string): ISO 8601 date (YYYY-MM-DD)

**Returns**:
- `string` - Formatted date (e.g., "September 14, 2026" or "Sep 14, '26")

**Localization**: Uses browser locale (Intl.DateTimeFormat)

**Example**:
```javascript
formatAlbumDate('2026-09-14') // "September 14, 2026"
```

---

### `calculateGridLayout(windowWidth: number): { columns: number, gap: string }`

Calculate responsive grid layout based on viewport width.

**Signature**:
```javascript
function calculateGridLayout(windowWidth)
```

**Parameters**:
- `windowWidth` (number): Viewport width in pixels

**Returns**:
- `object`: `{ columns: number, gap: string }`
  - `columns`: Number of columns (1-4 depending on width)
  - `gap`: CSS gap value (e.g., "1rem", "2rem")

**Breakpoints**:
- < 768px: 1 column (mobile)
- 768-1024px: 2 columns (tablet)
- 1024-1440px: 3 columns (laptop)
- ≥ 1440px: 4 columns (large desktop)

**Example**:
```javascript
const layout = calculateGridLayout(window.innerWidth);
gridElement.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
gridElement.style.gap = layout.gap;
```

---

## Data Flow

### Initialization

```
Main app loads
  ↓
getAlbums() from database
  ↓
renderAlbumGrid(albums)
  ↓
attachDragDropHandlers(gridElement, updateCallback)
  ↓
Append gridElement to DOM
  ↓
Listen for window resize (recalculate layout)
```

### Drag-Drop Flow

```
User drags Album A over Album B
  ↓
dragover event: Show insertion indicator, calculate new position
  ↓
User drops Album A
  ↓
drop event: Validate position, call onReorder(albumId, newPosition)
  ↓
onReorder calls updateAlbumOrder() in database
  ↓
Database persists new order
  ↓
Main app re-renders grid with new order
```

### View/Delete Album Flow

```
User clicks "View" on Album
  ↓
onAlbumCardClick() detects "View" button
  ↓
Calls onViewAlbum(albumId)
  ↓
Main app loads album-view module
  ↓
Render individual album with photos in tiles

--- OR ---

User clicks "Delete" on Album
  ↓
onAlbumCardClick() detects "Delete" button
  ↓
Show confirmation dialog
  ↓
User confirms
  ↓
Calls onDeleteAlbum(albumId)
  ↓
Main app calls deleteAlbum() from db module
  ↓
Re-render album grid without deleted album
```

---

## CSS Classes (Expected)

- `.album-grid` - Main grid container
- `.album-card` - Individual album card
- `.album-card.dragging` - During drag (opacity, cursor)
- `.album-card.drag-over` - Drop target (border, insertion line)
- `.album-thumbnail` - Album cover image
- `.album-title` - Album date/title text
- `.album-count` - Photo count badge
- `.album-actions` - Action buttons container
- `.btn-view`, `.btn-delete` - Action buttons

---

## Performance Considerations

- **Lazy Load Thumbnails**: Don't fetch all thumbnails on grid load; load on demand or use intersection observer
- **Virtualization**: For 100+ albums, consider virtual scrolling (render only visible cards)
- **Debounce Resize**: Recalculate grid layout only on resize completion (debounce 300ms)
- **Prevent Layout Shift**: Reserve space for album cards (aspect ratio CSS)

---

## Accessibility Checklist

- [ ] Album cards keyboard-navigable (Tab, Enter to expand)
- [ ] Drag-drop has keyboard fallback (arrow keys to move, post-MVP)
- [ ] ARIA labels on all interactive elements
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] Focus indicators visible on hover/focus
- [ ] Confirmation dialogs accessible (focus trapping)
- [ ] Photo counts read by screen readers

---

## Testing

Unit tests must verify:
- Grid renders with correct number of cards
- Drag-drop events fire and update positions correctly
- View/Delete buttons call correct callbacks
- Responsive layout calculation matches breakpoints
- Empty album list renders empty state
- Date formatting works for various locales
- Keyboard navigation works (post-MVP)
