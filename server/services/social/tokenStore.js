/**
 * Social OAuth token store
 *
 * Saves/loads OAuth tokens for each social platform in MongoDB.
 * We store them on the Admin document so each admin has their own tokens.
 *
 * Token schema per platform:
 *   { accessToken, refreshToken, expiresAt, userId, username }
 */

const Admin = require('../../models/Admin');

/**
 * Save tokens for a platform to the admin record.
 * @param {string} adminId
 * @param {string} platform  e.g. 'tiktok'
 * @param {object} tokens    { accessToken, refreshToken, expiresAt, userId, username }
 */
async function saveTokens(adminId, platform, tokens) {
  await Admin.findByIdAndUpdate(adminId, {
    [`socialTokens.${platform}`]: {
      ...tokens,
      savedAt: new Date(),
    },
  });
}

/**
 * Load tokens for a platform from the admin record.
 * @returns {object|null}
 */
async function loadTokens(adminId, platform) {
  const admin = await Admin.findById(adminId).select(`socialTokens.${platform}`).lean();
  return admin?.socialTokens?.[platform] || null;
}

/**
 * Check if a platform is connected (has a saved access token).
 */
async function isConnected(adminId, platform) {
  const tokens = await loadTokens(adminId, platform);
  return !!(tokens?.accessToken);
}

/**
 * Remove tokens for a platform (disconnect).
 */
async function disconnectPlatform(adminId, platform) {
  await Admin.findByIdAndUpdate(adminId, {
    $unset: { [`socialTokens.${platform}`]: 1 },
  });
}

module.exports = { saveTokens, loadTokens, isConnected, disconnectPlatform };
