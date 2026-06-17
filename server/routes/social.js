/**
 * Social publishing routes
 *
 * GET  /api/social/status              — connection status for all platforms
 * GET  /api/social/:platform/connect   — redirect to OAuth
 * GET  /api/social/:platform/callback  — OAuth callback, save tokens
 * POST /api/social/:platform/disconnect — remove tokens
 * POST /api/social/publish/:videoId    — publish approved video to selected platforms
 * GET  /api/social/publish/:videoId/status — poll publish progress
 */

const router = require('express').Router();
const crypto = require('crypto');
const Video  = require('../models/Video');
const Event  = require('../models/Event');
const { protect } = require('../middleware/auth');
const { saveTokens, loadTokens, isConnected, disconnectPlatform } = require('../services/social/tokenStore');
const { downloadBuffer } = require('../services/ffmpeg');

// Platform service imports
const { publishToTikTok,    getTikTokAuthUrl,    exchangeTikTokCode   } = require('../services/social/tiktok');
const { publishToFacebook,  publishToInstagram,  getFacebookAuthUrl,
        exchangeFacebookCode, getFacebookPages,  getInstagramAccount  } = require('../services/social/facebook');
const { publishToTwitter,   getTwitterAuthUrl,   exchangeTwitterCode,
        generatePKCE                                                   } = require('../services/social/twitter');
const { publishToYouTube,   getYouTubeAuthUrl,   exchangeYouTubeCode  } = require('../services/social/youtube');

// Temp store for OAuth state + PKCE verifiers (in-memory is fine for single instance)
const oauthState = new Map(); // state => { adminId, platform, codeVerifier? }

// ── GET /api/social/status ────────────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  const adminId   = req.admin._id.toString();
  const platforms = ['tiktok', 'instagram', 'facebook', 'twitter', 'youtube'];

  const statusChecks = await Promise.all(
    platforms.map(async (p) => [p, await isConnected(adminId, p)])
  );

  const status = Object.fromEntries(statusChecks);
  res.json({ status });
});

// ── GET /api/social/:platform/connect ────────────────────────────────────────
router.get('/:platform/connect', protect, (req, res) => {
  const { platform } = req.params;
  const adminId = req.admin._id.toString();
  const state   = crypto.randomBytes(16).toString('hex');

  let authUrl;
  const entry = { adminId, platform };

  switch (platform) {
    case 'tiktok':
      if (!process.env.TIKTOK_CLIENT_KEY) return res.status(501).json({ error: 'TikTok credentials not configured.' });
      authUrl = getTikTokAuthUrl(state);
      break;
    case 'facebook':
    case 'instagram':
      if (!process.env.FACEBOOK_APP_ID) return res.status(501).json({ error: 'Facebook credentials not configured.' });
      authUrl = getFacebookAuthUrl(state);
      entry.platform = 'facebook'; // Instagram uses same Facebook OAuth
      break;
    case 'twitter':
      if (!process.env.TWITTER_CLIENT_ID) return res.status(501).json({ error: 'Twitter credentials not configured.' });
      const pkce = generatePKCE();
      entry.codeVerifier = pkce.verifier;
      authUrl = getTwitterAuthUrl(state, pkce.challenge);
      break;
    case 'youtube':
      if (!process.env.GOOGLE_CLIENT_ID) return res.status(501).json({ error: 'Google credentials not configured.' });
      authUrl = getYouTubeAuthUrl(state);
      break;
    default:
      return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  oauthState.set(state, entry);
  // Clean up state after 10 minutes
  setTimeout(() => oauthState.delete(state), 10 * 60 * 1000);

  res.redirect(authUrl);
});

// ── GET /api/social/tiktok/callback ──────────────────────────────────────────
router.get('/tiktok/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`TikTok auth error: ${error}`);

  const entry = oauthState.get(state);
  if (!entry) return res.status(400).send('Invalid or expired OAuth state.');
  oauthState.delete(state);

  try {
    const tokens = await exchangeTikTokCode(code);
    await saveTokens(entry.adminId, 'tiktok', {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    Date.now() + tokens.expires_in * 1000,
      userId:       tokens.open_id,
    });
    res.redirect(`${process.env.CLIENT_URL}/admin/settings?social=tiktok&status=connected`);
  } catch (err) {
    res.status(500).send(`TikTok token exchange failed: ${err.message}`);
  }
});

// ── GET /api/social/facebook/callback ────────────────────────────────────────
// Also handles Instagram (same OAuth)
router.get('/facebook/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Facebook auth error: ${error}`);

  const entry = oauthState.get(state);
  if (!entry) return res.status(400).send('Invalid or expired OAuth state.');
  oauthState.delete(state);

  try {
    const tokenData  = await exchangeFacebookCode(code);
    const userToken  = tokenData.access_token;

    // Get pages list
    const pagesData  = await getFacebookPages(userToken);
    const page       = pagesData.data?.[0]; // use first page
    const pageToken  = page?.access_token || userToken;
    const pageId     = page?.id;

    // Save Facebook tokens
    await saveTokens(entry.adminId, 'facebook', {
      accessToken: pageToken,
      userId:      pageId,
      username:    page?.name || 'Facebook Page',
    });

    // Also try to get Instagram business account linked to this page
    if (pageId && pageToken) {
      try {
        const igData = await getInstagramAccount(pageToken, pageId);
        const igId   = igData?.instagram_business_account?.id;
        if (igId) {
          await saveTokens(entry.adminId, 'instagram', {
            accessToken: pageToken,
            userId:      igId,
            username:    'Instagram (via Facebook)',
          });
        }
      } catch {
        // Instagram not linked — not fatal
      }
    }

    res.redirect(`${process.env.CLIENT_URL}/admin/settings?social=facebook&status=connected`);
  } catch (err) {
    res.status(500).send(`Facebook token exchange failed: ${err.message}`);
  }
});

// ── GET /api/social/twitter/callback ─────────────────────────────────────────
router.get('/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Twitter auth error: ${error}`);

  const entry = oauthState.get(state);
  if (!entry) return res.status(400).send('Invalid or expired OAuth state.');
  oauthState.delete(state);

  try {
    const tokens = await exchangeTwitterCode(code, entry.codeVerifier);
    await saveTokens(entry.adminId, 'twitter', {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    Date.now() + (tokens.expires_in || 7200) * 1000,
    });
    res.redirect(`${process.env.CLIENT_URL}/admin/settings?social=twitter&status=connected`);
  } catch (err) {
    res.status(500).send(`Twitter token exchange failed: ${err.message}`);
  }
});

// ── GET /api/social/youtube/callback ─────────────────────────────────────────
router.get('/youtube/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`YouTube auth error: ${error}`);

  const entry = oauthState.get(state);
  if (!entry) return res.status(400).send('Invalid or expired OAuth state.');
  oauthState.delete(state);

  try {
    const tokens = await exchangeYouTubeCode(code);
    await saveTokens(entry.adminId, 'youtube', {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    Date.now() + tokens.expires_in * 1000,
    });
    res.redirect(`${process.env.CLIENT_URL}/admin/settings?social=youtube&status=connected`);
  } catch (err) {
    res.status(500).send(`YouTube token exchange failed: ${err.message}`);
  }
});

// ── POST /api/social/:platform/disconnect ─────────────────────────────────────
router.post('/:platform/disconnect', protect, async (req, res) => {
  await disconnectPlatform(req.admin._id.toString(), req.params.platform);
  res.json({ message: `${req.params.platform} disconnected.` });
});

// ── POST /api/social/publish/:videoId ────────────────────────────────────────
// Publish an approved, processed video to one or more platforms
router.post('/publish/:videoId', protect, async (req, res) => {
  const { videoId } = req.params;
  const { platforms } = req.body; // array e.g. ['tiktok', 'instagram']

  if (!platforms?.length) {
    return res.status(400).json({ error: 'platforms array is required.' });
  }

  const video = await Video.findById(videoId).lean();
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  if (video.status !== 'approved') return res.status(400).json({ error: 'Video must be approved first.' });

  const event  = await Event.findById(video.event).lean();
  if (!event)  return res.status(404).json({ error: 'Event not found.' });

  // Respond immediately — publishing is async
  res.json({ message: 'Publishing started.', videoId, platforms });

  // Run publishing in background
  _publishVideo(video, event, platforms, req.admin._id.toString()).catch((err) =>
    console.error(`[Publish ${videoId}]`, err.message)
  );
});

async function _publishVideo(video, event, platforms, adminId) {
  const caption   = video.caption   || event.postDescription || '';
  const hashtags  = video.hashtags?.length ? video.hashtags : (event.hashtags || []);

  // Pick the right video URL per platform
  // Use framed version if available, fall back to raw
  const framedUrl  = video.processed?.framed?.url  || video.cloudinary?.secureUrl;
  const tiktokUrl  = video.processed?.tiktok?.url  || framedUrl;
  const igUrl      = video.processed?.instagram?.url || framedUrl;
  const fbUrl      = video.processed?.facebook?.url  || framedUrl;
  const twUrl      = video.processed?.twitter?.url   || framedUrl;
  const ytUrl      = video.processed?.youtube?.url   || framedUrl;

  const updates = {};

  await Promise.all(
    platforms.map(async (platform) => {
      try {
        let result;
        switch (platform) {
          case 'tiktok':
            result = await publishToTikTok(adminId, { videoUrl: tiktokUrl, caption, hashtags });
            break;
          case 'instagram':
            result = await publishToInstagram(adminId, { videoUrl: igUrl, caption, hashtags });
            break;
          case 'facebook':
            result = await publishToFacebook(adminId, { videoUrl: fbUrl, caption, hashtags });
            break;
          case 'twitter': {
            // Twitter requires the actual buffer (not a URL)
            const buf = await downloadBuffer(twUrl);
            result = await publishToTwitter(adminId, { videoBuffer: buf, caption, hashtags });
            break;
          }
          case 'youtube': {
            const buf = await downloadBuffer(ytUrl);
            result = await publishToYouTube(adminId, {
              videoBuffer: buf,
              caption,
              hashtags,
              eventName: event.name,
            });
            break;
          }
          default:
            throw new Error(`Unknown platform: ${platform}`);
        }

        updates[`published.${platform}.done`]        = true;
        updates[`published.${platform}.postId`]      = result.postId || '';
        updates[`published.${platform}.publishedAt`] = new Date();
        console.log(`[Publish] ✅ ${platform} — ${result.postId}`);
      } catch (err) {
        updates[`published.${platform}.done`]  = false;
        updates[`published.${platform}.error`] = err.message;
        console.error(`[Publish] ❌ ${platform}: ${err.message}`);
      }
    })
  );

  if (Object.keys(updates).length) {
    await Video.findByIdAndUpdate(video._id, updates);
  }

  // Refresh event stats
  const publishedCount = await Video.countDocuments({
    event: video.event,
    $or: [
      { 'published.tiktok.done':    true },
      { 'published.instagram.done': true },
      { 'published.facebook.done':  true },
      { 'published.twitter.done':   true },
      { 'published.youtube.done':   true },
    ],
  });
  await Event.findByIdAndUpdate(video.event, { 'stats.publishedCount': publishedCount });
}

// ── GET /api/social/publish/:videoId/status ───────────────────────────────────
router.get('/publish/:videoId/status', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId).select('published').lean();
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    res.json({ published: video.published });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
