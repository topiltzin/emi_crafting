# Contract: Tutorial Link UI Component

**Date**: 2026-09-20

**Purpose**: Define the user interface contract for tutorial linking modal, cards, and interactions

---

## Modal: Add/Edit Tutorial Link

### Trigger
- Button: "Add Tutorial Link" (when no tutorial linked) OR "Edit" (when tutorial exists)
- Location: Photo detail view, near photo metadata
- Icon: Optional pencil (✏️) or plus (+)

### Modal Structure

```
┌────────────────────────────────────┐
│ Add Tutorial Link              ✕   │  ← Close button
├────────────────────────────────────┤
│                                    │
│ Paste YouTube URL:                 │
│ ┌────────────────────────────────┐ │
│ │ https://youtube.com/watch?v=   │ │  ← Input field
│ │ (autofocus on open)            │ │
│ └────────────────────────────────┘ │
│                                    │
│ [Preview Section - shown if URL    │
│  valid and metadata fetched]       │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [Thumbnail]  Video Title       │ │
│ │              Creator • 3:32    │ │  ← Metadata preview
│ │ ┌──────────────────────────────┐ │
│ │ │ Loading metadata...          │ │  ← While fetching
│ │ └──────────────────────────────┘ │
│ └────────────────────────────────┘ │
│                                    │
│ Error message (if any):            │
│ ┌────────────────────────────────┐ │
│ │ ⚠️  Not a valid YouTube URL.   │ │
│ │    Try: youtube.com/watch?v=.. │ │
│ └────────────────────────────────┘ │
│                                    │
│ [Cancel]  [Save]                   │  ← Buttons
│                                    │
└────────────────────────────────────┘
```

### Input Field Specification

**Name**: YouTube URL Input

**Type**: Text input

**Placeholder**: "Paste YouTube URL here"

**Autofocus**: Yes (cursor in field when modal opens)

**Character Limit**: 2000 (arbitrary, covers any YouTube URL)

**Behavior**:
- Accept any text; validation happens on blur/save
- Clear on modal close (if not saved)
- Prefill with existing URL when editing (read-only initially?)
- Support paste (Ctrl+V / Cmd+V)

### Preview Section

**Shown when**:
- URL is valid and metadata fetched successfully
- OR metadata is currently loading (show spinner)

**Contents**:

| Element | Type | Content | Optional |
|---------|------|---------|----------|
| Thumbnail | Image | YouTube thumbnail (320×180 or medium size) | No |
| Title | Text | Video title (max 1 line, truncate with ellipsis if needed) | No |
| Creator | Text | Channel name | No |
| Duration | Text | Formatted duration (e.g., "3 min 32 sec") | No |
| Loading State | Spinner | "Fetching metadata..." message | Yes |

**Styling**:
- Border: Subtle gray border or shadow
- Background: Lighter shade than modal background
- Padding: 12px around content
- Gap between thumbnail and text: 8px

### Error Display

**When error occurs**:
- Show error message in red or warning color
- Icon: ⚠️ or ❌
- Message text: User-friendly (see research.md for examples)
- Suggestion: Optional line suggesting corrective action
- Position: Below input field, above preview section

**Error Types**:
1. "Not a valid YouTube URL. Try: youtube.com/watch?v=..."
2. "Video not found. It may have been deleted or made private."
3. "Network timeout. Retry?"
4. "YouTube quota exceeded. Try again tomorrow."

### Buttons

**Cancel Button**:
- Label: "Cancel"
- Action: Close modal without saving, discard input
- Style: Secondary (gray/transparent)

**Save Button**:
- Label: "Save" or "Update" (if editing)
- Action: Persist tutorial link to database
- Disabled when: URL is empty OR invalid (before fetch)
- Disabled while: Metadata is fetching (show "Saving..." text)
- Style: Primary (color-accented)
- After save: Close modal, show confirmation

### States

| State | Input Field | Preview | Save Button | Behavior |
|-------|-------------|---------|-------------|----------|
| Empty | Empty input, focused | Hidden | Disabled | Wait for user input |
| Invalid URL | URL text | Hidden | Disabled | Show error on blur/save |
| Loading | URL text | "Loading..." spinner | Disabled (text: "Fetching...") | Fetching from API |
| Valid + Fetched | URL text | Preview displayed | Enabled | Ready to save |
| Error | URL text | Hidden | Disabled | Show error message |
| Saving | URL text | Preview | Disabled (text: "Saving...") | Updating database |

---

## Tutorial Card: Display on Photo Detail

### Location
- Photo detail view, below photo or in dedicated "Tutorial" section
- Positioned: Below metadata section, above delete/share buttons

### Structure (When Tutorial Linked)

```
┌──────────────────────────────────────┐
│ TUTORIAL LINKED:                     │  ← Header (optional)
├──────────────────────────────────────┤
│ [Thumbnail] Title                    │
│             Creator • Duration       │
│                                      │  ← Clickable thumbnail/card
│ [Open YouTube in new tab]            │  ← Hover state shows cue
│                                      │
│ [Edit]  [Delete]                     │  ← Action buttons
└──────────────────────────────────────┘
```

### Card Elements

| Element | Content | Size | Interaction |
|---------|---------|------|-------------|
| Thumbnail | YouTube medium thumbnail (320×180) | 80×45 px (aspect ratio preserved) | Clickable → open YouTube |
| Title | Video title (truncate if >60 chars) | Max width 200px | Clickable → open YouTube |
| Creator | Channel name | Gray text, smaller font | Not clickable |
| Duration | Formatted time (e.g., "3 min 32 sec") | Gray badge or text | Not clickable |
| Edit Button | "Edit" or pencil icon (✏️) | 32×32 px | Opens edit modal |
| Delete Button | "Delete" or trash icon (🗑️) | 32×32 px | Delete with optional confirmation |

### Hover/Focus States

**Thumbnail Hover**:
- Opacity: 0.8 (slight darken)
- Cursor: pointer
- Tooltip: "Watch video on YouTube"

**Card Focus** (for accessibility):
- Outline: 2px solid focus color (typically blue)
- Border radius: 4px

### States

| State | Display | Content |
|-------|---------|---------|
| **Linked - Normal** | Full card | Thumbnail, title, creator, duration, edit/delete buttons |
| **Linked - Video Deleted** | Card with "unavailable" label | Thumbnail + "Video unavailable" message, edit/delete still available |
| **Linked - No Metadata** | Card with placeholder | Generic thumbnail icon, "YouTube Video" title, edit button to retry |
| **No Tutorial** | Empty state | "Add Tutorial Link" CTA button (see below) |

### Empty State (No Tutorial Linked)

```
┌──────────────────────────────────────┐
│ 🎬 Add Tutorial Link                 │  ← Icon + text or button
│                                      │
│ "Link a YouTube tutorial showing how │
│ you made this craft"                 │
│                                      │
│ [Add Tutorial Link]                  │  ← Button
│                                      │
└──────────────────────────────────────┘
```

---

## Badge: Tutorial Indicator on Photo Grid Card

### Location
- Photo card in gallery/grid view (Home, My Photos, or Album view)
- Top-right corner or center overlay

### Design Options

**Option A: Badge Badge**
```
[Photo Thumbnail]
       🎬  ← Small badge in corner
```

**Option B: Overlay Label**
```
[Photo Thumbnail]
┌──────────────────┐
│ Tutorial linked  │  ← Small label overlay
└──────────────────┘
```

**Option C: Subtle Indicator**
```
[Photo Thumbnail]
─ ─ ─ ─ ─ ─ ─ ─ ─ ← Colored border or bottom strip
(colored strip or border)
```

### Badge Behavior
- **Hover**: Optional tooltip "Tutorial video linked"
- **Click**: Open photo detail (same as clicking photo itself), NOT modal
- **Style**: Subtle, don't distract from photo
- **Color**: Accent color (brand purple/pink from design system)

---

## Interactions: User Actions

### Action: Add Tutorial Link
```
User clicks "Add Tutorial Link" button
  ↓
Modal opens (input focused, no data)
  ↓
User pastes YouTube URL
  ↓
System fetches metadata (if valid URL)
  ↓
Preview appears in modal
  ↓
User clicks Save
  ↓
Modal closes
  ↓
Tutorial card appears on detail view
  ↓
Badge appears on photo grid card
```

### Action: View Tutorial
```
User views photo detail (with tutorial linked)
  ↓
Tutorial card visible
  ↓
User clicks thumbnail or title
  ↓
YouTube opens in new browser tab
  ↓
Modal remains open in original tab
```

### Action: Edit Tutorial
```
User clicks "Edit" button on tutorial card
  ↓
Edit modal opens (previous URL prefilled)
  ↓
User pastes new YouTube URL
  ↓
System fetches new metadata
  ↓
User clicks Save
  ↓
Modal closes
  ↓
Tutorial card updates with new video info
```

### Action: Delete Tutorial
```
User clicks "Delete" button on tutorial card
  ↓
Optional confirmation dialog: "Remove tutorial link?"
  ↓
User confirms
  ↓
Tutorial card disappears
  ↓
"Add Tutorial Link" CTA reappears
  ↓
Badge removed from photo grid card
```

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through modal inputs/buttons
- Escape key closes modal without saving
- Enter key in URL input triggers fetch
- Enter key in Save button submits form
- Focus trap: Keep focus within modal while open

### Screen Reader Support
- Modal has `role="dialog"` and `aria-modal="true"`
- Input field has associated `<label>` or `aria-label`
- Error messages have `role="alert"` for announcement
- Buttons have descriptive text (not just icons)
- Tutorial card has `role="article"` or similar
- Thumbnail link has `aria-label="Watch video on YouTube"`

### Color Contrast
- Text on background: WCAG AA (4.5:1 for normal text)
- Links: Distinguish via underline or other means (not color alone)
- Error message: Red + icon (not red text alone)

### Focus Indicators
- Visible focus ring (outline) on all interactive elements
- Focus ring color: High contrast (typically blue)
- Focus ring width: 2-3px

---

## Responsive Behavior

### Desktop (>768px)
- Modal width: 500px (fixed)
- Buttons: Side-by-side (Cancel | Save)
- Thumbnail in preview: 80px

### Tablet (481-768px)
- Modal width: 90% of viewport (with margins)
- Buttons: Stack vertically if needed
- Thumbnail: 70px

### Mobile (<480px)
- Modal width: 95% of viewport (with margins)
- Buttons: Stack vertically, full width
- Input field: Full width
- Thumbnail: 60px
- Tutorial card: Adapt to narrow width (stack vertically if needed)

---

## Error States & Recovery

### Invalid URL Error
```
┌────────────────────────────────────┐
│ Add Tutorial Link              ✕   │
├────────────────────────────────────┤
│ Paste YouTube URL:                 │
│ ┌────────────────────────────────┐ │
│ │ https://example.com            │ │  ← User's input
│ └────────────────────────────────┘ │
│                                    │
│ ⚠️  Not a valid YouTube URL.        │  ← Error message
│ Try: youtube.com/watch?v=..        │
│                                    │
│ [Cancel]  [Save]                   │  ← Save still accessible to retry
└────────────────────────────────────┘
```

Recovery: User can edit URL and retry save

### Network Timeout Error
```
Error message: "Network timeout. Retry?"

Options:
1. User clicks Retry button (exponential backoff)
2. User clicks Cancel to close modal
3. Allow manual entry of title (Phase 2)
```

### Video Not Found Error
```
Error message: "Video not found on YouTube. It may have been deleted 
or made private. Try another video?"

State:
- Modal stays open
- URL field not cleared
- User can paste different video URL
- User can cancel without saving
```

---

## Testing Checklist

- [ ] Modal opens/closes correctly
- [ ] Input field autofocuses
- [ ] Valid URL triggers metadata fetch
- [ ] Invalid URL shows error
- [ ] Error message is clear and helpful
- [ ] Preview displays correctly when metadata fetched
- [ ] Save button disabled until valid
- [ ] Tutorial card displays after save
- [ ] Edit button opens modal with existing URL
- [ ] Delete button removes tutorial link
- [ ] Badge displays on photo grid card
- [ ] Click card (not badge) opens detail view
- [ ] Keyboard navigation works (Tab, Escape, Enter)
- [ ] Screen reader announces modal and inputs
- [ ] Mobile responsive (works on small screens)
- [ ] Touch-friendly button sizes (44×44px minimum)

