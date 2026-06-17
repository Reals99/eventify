/**
 * Facebook & Instagram Publisher
 *
 * Uses Meta Graph API v19.0
 * - Facebook: Page video post via /me/videos
 * - Instagram: Reels upload via /{ig-user-id}/media + publish
 *
 * Free to use — no paid tier needed for publishing to your own pages.
 *
 * Setup (done once in admin settings):
 *   1. Create a Meta Developer app at https://developers.facebook.com
 *   2. Add "Facebook Login" + "Instagram Basic Display" products
 *   3. Set OAuth redirect URI to: {SERVER_URL}/api/social/facebook/callback
 *   4. Request permissions: pages_manage_posts, pages_read_engagement,
 *      instagram_basic, instagram_content_publish
 */

const https = require('https');
const { loadTokens } = require('./tokenStore');

const GRAPH = 'graph.facebook.com';
const VERSION = 'v19.0';

function graphRequest(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: GRAPH,
      path: `/${VERSION}/${path}${path.includes('?') ? '&' : '?'}access_token=${accessToken}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(`Meta API: ${parsed.error.message}`));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Upload video buffer to Meta via resumable upload ─────────────────────────
// For simplicity we use the video URL method (Cloudinary URL) instead of
// uploading the buffer directly — much simpler and works great with Cloudinary.
async function publishToFacebook(adminId, { videoUrl, caption, hashtags, pageId }) {
  const tokens = await loadTokens(adminId, 'facebook');
  if (!tokens?.accessToken) throw new Error('Facebook not connected. Go to Settings → Social Accounts.');

  const hashtagStr = hashtags?.length ? '\n\n' + hashtags.map(t => `#${t}`).join(' ') : '';
  const fullCaption = `${caption || ''}${hashtagStr}`.trim();

  // Post video to Facebook Page using URL (Cloudinary hosts the file)
  const result = await graphRequest(
    'POST',
    `${pageId || 'me'}/videos`,
    tokens.accessToken,
    {
      file_url:    videoUrl,
      description: fullCaption,
      published:   true,
    }
  );

  return { postId: result.id, platform: 'facebook' };
}

async function publishToInstagram(adminId, { videoUrl, caption, hashtags, igUserId }) {
  const tokens = await loadTokens(adminId, 'instagram');
  if (!tokens?.accessToken) throw new Error('Instagram not connected. Go to Settings → Social Accounts.');

  const hashtagStr = hashtags?.length ? '\n\n' + hashtags.map(t => `#${t}`).join(' ') : '';
  const fullCaption = `${caption || ''}${hashtagStr}`.trim();

  const userId = igUserId || tokens.userId;
  if (!userId) throw new Error('Instagram user ID not found. Reconnect your account.');

  // Step 1: Create media container
  const container = await graphRequest(
    'POST',
    `${userId}/media`,
    tokens.accessToken,
    {
      video_url:   videoUrl,
      caption:     fullCaption,
      media_type:  'REELS',
    }
  );

  // Step 2: Poll until container is ready (FINISHED status)
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await graphRequest('GET', `${container.id}?fields=status_code`, tokens.accessToken);
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error('Instagram container processing failed.');
    attempts++;
  }

  // Step 3: Publish
  const published = await graphRequest(
    'POST',
    `${userId}/media_publish`,
    tokens.accessToken,
    { creation_id: container.id }
  );

  return { postId: published.id, platform: 'instagram' };
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────
function getFacebookAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     process.env.FACEBOOK_APP_ID,
    redirect_uri:  `${process.env.SERVER_URL}/api/social/facebook/callback`,
    scope:         'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,pages_show_list',
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

async function exchangeFacebookCode(code) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      client_id:     process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri:  `${process.env.SERVER_URL}/api/social/facebook/callback`,
      code,
    });
    const req = https.request(
      { hostname: GRAPH, path: `/${VERSION}/oauth/access_token?${params}`, method: 'GET' },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed); // { access_token, token_type, expires_in }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function getFacebookPages(accessToken) {
  return graphRequest('GET', 'me/accounts?fields=id,name,access_token', accessToken);
}

async function getInstagramAccount(pageAccessToken, pageId) {
  return graphRequest('GET', `${pageId}?fields=instagram_business_account`, pageAccessToken);
}

module.exports = {
  publishToFacebook,
  publishToInstagram,
  getFacebookAuthUrl,
  exchangeFacebookCode,
  getFacebookPages,
  getInstagramAccount,
};
