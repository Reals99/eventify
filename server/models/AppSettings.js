/**
 * AppSettings model
 *
 * Stores global app-level settings that need to persist across server restarts.
 * Used for:
 *   - Google Drive OAuth tokens (production — replaces .gdrive_tokens.json)
 *   - App-level config flags
 *
 * There is exactly ONE document in this collection (upserted by key='global').
 */
const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },

    // ── Google Drive OAuth tokens ─────────────────────────────────────────
    driveTokens: {
      access_token:  { type: String, default: '' },
      refresh_token: { type: String, default: '' },
      expiry_date:   { type: Number, default: 0 },
      token_type:    { type: String, default: 'Bearer' },
      scope:         { type: String, default: '' },
      savedAt:       { type: Date },
    },

    // ── Feature flags ─────────────────────────────────────────────────────
    driveConnected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
