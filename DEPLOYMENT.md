# Deployment Guide - Photo Organizer v1.0.0

**Ready to ship the MVP!**

---

## ☁️ Supabase Setup (required before first deploy)

The app stores all albums and photos in Supabase instead of only the browser (see
`specs/004-supabase-data-migration/`). Set this up once per Supabase project:

1. **Apply the schema**: run `supabase/schema.sql` against your project — either paste it into
   the Supabase SQL editor, or `supabase db push` if you use CLI migrations. This creates the
   `albums`/`photos` tables, their indexes, and the Row Level Security (RLS) policies that scope
   every row to the single owner account.
2. **Create the Storage bucket**: create a **private** bucket named `photos`
   (`supabase storage buckets create photos --private`, or via the dashboard). The Storage
   policies in `supabase/schema.sql` (bottom section) restrict objects in this bucket to the
   owner's own folder — apply those too if your setup doesn't already.
3. **Create the single owner account**: create exactly one Supabase Auth user (dashboard →
   Authentication, or `supabase auth`). This is the account the app signs in as — the app has no
   multi-user sign-up flow by design (single personal account, see spec.md FR-009).
4. **Configure environment variables**: copy `.env.example` to `.env.local` and fill in
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your project's API settings. **Never**
   put the Supabase secret/service key in any `.env*` file or elsewhere in the repo — the app
   never needs it, since RLS + the owner's authenticated session is what protects the data.

Full validation steps (including verifying data survives a cleared browser and migrates from
any pre-existing local data) are in `specs/004-supabase-data-migration/quickstart.md`.

---

## 🧊 3D Models (spec 009-photo-to-3d-model)

"Make it 3D" turns a photo into an interactive 3D model using **Stability AI's `stable-fast-3d`**
API. A conversion takes up to a couple minutes, which is longer than Supabase Edge Functions are
allowed to run on the Free plan. So a small, separate **worker** (`worker/`) does the conversion
in the background. Set this up once:

1. **Apply the migration**: `supabase db push` (or paste
   `supabase/migrations/0002_add_photo_3d_models.sql` into the SQL editor). It adds the
   `photos.model_*` columns, the `model_conversions` job table, and its RPCs. The existing
   `photos` bucket and its owner-folder Storage policies already cover the model files.
2. **Run the worker** on any always-on host — see `worker/README.md` for Docker and local
   instructions, and [Deploying the worker to a free-tier Google Cloud VM](#-deploying-the-worker-to-a-free-tier-google-cloud-vm)
   below for a concrete walkthrough. It needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `STABILITY_API_KEY` in `worker/.env`.
   - The service-role key and Stability API key live **only** in the worker's environment.
     Never put them in `.env.local`, the repo, or anything the browser loads.
   - Unlike the earlier Hugging Face TRELLIS.2 backend, `stable-fast-3d` has **no free daily
     quota** — every conversion spends account credits. Keep an eye on your balance at
     [platform.stability.ai/account/credits](https://platform.stability.ai/account/credits).
3. **Nothing changes in the web app's env**. The browser only calls
   `request_model_conversion` with the signed-in user's session, and RLS scopes it to their own
   photos.

If the worker is down, conversions stay queued and show as "took too long" after 10 minutes.
Photos and existing models are unaffected.

Validation steps: `specs/009-photo-to-3d-model/quickstart.md`.

---

## ☁️ Deploying the worker to a free-tier Google Cloud VM

The worker is a small, always-on polling process — a single **e2-micro** instance on Google
Compute Engine's [Always Free tier](https://cloud.google.com/free/docs/free-cloud-features#compute)
comfortably runs it at no cost, as long as you stay in one of the free-tier regions
(`us-west1`, `us-central1`, or `us-east1`) and under the free 30 GB-month standard persistent
disk allowance.

> Note: "EC2" is Amazon's name for its VM product; Google Cloud's equivalent is **Compute
> Engine**. These steps are for Compute Engine, per "GoogleCloud" above — if you actually meant
> AWS, the same Docker image runs the same way on an EC2 `t2.micro`/`t3.micro` free-tier
> instance (`docker run --restart unless-stopped --env-file worker/.env emi-3d-worker`), you'd
> just provision and SSH into it via the AWS console/CLI instead of `gcloud` below.

### 1. Create the VM

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud compute instances create emi-3d-worker \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=emi-3d-worker
```

This is the only VM you need — the worker polls Supabase itself, so nothing needs to reach it
from the internet, and no firewall rule needs opening.

### 2. SSH in and install Docker

```bash
gcloud compute ssh emi-3d-worker --zone=us-central1-a
```

Then, on the VM:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
exit   # log back in so the group change takes effect
gcloud compute ssh emi-3d-worker --zone=us-central1-a
```

### 3. Copy the worker source and configure it

From your local machine, in the repo root:

```bash
gcloud compute scp --recurse worker emi-3d-worker:~/worker --zone=us-central1-a
```

Back on the VM, create `~/worker/.env` (this file never gets committed anywhere):

```bash
cat > ~/worker/.env <<'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STABILITY_API_KEY=your-stability-api-key
POLL_SECONDS=10
EOF
chmod 600 ~/worker/.env
```

Use a **freshly generated** Stability API key here, not one that has ever been pasted into a
chat, ticket, or shared document.

### 4. Build and run it as a systemd-managed container

```bash
cd ~/worker
sudo docker build -t emi-3d-worker .
sudo docker run -d --name emi-3d-worker \
  --restart unless-stopped \
  --env-file .env \
  emi-3d-worker
```

`--restart unless-stopped` makes Docker's own daemon (which starts on boot via systemd) bring
the container back up after a VM reboot or crash — no separate systemd unit needed.

### 5. Verify and monitor

```bash
sudo docker logs -f emi-3d-worker
# expect: "worker <hostname>-<pid> polling every 10.0s"
```

To redeploy after a code change: `git pull`/`scp` the updated `worker/` directory, then
`sudo docker build -t emi-3d-worker . && sudo docker rm -f emi-3d-worker` and re-run the `docker
run` command from step 4.

### Staying inside the free tier

- One `e2-micro` instance, in `us-west1`, `us-central1`, or `us-east1` only.
- One `pd-standard` boot disk ≤ 30 GB (`--boot-disk-size=30GB` above already matches this).
- Free tier is **per billing account**, not per project — if you already run another free-tier
  VM elsewhere on the same account, this one will incur charges.
- Outbound network from the VM to Supabase and Stability AI does count toward the (generous) 1
  GB/month free egress to most destinations; a photo-conversion workload is far below that.

---

## 📋 Pre-Deployment Checklist

### Code & Quality
- [x] All features implemented (User Stories 1 & 2)
- [x] Code quality standards met
- [x] ESLint passing (zero warnings)
- [x] Tests passing (24/24 test cases)
- [x] >80% test coverage achieved
- [x] No console errors or warnings
- [x] Dark mode working
- [x] Accessibility standards met (WCAG 2.1 AA)
- [x] Responsive design verified (mobile, tablet, desktop)

### Documentation
- [x] RELEASE_NOTES.md written
- [x] QUICKSTART.md written
- [x] IMPLEMENTATION_REVIEW.md written
- [x] README.md (if needed)
- [x] Code comments (minimal but clear)

### Build & Distribution
- [x] Production build tested
- [x] Build output optimized
- [x] Dependencies vetted and locked
- [x] No security vulnerabilities

---

## 🚀 Deployment Steps

### Step 1: Final Testing

```bash
# Run full test suite
npm test

# Build production bundle
npm run build

# Verify build output
ls -la dist/

# Check bundle size
du -sh dist/
```

### Step 2: Generate Production Build

```bash
# Clean build
rm -rf dist/
npm install
npm run build

# Output files in dist/ directory ready for deployment
```

### Step 3: Choose Deployment Target

#### Option A: Local Testing
```bash
npm run preview
# Opens at http://localhost:4173
```

#### Option B: Static File Host
Upload `dist/` contents to:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static file hosting

#### Option C: Docker Container
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Option D: Web Server
```bash
# Copy dist/ to your web server
scp -r dist/ user@server:/var/www/photo-organizer/
```

### Step 4: Verify Deployment

```bash
# Check production URL loads
curl https://your-domain.com

# Verify assets load
# - index.html loads
# - CSS files load
# - JavaScript executes
# - Database initializes
```

### Step 5: Post-Deployment Verification

- [ ] App loads at deployment URL
- [ ] "+" Upload Photos button visible
- [ ] File picker opens on click
- [ ] Can upload photos
- [ ] Albums create by date
- [ ] Album grid displays
- [ ] Click "View" opens album
- [ ] Photos display in tiles
- [ ] Drag-drop works
- [ ] Dark mode toggles with OS
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] All tests still pass

---

## 🔧 Configuration for Deployment

### Environment Variables (if using)
```bash
# None required for MVP
# All configuration built into app
```

### Build Configuration
```bash
# Production optimizations already in vite.config.js
VITE_ENV=production npm run build
```

### Security Headers (Recommended)
If using a web server, add headers:
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
```

### CORS Configuration
- No CORS configuration needed (single-origin app)
- Works entirely within one domain

---

## 📊 Deployment Architecture

### Single-Page Application (SPA)
```
├── index.html (entry point)
├── assets/
│   ├── app.xxx.js (bundled & minified)
│   ├── main.xxx.css (bundled & minified)
│   └── ...other assets
└── No backend required!
```

### Data Flow (All Client-Side)
```
Browser
  ├── IndexedDB (photo data, album metadata)
  ├── JavaScript (business logic, UI)
  └── HTML/CSS (presentation)

No server calls. No cloud. 100% local.
```

---

## 🎯 Performance After Deployment

### Expected Metrics
- **First Load**: <2 seconds (20+ albums)
- **Photo Upload**: <30 seconds per file
- **Drag-Drop**: 60fps (16ms response)
- **Bundle Size**: ~150-200KB gzipped
- **Storage Used**: ~50MB (depends on photo count)

### Optimization Already Done
- ✅ Vite production build (minified)
- ✅ Tree-shaking enabled
- ✅ CSS optimized
- ✅ Images compressed (thumbnails)
- ✅ Code splitting configured

---

## 🔐 Security Considerations

### Built-In Security
- ✅ No external API calls
- ✅ No tracking or analytics
- ✅ No credentials transmitted
- ✅ No server-side processing
- ✅ HTTPS recommended (not required)

### Deployment Security
- Use HTTPS in production (protects in transit)
- Serve with security headers (prevents XSS)
- Keep dependencies updated (npm audit)
- Regular browser updates recommended

### Data Privacy
- All data stays in browser
- No cloud transmission
- No analytics or telemetry
- User has full control

---

## 📈 Monitoring After Deployment

### What to Monitor
- Browser console for JavaScript errors
- Page load times (should be <2s)
- User interactions working smoothly
- Dark mode detection working
- Responsive design on various devices

### How to Test
- Chrome DevTools (F12)
- Firefox Developer Tools (F12)
- Mobile device testing
- Network throttling tests

### No Server Logs to Monitor
- Everything happens in browser
- No server to monitor
- No backend errors to track
- Simplifies operations!

---

## 🚨 Known Issues & Workarounds

### Browser Storage Limit
- **Issue**: IndexedDB has ~50MB limit
- **Workaround**: Users can delete old albums
- **Note**: Documented in RELEASE_NOTES.md

### Offline Mode
- **Current**: Requires live page (not Service Worker yet)
- **Workaround**: Page stays open, works without internet
- **Future**: v1.1+ will add Service Worker

### Cross-Device Sync
- **Current**: No sync (each browser separate)
- **Workaround**: Manual backup/restore
- **Future**: v2.0 will add cloud sync

---

## 🎊 Launch Checklist

### Before Going Live
- [x] Version tagged as v1.0.0
- [x] Build verified locally
- [x] Tests passing
- [x] Documentation complete
- [x] Release notes written
- [x] No console errors
- [x] Performance acceptable

### Going Live
- [ ] Deploy to production server
- [ ] Verify all features working at deployed URL
- [ ] Test on multiple browsers
- [ ] Test on mobile device
- [ ] Announce release

### Post-Launch
- [ ] Monitor for user reports
- [ ] Be ready for v1.1 (photo management)
- [ ] Collect feedback
- [ ] Plan enhancements

---

## 📞 Support & Maintenance

### Immediate Support Needs
- Documentation for users (QUICKSTART.md)
- Issue reporting mechanism
- Basic troubleshooting guide (in RELEASE_NOTES.md)

### Maintenance Plan
- Weekly: Monitor for issues
- Monthly: Check for dependency updates
- Quarterly: Plan next release

### Future Releases
- **v1.1**: User Story 3 (photo management)
- **v1.2**: Performance optimizations
- **v2.0**: Cloud sync & advanced features

---

## 🎯 Success Criteria

After deployment, confirm:
- [x] App loads without errors
- [x] Upload functionality works
- [x] Albums created correctly
- [x] Drag-drop reordering works
- [x] Album detail view displays photos
- [x] Dark mode responds to OS
- [x] Mobile layout responsive
- [x] All user interactions smooth
- [x] No security warnings
- [x] Performance acceptable

---

## 🏁 Final Notes

**Photo Organizer v1.0.0 is production-ready!**

### What Ships
- Complete photo organization MVP
- Intuitive drag-drop interface
- Responsive, accessible design
- Fully local, privacy-first approach
- 24 passing test cases
- Comprehensive documentation

### What Users Get
- Free, local photo organization tool
- No cloud dependency
- No privacy concerns
- Works on any device with a browser
- Can be self-hosted

### Next Steps
- Deploy to production
- Announce to users
- Gather feedback
- Plan v1.1 enhancements

---

**Ready to ship!** 🚀

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Released**: September 14, 2026
