# Google Drive Setup Guide

Eventify uploads raw (unprocessed) recordings to a Google Drive folder
named after each event. This is completely free using Google's Drive API.

---

## Step 1 — Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project**
3. Name it `Eventify` → **Create**

---

## Step 2 — Enable the Google Drive API

1. In your project, go to **APIs & Services → Library**
2. Search for **Google Drive API** → Click it → **Enable**

---

## Step 3 — Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - App name: `Eventify`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue** through the scopes screen (no changes needed)
5. Add yourself as a **Test User** (your Google account email)
6. Save

---

## Step 4 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Eventify Server`
5. Under **Authorized redirect URIs**, add:
   - For local dev: `http://localhost:4000/api/auth/google/callback`
   - For production: `https://your-server.onrender.com/api/auth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

---

## Step 5 — Add to .env

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

---

## Step 6 — Authorise Eventify (one-time)

1. Start your server (`npm run dev`)
2. Log into the admin dashboard
3. Click **"Connect Drive"** in the nav bar  
   (or visit http://localhost:4000/api/auth/google directly)
4. Sign in with your Google account
5. Allow Eventify to access Drive files
6. You'll be redirected back to the dashboard with a green **Drive connected** badge

Tokens are saved to `.gdrive_tokens.json` (auto-created, already in .gitignore).

---

## How it works

- Every recording uploaded via the kiosk is saved to Cloudinary first (primary)
- The same raw file is then uploaded to Drive asynchronously (non-blocking)
- Drive structure created automatically:
  ```
  My Drive/
  └── Eventify Recordings/
      ├── Tech Summit 2026/
      │   ├── Kofi_expectation_1718000000000.webm
      │   └── Ama_takeaway_1718003600000.webm
      └── Community Night/
          └── guest_expectation_1718100000000.webm
  ```

---

## Production (Render)

On Render.com, the filesystem is ephemeral — `.gdrive_tokens.json` won't persist.

**Recommended fix for production:** Store tokens in MongoDB instead.

Add this to `server/services/googleDrive.js`:

```js
// Replace file-based token storage with MongoDB
// In Admin model, add: driveTokens: { access_token, refresh_token, expiry_date }
// Then update loadTokens() and saveTokens() to read/write from DB
```

We'll cover this in Stage 8 (deployment hardening).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `redirect_uri_mismatch` | Add the exact URI to Google Console |
| `access_denied` | Add your email as a Test User in OAuth consent screen |
| `Token refresh failed` | Re-visit /api/auth/google to re-authorise |
| `Drive not configured` | Check GOOGLE_CLIENT_ID is set in .env |
