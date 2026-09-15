# Photo Organizer - Quick Start Guide

**Get up and running in 5 minutes!**

---

## 🚀 Installation

### Option 1: Development Server (for testing)

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open browser to http://localhost:5173
```

### Option 2: Production Build (for deployment)

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# 3. Serve the ./dist directory
# Upload dist/ contents to your web server
# Or run locally with: npm run preview
```

---

## 📸 Your First Upload (2 minutes)

### Step 1: Launch the App
- Open http://localhost:5173 in your browser
- You'll see the main page with "+ Upload Photos" button

### Step 2: Select Photos
- Click **"+ Upload Photos"** button
- Select photos from your computer (JPEG, PNG, or WebP)
- Select multiple photos at once if you want

### Step 3: Watch Magic Happen
- Photos upload automatically
- Albums created by date
- Main page shows album grid
- Each card shows: date, photo count, thumbnail

### Step 4: Explore Your Albums
- Click **"View"** on any album to see photos
- Photos display in responsive tile grid
- Scroll to see all photos
- Click **"← Back to Albums"** to return

---

## 🎯 Core Features (30-second overview)

### Organize Photos
```
Upload photos → Auto-group by date → See albums on main page
```

### Reorder Albums
```
Drag album card → Drop on new position → Order saved
```

### View Photos
```
Click "View" → See tile grid → Browse photos → Go back
```

### Clean Up
```
Delete photo: Hover over tile → Click "Delete"
Delete album: Click "Delete" on album card
```

---

## ⌨️ Keyboard Shortcuts

| Action | Keys |
|--------|------|
| Upload photos | Click button (keyboard coming soon) |
| Navigate | Tab ↹ between elements |
| Activate buttons | Enter ↵ or Space |
| Drag-drop albums | Mouse drag (keyboard coming soon) |

---

## 🎨 Customize Your Experience

### Dark Mode
- App auto-detects your system preference
- Windows: Settings → Personalization → Colors
- Mac: System Preferences → General → Appearance
- Linux: Theme settings (varies by desktop)

### Responsive Design
- **Mobile** (< 768px): 1 column
- **Tablet** (768-1024px): 2 columns  
- **Desktop** (1024-1440px): 3 columns
- **Large** (> 1440px): 4 columns

Try resizing your browser window to see responsive layout change!

---

## 🔍 Tips & Tricks

### Photo Organization Best Practices
- **Upload by date**: Keep photos grouped chronologically
- **Backup first**: Store originals before relying on browser storage
- **Regular cleanup**: Delete old albums to free up storage

### Browser Tips
- **Private browsing**: Good for sensitive photos, but data doesn't persist
- **Multiple browsers**: Each browser has separate storage
- **Storage limit**: Browser can hold ~50MB (~400-500 photos)

### Performance Tips
- **Batch uploads**: Upload in groups of 10-20 files
- **Smaller files**: Resize large photos before uploading
- **Clean cache**: Clear browser cache occasionally

---

## ⚙️ Configuration

### Environment Variables
Create `.env.local` for development:
```
VITE_LOG_LEVEL=debug  # For debugging
```

### Browser Storage
- All data stored in IndexedDB
- No configuration needed
- Storage persists until you clear browser data

### Themes
- Light theme: Automatically used in light mode
- Dark theme: Automatically used in dark mode
- No manual configuration needed

---

## 🧪 Testing (if you want to verify)

### Run Tests
```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Check coverage
npm run coverage
```

### Test Cases Included
- ✅ 24 test cases covering core features
- ✅ Database operations
- ✅ Photo upload workflow
- ✅ Album reordering
- ✅ EXIF extraction

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "Page won't load" | Clear browser cache, check http://localhost:5173 |
| "Photos disappeared" | Browser storage was cleared, they're not recoverable |
| "Drag-drop not working" | Use Chrome/Firefox, try refreshing page |
| "Can't upload files" | Check file format (JPEG/PNG/WebP only) |
| "Date grouping wrong" | EXIF data missing, uses upload date as fallback |

---

## 📚 Learn More

- **Full Release Notes**: See RELEASE_NOTES.md
- **Implementation Details**: See IMPLEMENTATION_REVIEW.md
- **Architecture**: See plan.md and data-model.md in specs/001-photo-organizer/
- **Testing**: See tests/ directory

---

## 🎓 Project Structure

```
photo-organizer/
├── src/
│   ├── main.js           # Entry point
│   ├── app.js            # App controller
│   ├── modules/          # Business logic
│   ├── ui/               # UI components
│   ├── styles/           # CSS
│   └── models/           # Data models
├── tests/                # Test files
├── package.json          # Dependencies
├── vite.config.js        # Build config
└── index.html            # HTML entry
```

---

## 🚀 Next Steps

### Try It Out
1. Upload some photos
2. Drag-drop albums to reorder
3. Explore on mobile (responsive!)
4. Enjoy dark mode

### Give Feedback
- What works great?
- What would you add next?
- Any bugs or issues?

### Future Features (v1.1+)
- Photo editing
- Advanced filtering
- Cloud sync (optional)

---

## 💡 Pro Tips

✨ **Tip 1**: Upload handcraft work photos by project date for easy organization

✨ **Tip 2**: Use dark mode if taking photos in low light

✨ **Tip 3**: Regularly back up your photos outside the browser

✨ **Tip 4**: Drag-drop is intuitive — try reordering albums by importance

✨ **Tip 5**: Works offline — once loaded, no internet needed

---

## 🎉 You're Ready!

You now have a fully functional photo organizer running locally on your computer!

**Happy organizing!**

---

**Need help?**
- Check RELEASE_NOTES.md for troubleshooting
- Review IMPLEMENTATION_REVIEW.md for technical details
- Questions? The code is well-documented

**v1.0.0 - Production Ready** ✅
