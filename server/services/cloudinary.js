/**
 * Cloudinary service (Node.js built-in https — no SDK needed for free tier)
 * Uses the Cloudinary Upload API with unsigned preset or API key auth.
 *
 * Docs: https://cloudinary.com/documentation/video_upload_api_reference
 */
const https = require('https');
const http  = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const CLOUD  = () => process.env.CLOUDINARY_CLOUD_NAME;
const KEY    = () => process.env.CLOUDINARY_API_KEY;
const SECRET = () => process.env.CLOUDINARY_API_SECRET;

// ── Sign a set of params for authenticated requests ───────────────────────────
function sign(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto
    .createHash('sha256')
    .update(sorted + SECRET())
    .digest('hex');
}

// ── Low-level multipart upload via https ──────────────────────────────────────
function uploadToCloudinary(fileBuffer, { publicId, folder, resourceType = 'video', tags = [] }) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      timestamp,
      folder,
      public_id: publicId,
      overwrite: true,
      ...(tags.length ? { tags: tags.join(',') } : {}),
    };
    const signature = sign(params);

    // Build multipart/form-data manually
    const boundary = `----EventifyBoundary${crypto.randomBytes(8).toString('hex')}`;
    const CRLF = '\r\n';

    const fields = {
      ...params,
      signature,
      api_key: KEY(),
    };

    let bodyParts = [];

    // Text fields
    for (const [k, v] of Object.entries(fields)) {
      bodyParts.push(
        Buffer.from(
          `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}` +
          `${v}${CRLF}`
        )
      );
    }

    // File field
    const ext = resourceType === 'video' ? 'webm' : 'webm';
    bodyParts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${publicId}.${ext}"${CRLF}` +
        `Content-Type: ${resourceType === 'video' ? 'video/webm' : 'audio/webm'}${CRLF}${CRLF}`
      )
    );
    bodyParts.push(fileBuffer);
    bodyParts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

    const body = Buffer.concat(bodyParts);

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD()}/${resourceType}/upload`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(`Cloudinary: ${parsed.error.message}`));
          resolve(parsed);
        } catch (e) {
          reject(new Error('Cloudinary response parse error: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Delete a resource from Cloudinary ────────────────────────────────────────
function deleteFromCloudinary(publicId, resourceType = 'video') {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, timestamp };
    const signature = sign(params);

    const body = new URLSearchParams({
      ...params,
      signature,
      api_key: KEY(),
    }).toString();

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD()}/${resourceType}/destroy`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ result: 'unknown' }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Upload a video/audio buffer to Cloudinary.
 *
 * @param {Buffer} buffer
 * @param {object} opts
 * @param {string} opts.eventSlug   - used as folder name
 * @param {string} opts.publicId    - filename without extension
 * @param {string} opts.resourceType - 'video' | 'raw'
 * @returns {Promise<object>}  Cloudinary response with url, secure_url, public_id, duration, bytes, etc.
 */
async function uploadVideo(buffer, { eventSlug, publicId, resourceType = 'video' }) {
  if (!CLOUD() || !KEY() || !SECRET()) {
    throw new Error('Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
  }

  const result = await uploadToCloudinary(buffer, {
    publicId,
    folder: `eventify/${eventSlug}`,
    resourceType,
    tags: ['eventify', eventSlug],
  });

  return {
    publicId:  result.public_id,
    url:       result.url,
    secureUrl: result.secure_url,
    format:    result.format,
    duration:  result.duration || 0,
    bytes:     result.bytes || 0,
    width:     result.width || 0,
    height:    result.height || 0,
  };
}

async function deleteVideo(publicId, resourceType = 'video') {
  return deleteFromCloudinary(publicId, resourceType);
}

module.exports = { uploadVideo, deleteVideo };
