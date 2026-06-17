# Eventify — Stage 1 Setup Guide

## What Stage 1 includes

- Node.js + Express backend with JWT auth
- MongoDB Atlas schemas (Admin, Event, Video)
- Protected admin routes
- React + Vite frontend with React Router
- Admin login, setup, dashboard, settings pages
- Axios API client with auto token attachment
- Deployment configs for Vercel (client) + Render (server)

---

## 1. Prerequisites

Install these on your machine:
- Node.js v18+ → https://nodejs.org
- Git → https://git-scm.com

---

## 2. Get your free services set up

### MongoDB Atlas (database)
1. Go to https://cloud.mongodb.com and create a free account
2. Create a **free M0 cluster** (choose any region)
3. Under "Database Access" → Add a user with a strong password
4. Under "Network Access" → Add IP `0.0.0.0/0` (allow all, for Render)
5. Click "Connect" → "Drivers" → copy the connection string
6. Replace `<password>` in the string with your DB user password

### Generate a JWT secret
Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output — this is your JWT_SECRET.

---

## 3. Install and run locally

```bash
# Clone / open the project
cd eventify

# Install server dependencies
cd server
npm install
cp .env.example .env
# → Edit .env and fill in MONGO_URI and JWT_SECRET (minimum required for Stage 1)

# Start the server
npm run dev
# Server runs on http://localhost:4000

# In a new terminal — install client dependencies
cd ../client
npm install

# Start the client
npm run dev
# Client runs on http://localhost:5173
```

---

## 4. First-time admin setup

1. Open http://localhost:5173/admin/setup
2. Fill in your name, email and a password (min 8 chars)
3. This creates your superadmin account
4. You'll be redirected to the dashboard

> After the first admin is created, the /setup page is locked.
> Use /admin/settings → "Invite admin" to add more team members.

---

## 5. Test the API directly (optional)

```bash
# Health check
curl http://localhost:4000/api/health

# Register (first time only)
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Admin","email":"test@test.com","password":"password123"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

---

## 6. Deploy to Vercel + Render (free)

### Server → Render.com
1. Push your code to a GitHub repository
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo, select the `server/` folder
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all environment variables from `.env.example` in the Render dashboard
7. Deploy — you'll get a URL like `https://eventify-server.onrender.com`

### Client → Vercel
1. Go to https://vercel.com → New Project
2. Import your GitHub repo, set root directory to `client/`
3. Framework: Vite
4. Add environment variable:
   - `VITE_API_URL` = your Render server URL
5. Deploy — you'll get a URL like `https://eventify.vercel.app`
6. Copy that URL back into Render as `CLIENT_URL` env var

---

## 7. Update client to use VITE_API_URL in production

In `client/src/utils/api.js`, update the baseURL:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
});
```

---

## What's next

| Stage | What gets built |
|-------|----------------|
| **Stage 2** | Create Event page — color theme picker, frame style selector, hashtags, AI description |
| **Stage 3** | Guest Kiosk — big record button, video/audio, guest name, tablet UI |
| **Stage 4** | Video upload — Cloudinary storage + Google Drive raw export |
| **Stage 5** | FFmpeg frame overlay — 5 design templates, event branding on video |
| **Stage 6** | Admin review dashboard — watch, approve, flag recordings |
| **Stage 7** | Social publishing — TikTok, Instagram, Facebook, X, YouTube |
| **Stage 8** | Final deployment polish + environment guide |
