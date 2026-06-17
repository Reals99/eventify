# Eventify 🎬

**A tablet-mounted kiosk app for events** — guests tap to record their expectations before and takeaways after, and organisers can review, frame, and publish directly to social media.

---

## Features

- 🎤 **Guest kiosk** — big central tap button, video or audio recording, auto-reset
- 🎨 **Event theming** — 8 colour presets + full custom picker, applied to kiosk and frame
- 🖼️ **Frame overlay** — 5 FFmpeg-rendered frame designs (minimal, bold, elegant, neon, classic)
- ☁️ **Dual storage** — Cloudinary for primary storage, Google Drive for raw export
- 👁️ **Admin review** — watch, approve, flag, edit captions per recording
- ✨ **AI captions** — Claude generates hashtags + post descriptions from event context
- 📤 **One-click publish** — TikTok, Instagram, Facebook, X, YouTube
- 🔒 **Secure** — JWT auth, rate limiting, CORS, Helmet, bcrypt

## Tech stack

| Layer | Tool | Free tier |
|---|---|---|
| Frontend | React 18 + Vite | Vercel (free) |
| Backend | Node.js + Express | Render.com (free) |
| Database | MongoDB | Atlas M0 (512 MB free) |
| Video storage | Cloudinary | 25 GB free |
| Raw export | Google Drive API | 15 GB free |
| Video processing | FFmpeg (system) | open source |
| AI captions | Claude API (Anthropic) | pay-per-use |
| Deployment | Vercel + Render | both free |

## Quick start (local dev)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/eventify.git
cd eventify

# 2. Server
cd server
npm install
cp .env.example .env
# → Fill in MONGO_URI and JWT_SECRET at minimum
npm run dev           # runs on http://localhost:4000

# 3. Client (new terminal)
cd ../client
npm install
npm run dev           # runs on http://localhost:5173

# 4. First-time setup
# Open http://localhost:5173/admin/setup
# Create your superadmin account
```

## Deploy to production

See **[DEPLOY.md](./DEPLOY.md)** for the complete step-by-step guide.

All services used are free. Deployment takes about 30 minutes.

## Setup guides

| Guide | What it covers |
|---|---|
| [DEPLOY.md](./DEPLOY.md) | Full deployment walkthrough (Render + Vercel) |
| [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) | Connect Google Drive for raw video export |
| [SOCIAL_SETUP.md](./SOCIAL_SETUP.md) | Connect TikTok, Instagram, Facebook, X, YouTube |

## Kiosk setup (iPad/tablet)

1. Deploy the app
2. Create an event in the admin dashboard → set status to **Active**
3. Get the kiosk URL from the dashboard (e.g. `https://eventify.vercel.app/kiosk/tech-summit-2026`)
4. Open on your tablet in fullscreen / add to home screen
5. Mount at the event entrance

**iOS tip:** Use Settings → Accessibility → **Guided Access** to lock the browser to the kiosk URL.

## Project structure

```
eventify/
├── client/                    # React + Vite (→ Vercel)
│   ├── src/
│   │   ├── pages/             # AdminDashboard, AdminReview, CreateEvent, KioskPage…
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # AuthContext
│   │   ├── hooks/             # useMediaRecorder, useProcessing, useFirstRun
│   │   └── utils/             # api.js (Axios), eventConfig.js
│   └── public/                # manifest.json, PWA icons
└── server/                    # Node.js + Express (→ Render)
    ├── routes/                # auth, events, videos, ai, process, social
    ├── models/                # Admin, Event, Video, AppSettings
    ├── services/              # cloudinary, googleDrive, ffmpeg, claude
    │   └── social/            # tiktok, instagram, facebook, twitter, youtube
    └── middleware/            # auth (JWT), upload (multer)
```

## License

MIT
