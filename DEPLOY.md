# Eventify — Complete Deployment Guide

Everything you need to go from zero to a live production app. All services used are free.

---

## Architecture recap

```
Browser / iPad Kiosk
       │
       ▼
Vercel (free)          ← React + Vite frontend
       │
       ▼ /api/*
Render.com (free)      ← Node.js + Express backend
       │
       ├── MongoDB Atlas (free)     ← database
       ├── Cloudinary (free)        ← video storage
       ├── Google Drive (free)      ← raw video export
       └── Social APIs (free)       ← TikTok, Instagram, FB, X, YouTube
```

---

## Step 1 — Get the code on GitHub

```bash
cd eventify

# Initialise git
git init
git add .
git commit -m "feat: Eventify v1.0 — initial commit"

# Create repo on GitHub (https://github.com/new)
git remote add origin https://github.com/YOUR_USERNAME/eventify.git
git push -u origin main
```

---

## Step 2 — MongoDB Atlas (database)

1. Go to https://cloud.mongodb.com → **Sign up free**
2. Create a **free M0 cluster** (select a region close to your users)
3. **Database Access** → Add user:
   - Username: `eventify`
   - Password: generate a strong password
   - Role: **Read and Write to any database**
4. **Network Access** → Add IP address → **0.0.0.0/0** (allow all — required for Render)
5. **Connect** → **Drivers** → Copy the connection string:
   ```
   mongodb+srv://eventify:<password>@cluster0.xxxxx.mongodb.net/eventify?retryWrites=true&w=majority
   ```
   Replace `<password>` with your DB user password.

---

## Step 3 — Cloudinary (video storage)

1. Go to https://cloudinary.com → **Sign up free**
2. Dashboard → copy:
   - **Cloud name**
   - **API Key**
   - **API Secret**

Free tier: 25 GB storage, 25 GB monthly bandwidth. More than enough for events.

---

## Step 4 — Deploy server to Render

1. Go to https://render.com → **New → Web Service**
2. Connect your GitHub account → select your **eventify** repo
3. Settings:
   - **Name**: `eventify-server`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Free
4. Click **Advanced** → Add environment variables one by one:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `MONGO_URI` | `mongodb+srv://...` (from Step 2) |
| `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLOUDINARY_CLOUD_NAME` | from Step 3 |
| `CLOUDINARY_API_KEY` | from Step 3 |
| `CLOUDINARY_API_SECRET` | from Step 3 |
| `GOOGLE_CLIENT_ID` | from Drive setup (see GOOGLE_DRIVE_SETUP.md) |
| `GOOGLE_CLIENT_SECRET` | from Drive setup |
| `ANTHROPIC_API_KEY` | from https://console.anthropic.com |
| `CLIENT_URL` | leave blank for now — fill in after Vercel deploy |
| `SERVER_URL` | leave blank for now — fill in after Render gives you a URL |
| `GOOGLE_REDIRECT_URI` | leave blank for now |

5. Click **Create Web Service**
6. Wait for deploy (2–3 min). Note your server URL:
   ```
   https://eventify-server.onrender.com
   ```
7. Go back to **Environment** → fill in the remaining vars:
   - `SERVER_URL` = `https://eventify-server.onrender.com`
   - `GOOGLE_REDIRECT_URI` = `https://eventify-server.onrender.com/api/auth/google/callback`

8. Test: visit `https://eventify-server.onrender.com/api/health`
   ```json
   { "status": "ok", "app": "Eventify", "env": "production" }
   ```

> **Free tier note**: Render free tier spins down after 15 min of inactivity.
> First request after sleep takes ~30s. Upgrade to Starter ($7/mo) to keep it awake.
> Or use https://uptimerobot.com (free) to ping /api/health every 10 min.

---

## Step 5 — Deploy client to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables** → Add:
   - `VITE_API_URL` = `https://eventify-server.onrender.com`
5. Click **Deploy**
6. Note your Vercel URL:
   ```
   https://eventify.vercel.app
   ```

7. Go back to Render → **Environment** → update:
   - `CLIENT_URL` = `https://eventify.vercel.app`
8. Render will auto-redeploy, or manually trigger **Deploy latest commit**.

---

## Step 6 — Connect Google Drive

1. Update Google Cloud Console OAuth credentials:
   - Add redirect URI: `https://eventify-server.onrender.com/api/auth/google/callback`
2. Log into your admin dashboard at `https://eventify.vercel.app/admin`
3. Click **Connect Drive** in the nav bar
4. Complete the Google OAuth flow
5. Green **Drive connected** badge appears ✅

Full instructions: **GOOGLE_DRIVE_SETUP.md**

---

## Step 7 — Connect social platforms

See **SOCIAL_SETUP.md** for platform-specific instructions.

**Settings → Social Accounts** → connect each platform.

Update redirect URIs in each platform's developer console to use your production server URL.

---

## Step 8 — Set up GitHub Actions CI/CD (optional)

1. In your GitHub repo → **Settings → Variables → Actions**
2. Add repository variables:
   - `RENDER_DEPLOY_HOOK` — from Render: **Settings → Deploy Hook**
   - `VERCEL_DEPLOY_HOOK` — from Vercel: **Settings → Git → Deploy Hooks**
3. Every push to `main` now automatically deploys to both services.

---

## Step 9 — First event setup

1. Go to `https://eventify.vercel.app/admin/setup`
2. Create your superadmin account
3. Click **New event** → complete the 4-step wizard
4. Set event status to **Active**
5. Open the kiosk URL on your tablet:
   ```
   https://eventify.vercel.app/kiosk/your-event-slug
   ```
6. Mount the tablet at the event entrance — done! 🎉

---

## Keep-alive for free tier (Render)

Render free tier sleeps after 15 min. Set up a free uptime monitor:

1. Go to https://uptimerobot.com → **Add New Monitor**
2. Monitor type: HTTP(s)
3. URL: `https://eventify-server.onrender.com/api/health`
4. Monitoring interval: 10 minutes

This keeps your server awake at events.

---

## Kiosk setup tips (iPad / tablet)

- Use **Guided Access** (iOS) or **Kiosk mode** (Android) to lock the browser to the kiosk URL
- The kiosk URL is: `https://eventify.vercel.app/kiosk/{event-slug}`
- Get the event slug from the dashboard
- Set the tablet to **never sleep** and **max brightness**
- Use a tablet stand or mount it near the entrance
- Test camera + microphone permissions before the event

---

## Environment variables reference

### Server (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Set to `4000` |
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | 64-char random hex string |
| `CLIENT_URL` | ✅ | Your Vercel URL |
| `SERVER_URL` | ✅ | Your Render URL |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary dashboard |
| `GOOGLE_CLIENT_ID` | For Drive | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | For Drive | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | For Drive | `{SERVER_URL}/api/auth/google/callback` |
| `ANTHROPIC_API_KEY` | For AI captions | console.anthropic.com |
| `FACEBOOK_APP_ID` | For FB/Instagram | developers.facebook.com |
| `FACEBOOK_APP_SECRET` | For FB/Instagram | developers.facebook.com |
| `TIKTOK_CLIENT_KEY` | For TikTok | developers.tiktok.com |
| `TIKTOK_CLIENT_SECRET` | For TikTok | developers.tiktok.com |
| `TWITTER_CLIENT_ID` | For X | developer.twitter.com |
| `TWITTER_CLIENT_SECRET` | For X | developer.twitter.com |

### Client (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Your Render server URL |
| `VITE_APP_NAME` | No | Shown in browser title |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Server returns 503 | Free tier sleeping — wait 30s or add uptime monitor |
| CORS error on client | Check `CLIENT_URL` env var matches your Vercel URL exactly |
| "Google Drive not authorised" | Re-visit `/api/auth/google` from the admin dashboard |
| FFmpeg error on Render | FFmpeg is pre-installed on Render — check server logs |
| Upload times out | Cloudinary free tier has 100MB limit per upload — keep recordings under 2 min |
| Social publish fails | Check platform tokens haven't expired — reconnect in Settings |
| Kiosk shows "Event not found" | Make sure event status is **Active** in the dashboard |
| MongoDB connection fails | Check IP whitelist in Atlas includes `0.0.0.0/0` |
