/**
 * Google Drive service
 *
 * Uses the Google Drive REST API v3 with OAuth2.
 * No SDK — pure Node.js https module (free).
 *
 * Token storage:
 *   - Development: .gdrive_tokens.json (file-based, fast)
 *   - Production:  MongoDB AppSettings collection (persists across restarts)
 *
 * The storage mode is chosen automatically based on NODE_ENV.
 *
 * Setup: see GOOGLE_DRIVE_SETUP.md
 */

const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const TOKEN_FILE = path.join(__dirname, '../../.gdrive_tokens.json');
const isProd     = process.env.NODE_ENV === 'production';

// ── Token helpers — auto-selects file vs MongoDB ──────────────────────────────

async function loadTokens() {
  if (isProd) {
    try {
      const AppSettings = require('../models/AppSettings');
      const settings = await AppSettings.findOne({ key: 'global' }).lean();
      if (!settings?.driveTokens?.refresh_token) return null;
      return settings.driveTokens;
    } catch (e) {
      console.error('[Drive] MongoDB token load failed:', e.message);
      return null;
    }
  }
  // Development: file-based
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function saveTokens(tokens) {
  if (isProd) {
    try {
      const AppSettings = require('../models/AppSettings');
      await AppSettings.findOneAndUpdate(
        { key: 'global' },
        {
          driveTokens:    { ...tokens, savedAt: new Date() },
          driveConnected: true,
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error('[Drive] MongoDB token save failed:', e.message);
    }
    return;
  }
  // Development: file-based
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
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
        res.on('data', c => (data += c));
        res.on('end', () => {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(`Token refresh: ${parsed.error_description}`));
          resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

async function getValidAccessToken() {
  const tokens = await loadTokens();
  if (!tokens?.refresh_token) {
    throw new Error('Google Drive not authorised. Visit /api/auth/google to connect.');
  }

  if (Date.now() >= (tokens.expiry_date || 0) - 60_000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const updated = {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date:  Date.now() + refreshed.expires_in * 1000,
    };
    await saveTokens(updated);
    return updated.access_token;
  }

  return tokens.access_token;
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

function driveRequest(method, path, accessToken, body, contentType) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body
      ? Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
      : null;

    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(contentType ? { 'Content-Type': contentType } : {}),
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ raw: data }); }
        });
      }
    );
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function findOrCreateFolder(folderName, accessToken, parentId = null) {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : '')
  );

  const result = await driveRequest('GET', `/drive/v3/files?q=${query}&fields=files(id,name)`, accessToken);
  if (result.files?.length > 0) return result.files[0].id;

  const meta = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId ? { parents: [parentId] } : {}),
  };

  const created = await driveRequest('POST', '/drive/v3/files?fields=id,name', accessToken, meta, 'application/json');
  return created.id;
}

async function uploadFileToDrive(fileBuffer, { fileName, mimeType, folderId, accessToken }) {
  const boundary = 'eventify_drive_boundary';
  const meta     = JSON.stringify({ name: fileName, parents: [folderId] });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'www.googleapis.com',
        path:     '/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
        method:   'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(`Drive upload: ${parsed.error.message}`));
            resolve(parsed);
          } catch (e) {
            reject(new Error('Drive response parse error'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

async function uploadToDrive(buffer, { eventName, fileName, mimeType = 'video/webm' }) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Google Drive not configured. See GOOGLE_DRIVE_SETUP.md');
  }

  const accessToken = await getValidAccessToken();
  const rootId      = await findOrCreateFolder('Eventify Recordings', accessToken);
  const eventFolderId = await findOrCreateFolder(eventName, accessToken, rootId);

  const result = await uploadFileToDrive(buffer, { fileName, mimeType, folderId: eventFolderId, accessToken });
  return { fileId: result.id, webViewLink: result.webViewLink };
}

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.file',
    access_type:   'offline',
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    code,
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
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
        res.on('data', c => (data += c));
        res.on('end', async () => {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error_description));
          parsed.expiry_date = Date.now() + parsed.expires_in * 1000;
          await saveTokens(parsed);
          resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

async function isDriveConnected() {
  const tokens = await loadTokens();
  return !!(tokens?.refresh_token);
}

module.exports = { uploadToDrive, getAuthUrl, exchangeCodeForTokens, isDriveConnected };
