/**
 * YouTube Publisher
 *
 * Uses YouTube Data API v3 — resumable upload for videos.
 * Free — requires Google Cloud project with YouTube Data API enabled.
 *
 * Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video
 *
 * Setup:
 *  1. Same Google Cloud project as Google Drive
 *  2. Enable "YouTube Data API v3" in APIs & Services → Library
 *  3. Add scope: https://www.googleapis.com/auth/youtube.upload
 *  4. OAuth callback: {SERVER_URL}/api/social/youtube/callback
 */

const https = require('https');
const { loadTokens, saveTokens } = require('./tokenStore');

// ── Token refresh ─────────────────────────────────────────────────────────────
async function getValidYouTubeToken(adminId) {
  const tokens = await loadTokens(adminId, 'youtube');
  if (!tokens?.accessToken) {
    throw new Error('YouTube not connected. Go to Settings → Social Accounts.');
  }

  // Refresh if expired (60s buffer)
  if (tokens.expiresAt && Date.now() >= tokens.expiresAt - 60_000) {
    const body = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type:    'refresh_token',
    }).toString();

    const refreshed = await new Promise((resolve, reject) => {
      const bodyBuf = Buffer.from(body);
      const req = https.request(
        {
          hostname: 'oauth2.googleapis.com',
          path:     '/token',
          method:   'POST',
          headers: {
            'Content-Type':  'application/x-www-form-urlencoded',
            'Content-Length': bodyBuf.length,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error_description));
            resolve(parsed);
          });
        }
      );
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });

    const updated = {
      ...tokens,
      accessToken: refreshed.access_token,
      expiresAt:   Date.now() + refreshed.expires_in * 1000,
    };
    await saveTokens(adminId, 'youtube', updated);
    return updated.accessToken;
  }

  return tokens.accessToken;
}

// ── Resumable upload ──────────────────────────────────────────────────────────
async function initiateResumableUpload(accessToken, metadata) {
  const metaBuf = Buffer.from(JSON.stringify(metadata));

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        path:     '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        method:   'POST',
        headers: {
          Authorization:            `Bearer ${accessToken}`,
          'Content-Type':           'application/json; charset=UTF-8',
          'Content-Length':         metaBuf.length,
          'X-Upload-Content-Type':  'video/mp4',
        },
      },
      (res) => {
        if (res.statusCode === 200 || res.statusCode === 200) {
          resolve(res.headers.location); // resumable upload URI
        } else {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => reject(new Error(`YouTube init failed: ${res.statusCode} ${data.slice(0, 200)}`)));
        }
      }
    );
    req.on('error', reject);
    req.write(metaBuf);
    req.end();
  });
}

async function uploadVideoToResumableUrl(uploadUrl, videoBuffer) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(uploadUrl);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path:     urlObj.pathname + urlObj.search,
        method:   'PUT',
        headers: {
          'Content-Type':   'video/mp4',
          'Content-Length': videoBuffer.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            const parsed = JSON.parse(data);
            resolve(parsed.id); // YouTube video ID
          } else {
            reject(new Error(`YouTube upload failed: ${res.statusCode} ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(videoBuffer);
    req.end();
  });
}

// ── Main publish function ─────────────────────────────────────────────────────
async function publishToYouTube(adminId, { videoBuffer, caption, hashtags, eventName }) {
  const accessToken = await getValidYouTubeToken(adminId);

  const hashtagStr = hashtags?.length
    ? ' ' + hashtags.map((t) => `#${t}`).join(' ')
    : '';
  const description = `${caption || ''}${hashtagStr}`.trim();
  const title = (eventName
    ? `${eventName} — Guest message`
    : 'Eventify Recording'
  ).slice(0, 100);

  const metadata = {
    snippet: {
      title,
      description,
      tags:     hashtags || [],
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus:           'public',
      selfDeclaredMadeForKids: false,
    },
  };

  const uploadUrl = await initiateResumableUpload(accessToken, metadata);
  const videoId   = await uploadVideoToResumableUrl(uploadUrl, videoBuffer);

  return {
    postId:   videoId,
    platform: 'youtube',
    url:      `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────
function getYouTubeAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${process.env.SERVER_URL}/api/social/youtube/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/youtube.upload',
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeYouTubeCode(code) {
  const body = new URLSearchParams({
    code,
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri:  `${process.env.SERVER_URL}/api/social/youtube/callback`,
    grant_type:    'authorization_code',
  }).toString();

  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body);
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path:     '/token',
        method:   'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Content-Length': bodyBuf.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error_description));
          resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { publishToYouTube, getYouTubeAuthUrl, exchangeYouTubeCode };
