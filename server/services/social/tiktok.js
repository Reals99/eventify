/**
 * TikTok Publisher
 *
 * Uses TikTok Content Posting API v2
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * Free — requires a TikTok Developer account and app approval.
 * Setup: https://developers.tiktok.com → Create App → Request "Video Upload" scope
 *
 * Flow:
 *  1. Admin connects via OAuth → tokens saved in DB
 *  2. On publish: initialise upload → upload video chunks → confirm post
 *
 * Note: TikTok requires videos to be uploaded as a file (not URL),
 * so we pull the buffer from Cloudinary and chunk-upload it.
 */

const https = require('https');
const { loadTokens } = require('./tokenStore');

const BASE = 'open.tiktokapis.com';

function tiktokRequest(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request(
      {
        hostname: BASE,
        path,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error?.code && parsed.error.code !== 'ok') {
              return reject(new Error(`TikTok API: ${parsed.error.message} (${parsed.error.code})`));
            }
            resolve(parsed.data || parsed);
          } catch {
            reject(new Error('TikTok response parse error: ' + data.slice(0, 200)));
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// Upload video buffer to TikTok via PULL_FROM_URL method (uses Cloudinary URL)
async function publishToTikTok(adminId, { videoUrl, caption, hashtags }) {
  const tokens = await loadTokens(adminId, 'tiktok');
  if (!tokens?.accessToken) {
    throw new Error('TikTok not connected. Go to Settings → Social Accounts.');
  }

  const hashtagStr = hashtags?.length
    ? ' ' + hashtags.map((t) => `#${t}`).join(' ')
    : '';
  const fullCaption = `${caption || ''}${hashtagStr}`.trim().slice(0, 2200);

  // Step 1: Initialise video post using PULL_FROM_URL
  const init = await tiktokRequest(
    'POST',
    '/v2/post/publish/video/init/',
    tokens.accessToken,
    {
      post_info: {
        title:              fullCaption,
        privacy_level:      'PUBLIC_TO_EVERYONE',
        disable_duet:       false,
        disable_comment:    false,
        disable_stitch:     false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source:    'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }
  );

  const publishId = init.publish_id;
  if (!publishId) throw new Error('TikTok: No publish_id returned from init.');

  // Step 2: Poll for status (TikTok processes async)
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await tiktokRequest(
      'POST',
      '/v2/post/publish/status/fetch/',
      tokens.accessToken,
      { publish_id: publishId }
    );
    const s = status.status;
    if (s === 'PUBLISH_COMPLETE') {
      return { postId: publishId, platform: 'tiktok' };
    }
    if (s === 'FAILED' || s === 'SPAM') {
      throw new Error(`TikTok publish failed: ${status.fail_reason || s}`);
    }
    attempts++;
  }

  throw new Error('TikTok publish timed out after 90 seconds.');
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────
function getTikTokAuthUrl(state) {
  const params = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    scope:         'user.info.basic,video.publish,video.upload',
    response_type: 'code',
    redirect_uri:  `${process.env.SERVER_URL}/api/social/tiktok/callback`,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

async function exchangeTikTokCode(code) {
  const body = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type:    'authorization_code',
    redirect_uri:  `${process.env.SERVER_URL}/api/social/tiktok/callback`,
  }).toString();

  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body);
    const req = https.request(
      {
        hostname: BASE,
        path:     '/v2/oauth/token/',
        method:   'POST',
        headers: {
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': bodyBuf.length,
          'Cache-Control':  'no-cache',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
          resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = { publishToTikTok, getTikTokAuthUrl, exchangeTikTokCode };
