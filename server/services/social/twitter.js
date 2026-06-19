/**
 * X (Twitter) Publisher
 *
 * Uses Twitter API v2 — media upload v1.1 + tweet POST v2
 *
 * Free tier (Basic — $100/mo) allows posting.
 * The free tier does NOT allow media upload — you need at least Basic.
 *
 * Docs: https://developer.twitter.com/en/docs/twitter-api
 *
 * Setup:
 *  1. https://developer.twitter.com/en/portal/dashboard
 *  2. Create a project + app
 *  3. Enable OAuth 2.0 with PKCE
 *  4. Add callback URL: {SERVER_URL}/api/social/twitter/callback
 *  5. Request "Read and Write" permissions + "Elevated" access for media upload
 */

const https   = require('https');
const crypto  = require('crypto');
const { loadTokens } = require('./tokenStore');

// ── OAuth 2.0 PKCE helpers ────────────────────────────────────────────────────
function generatePKCE() {
  const verifier  = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function getTwitterAuthUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             process.env.TWITTER_CLIENT_ID,
    redirect_uri:          `${process.env.SERVER_URL}/api/social/twitter/callback`,
    scope:                 'tweet.read tweet.write users.read offline.access media.write',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

async function exchangeTwitterCode(code, codeVerifier) {
  const creds = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64');

  const body = new URLSearchParams({
    code,
    grant_type:    'authorization_code',
    redirect_uri:  `${process.env.SERVER_URL}/api/social/twitter/callback`,
    code_verifier: codeVerifier,
  }).toString();

  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body);
    const req = https.request(
      {
        hostname: 'api.twitter.com',
        path:     '/2/oauth2/token',
        method:   'POST',
        headers: {
          Authorization:   `Basic ${creds}`,
          'Content-Type':  'application/x-www-form-urlencoded',
          'Content-Length': bodyBuf.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
            resolve(parsed);
          } catch (err) {
            reject(new Error('Twitter auth response parse error: ' + err.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── Upload media (v1.1 — requires Elevated access) ────────────────────────────
async function uploadMedia(videoBuffer, accessToken) {
  // Step 1: INIT
  const totalBytes = videoBuffer.length;
  const init = await twitterMediaRequest('POST', 'INIT', accessToken, {
    command:        'INIT',
    media_type:     'video/mp4',
    total_bytes:    totalBytes,
    media_category: 'tweet_video',
  });

  const mediaId = init.media_id_string;

  // Step 2: APPEND in 5MB chunks
  const chunkSize = 5 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const chunk = videoBuffer.slice(offset, offset + chunkSize);
    await twitterMediaUploadChunk(mediaId, chunk, segmentIndex, accessToken);
    segmentIndex++;
  }

  // Step 3: FINALIZE
  const finalize = await twitterMediaRequest('POST', 'FINALIZE', accessToken, {
    command:  'FINALIZE',
    media_id: mediaId,
  });

  // Step 4: Wait for processing
  if (finalize.processing_info?.state === 'pending') {
    await waitForMediaProcessing(mediaId, accessToken);
  }

  return mediaId;
}

async function twitterMediaRequest(method, command, accessToken, params) {
  const qs   = command === 'STATUS' ? `?command=${command}&media_id=${params.media_id}` : '';
  const body = command !== 'STATUS' ? new URLSearchParams(params).toString() : null;
  const bodyBuf = body ? Buffer.from(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'upload.twitter.com',
        path:     `/1.1/media/upload.json${qs}`,
        method:   bodyBuf ? 'POST' : 'GET',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.errors) return reject(new Error(parsed.errors[0]?.message || 'Twitter media error'));
            resolve(parsed);
          } catch {
            resolve({ raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function twitterMediaUploadChunk(mediaId, chunk, segmentIndex, accessToken) {
  const boundary = 'TwitterUploadBoundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="command"\r\n\r\nAPPEND\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media_id"\r\n\r\n${mediaId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="segment_index"\r\n\r\n${segmentIndex}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
    chunk,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'upload.twitter.com',
        path:     '/1.1/media/upload.json',
        method:   'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (err) {
            reject(new Error('Twitter media upload parse error: ' + err.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForMediaProcessing(mediaId, accessToken) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await twitterMediaRequest('GET', 'STATUS', accessToken, { media_id: mediaId });
    const state  = status.processing_info?.state;
    if (state === 'succeeded') return;
    if (state === 'failed') throw new Error('Twitter media processing failed.');
  }
  throw new Error('Twitter media processing timed out.');
}

// ── Post tweet with media ─────────────────────────────────────────────────────
async function publishToTwitter(adminId, { videoBuffer, caption, hashtags }) {
  const tokens = await loadTokens(adminId, 'twitter');
  if (!tokens?.accessToken) {
    throw new Error('X (Twitter) not connected. Go to Settings → Social Accounts.');
  }

  const hashtagStr = hashtags?.length
    ? '\n' + hashtags.map((t) => `#${t}`).join(' ')
    : '';
  const tweetText = `${caption || ''}${hashtagStr}`.trim().slice(0, 280);

  const mediaId = await uploadMedia(videoBuffer, tokens.accessToken);

  const bodyBuf = Buffer.from(JSON.stringify({
    text:  tweetText,
    media: { media_ids: [mediaId] },
  }));

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.twitter.com',
        path:     '/2/tweets',
        method:   'POST',
        headers: {
          Authorization:  `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': bodyBuf.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.errors) return reject(new Error(parsed.errors[0]?.message));
            resolve({ postId: parsed.data?.id, platform: 'twitter' });
          } catch (err) {
            reject(new Error('Twitter publish response parse error: ' + err.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = {
  publishToTwitter,
  getTwitterAuthUrl,
  exchangeTwitterCode,
  generatePKCE,
};
