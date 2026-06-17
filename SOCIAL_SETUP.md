# Social Platforms Setup Guide

Each platform requires a free developer account + app setup.
After setup, admins connect their accounts via **Settings → Social Accounts**.

---

## Platform-by-platform instructions

### Facebook + Instagram (Meta)
*Fastest to get approved — same app handles both.*

1. Go to https://developers.facebook.com → **My Apps → Create App**
2. Use case: **Other** → App type: **Business**
3. Add products: **Facebook Login** + **Instagram Graph API**
4. Under **Facebook Login → Settings**, add OAuth Redirect URI:
   ```
   https://your-server.onrender.com/api/social/facebook/callback
   ```
5. Under **App Settings → Basic**, copy **App ID** and **App Secret**
6. Add to `.env`:
   ```
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   SERVER_URL=https://your-server.onrender.com
   ```
7. **Permissions needed** (request in App Review):
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
8. While in development: add yourself + testers under **Roles → Test Users**

> **Instagram note**: Instagram must be connected as a Business/Creator account
> and linked to a Facebook Page. The OAuth flow handles both in one step.

---

### TikTok
*Requires app review — allow 1–7 days.*

1. Go to https://developers.tiktok.com → **Manage Apps → Create app**
2. App category: **Content**
3. Under **Products**, add **Content Posting API**
4. Add redirect URI:
   ```
   https://your-server.onrender.com/api/social/tiktok/callback
   ```
5. Request scopes: `user.info.basic`, `video.publish`, `video.upload`
6. Copy **Client Key** and **Client Secret**:
   ```
   TIKTOK_CLIENT_KEY=your_client_key
   TIKTOK_CLIENT_SECRET=your_client_secret
   ```
7. Submit for review — approval takes 1–7 business days

---

### X (Twitter)
*Requires paid Basic plan (~$100/mo) for media upload.*

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a **Project** and **App**
3. Under **App Settings → User authentication settings**:
   - OAuth 2.0 → Enable
   - App permissions: **Read and Write**
   - Type of app: **Web App**
   - Callback URI:
     ```
     https://your-server.onrender.com/api/social/twitter/callback
     ```
4. Copy **Client ID** and **Client Secret** (OAuth 2.0 section):
   ```
   TWITTER_CLIENT_ID=your_client_id
   TWITTER_CLIENT_SECRET=your_client_secret
   ```
5. Apply for **Elevated** access for media upload

---

### YouTube
*Uses the same Google Cloud project as Drive — just enable one more API.*

1. Go to https://console.cloud.google.com → your Eventify project
2. **APIs & Services → Library** → search **YouTube Data API v3** → Enable
3. Under your existing OAuth credentials, add callback URI:
   ```
   https://your-server.onrender.com/api/social/youtube/callback
   ```
4. No extra credentials needed — `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are reused
5. In OAuth consent screen, add scope:
   `https://www.googleapis.com/auth/youtube.upload`

---

## Environment variables summary

```env
# Facebook & Instagram
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# X / Twitter
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# YouTube (reuses Google credentials from Drive setup)
# No extra variables needed

# Required for all OAuth callbacks
SERVER_URL=https://your-eventify-server.onrender.com
CLIENT_URL=https://your-eventify.vercel.app
```

---

## How publishing works

1. Admin approves a video in the Review screen
2. FFmpeg applies the frame overlay (Stage 5)
3. Admin clicks **Publish to N platforms** in the review panel
4. Server calls each platform API with the appropriate Cloudinary URL or buffer:
   - TikTok, Instagram, Facebook: use Cloudinary URL (platforms pull the file)
   - YouTube, Twitter: download buffer from Cloudinary, upload directly
5. Results shown per-platform (✓ done / ✗ error) with live polling
6. Published count updated on the event dashboard

---

## Testing without API approval

While waiting for TikTok/Meta review, you can:
- Test the full flow with **YouTube** (approved instantly) or **Facebook** (sandbox mode)
- Use the review screen's **"Framed video"** link to manually download and post
- All processed video URLs are stored in the database and accessible from the review screen
