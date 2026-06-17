/**
 * FFmpeg Frame Overlay Service
 *
 * Applies a branded overlay to a video file using FFmpeg.
 * Supports 5 design templates: minimal, bold, elegant, neon, classic
 * Also resizes video to platform-specific aspect ratios for social export.
 *
 * Requires: ffmpeg installed on the server (free, pre-installed on Render.com)
 *
 * On Render.com free tier: ffmpeg is available at /usr/bin/ffmpeg
 * Install locally: https://ffmpeg.org/download.html
 */

const { spawn } = require('child_process');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const crypto    = require('crypto');

// ── Font paths (Poppins & DejaVu available on Ubuntu / Render) ───────────────
const FONTS = {
  bold:    '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf',
  regular: '/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf',
  medium:  '/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf',
  serif:   '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
  // Fallback if Poppins not available (always present on Ubuntu)
  fallback: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  fallbackBold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
};

// Check which fonts are actually available
function resolveFont(preferred, fallback) {
  return fs.existsSync(preferred) ? preferred : fallback;
}

const F = {
  bold:    resolveFont(FONTS.bold,    FONTS.fallbackBold),
  regular: resolveFont(FONTS.regular, FONTS.fallback),
  medium:  resolveFont(FONTS.medium,  FONTS.fallback),
  serif:   resolveFont(FONTS.serif,   FONTS.fallback),
};

// ── Social platform export configs ───────────────────────────────────────────
const SOCIAL_CONFIGS = {
  tiktok:    { w: 1080, h: 1920, label: 'TikTok (9:16)'       },
  instagram: { w: 1080, h: 1080, label: 'Instagram (1:1)'      },
  facebook:  { w: 1280, h:  720, label: 'Facebook (16:9)'      },
  twitter:   { w: 1280, h:  720, label: 'X / Twitter (16:9)'   },
  youtube:   { w: 1080, h: 1920, label: 'YouTube Shorts (9:16)'  },
};

// ── Escape text for FFmpeg drawtext ──────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g,  "\u2019") // replace straight quote with curly to avoid filter issues
    .replace(/:/g,  '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .slice(0, 60); // truncate very long names
}

// ── Convert hex colour to FFmpeg 0xAARRGGBB format ───────────────────────────
function hexToFF(hex, alpha = 'FF') {
  const c = hex.replace('#', '');
  return `0x${alpha}${c.toUpperCase()}`;
}

// ── Build the drawtext + drawbox filter string for each template ──────────────
function buildFilterComplex(style, {
  eventTitle,
  guestName,
  showEventTitle,
  showGuestName,
  showDate,
  eventDate,
  textPosition,
  primaryColor,
  accentColor,
  targetW,
  targetH,
}) {
  const title    = esc(eventTitle  || '');
  const guest    = esc(guestName   || '');
  const dateStr  = esc(eventDate   || '');
  const primary  = primaryColor || '#7F77DD';
  const accent   = accentColor  || '#3C3489';

  // Scale to target dimensions first, pad if needed to maintain aspect
  const scaleFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;

  // Position helpers
  const isBottom = !textPosition || textPosition === 'bottom' || textPosition === 'bottom-left';
  const isLeft   = textPosition === 'bottom-left' || textPosition === 'top-left';
  const xAlign   = isLeft ? '20' : '(w-text_w)/2';
  const barH     = 90;

  // ── 1. MINIMAL — semi-transparent dark bar, clean white text ─────────────
  if (style === 'minimal') {
    const barY   = `h-${barH}`;
    const titleY = isBottom ? `h-${barH - 10}` : `10`;
    const guestY = isBottom ? `h-${barH - 48}` : `52`;

    const parts = [
      scaleFilter,
      `drawbox=x=0:y=${barY}:w=iw:h=${barH}:color=black@0.62:t=fill`,
    ];
    if (showEventTitle && title) {
      parts.push(`drawtext=fontfile=${F.bold}:text='${title}':fontcolor=white:fontsize=32:x=${xAlign}:y=${titleY}:shadowcolor=black@0.4:shadowx=1:shadowy=1`);
    }
    if (showGuestName && guest) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${guest}':fontcolor=white@0.85:fontsize=22:x=${xAlign}:y=${guestY}`);
    }
    if (showDate && dateStr) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${dateStr}':fontcolor=white@0.6:fontsize=18:x=w-text_w-20:y=h-${barH - 10}`);
    }
    return parts.join(',');
  }

  // ── 2. BOLD — solid primary-colour top + bottom banner ───────────────────
  if (style === 'bold') {
    const topH   = 80;
    const botH   = 70;
    const ffPrim = hexToFF(primary);
    const parts  = [
      scaleFilter,
      // Top banner
      `drawbox=x=0:y=0:w=iw:h=${topH}:color=${ffPrim}:t=fill`,
      // Bottom banner
      `drawbox=x=0:y=h-${botH}:w=iw:h=${botH}:color=${ffPrim}@0.9:t=fill`,
    ];
    if (showEventTitle && title) {
      parts.push(`drawtext=fontfile=${F.bold}:text='${title}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(${topH}-text_h)/2`);
    }
    if (showGuestName && guest) {
      parts.push(`drawtext=fontfile=${F.medium}:text='${guest}':fontcolor=white@0.9:fontsize=24:x=(w-text_w)/2:y=h-${botH}+(${botH}-text_h)/2`);
    }
    if (showDate && dateStr) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${dateStr}':fontcolor=white@0.7:fontsize=18:x=w-text_w-16:y=(${topH}-text_h)/2`);
    }
    return parts.join(',');
  }

  // ── 3. ELEGANT — gradient fade at bottom, serif font, colour accent line ──
  if (style === 'elegant') {
    const gradH  = 160;
    const lineH  = 3;
    const titleY = `h-70`;
    const guestY = `h-38`;

    const parts = [
      scaleFilter,
      // Gradient-style fade (approximated with stacked semi-transparent boxes)
      `drawbox=x=0:y=h-${gradH}:w=iw:h=${gradH}:color=black@0.0:t=fill`,
      `drawbox=x=0:y=h-${Math.round(gradH * 0.75)}:w=iw:h=${Math.round(gradH * 0.75)}:color=black@0.35:t=fill`,
      `drawbox=x=0:y=h-${Math.round(gradH * 0.5)}:w=iw:h=${Math.round(gradH * 0.5)}:color=black@0.55:t=fill`,
      `drawbox=x=0:y=h-${Math.round(gradH * 0.35)}:w=iw:h=${Math.round(gradH * 0.35)}:color=black@0.65:t=fill`,
      // Accent line above text
      `drawbox=x=30:y=h-80:w=iw-60:h=${lineH}:color=${hexToFF(primary)}:t=fill`,
    ];
    if (showEventTitle && title) {
      parts.push(`drawtext=fontfile=${F.serif}:text='${title}':fontcolor=white:fontsize=34:x=${xAlign}:y=${titleY}:shadowcolor=black@0.6:shadowx=2:shadowy=2`);
    }
    if (showGuestName && guest) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${guest}':fontcolor=${hexToFF(primary)}:fontsize=22:x=${xAlign}:y=${guestY}:itshape=1`);
    }
    if (showDate && dateStr) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${dateStr}':fontcolor=white@0.55:fontsize=16:x=w-text_w-30:y=h-38`);
    }
    return parts.join(',');
  }

  // ── 4. NEON — dark background, glowing coloured text ─────────────────────
  if (style === 'neon') {
    const barH2  = 100;
    const barY   = `h-${barH2}`;
    const titleY = `h-${barH2 - 12}`;
    const guestY = `h-${barH2 - 54}`;

    const parts = [
      scaleFilter,
      `drawbox=x=0:y=${barY}:w=iw:h=${barH2}:color=black@0.88:t=fill`,
      // Left accent bar
      `drawbox=x=0:y=${barY}:w=5:h=${barH2}:color=${hexToFF(primary)}:t=fill`,
    ];
    if (showEventTitle && title) {
      // Title in accent color (neon glow approximated with border)
      parts.push(`drawtext=fontfile=${F.bold}:text='${title}':fontcolor=${hexToFF(primary)}:fontsize=34:x=${isLeft ? '20' : xAlign}:y=${titleY}:borderw=2:bordercolor=${hexToFF(primary)}@0.5`);
    }
    if (showGuestName && guest) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${guest}':fontcolor=white@0.85:fontsize=22:x=${isLeft ? '20' : xAlign}:y=${guestY}`);
    }
    if (showDate && dateStr) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${dateStr}':fontcolor=${hexToFF(primary)}@0.7:fontsize=16:x=w-text_w-20:y=h-${barH2 - 10}`);
    }
    return parts.join(',');
  }

  // ── 5. CLASSIC — broadcast lower-third: coloured left block + text ────────
  if (style === 'classic') {
    const boxH   = 80;
    const boxW   = 420;
    const boxY   = `h-${boxH + 40}`;
    const xOff   = isLeft ? 0 : `(w-${boxW})/2`;

    const parts = [
      scaleFilter,
      // Coloured primary block
      `drawbox=x=${xOff}:y=${boxY}:w=${boxW}:h=${boxH}:color=${hexToFF(primary)}:t=fill`,
      // White right-extension bar
      `drawbox=x=${xOff}+${boxW}:y=${boxY}+${Math.round(boxH * 0.4)}:w=${Math.round(boxW * 0.15)}:h=${Math.round(boxH * 0.6)}:color=white@0.9:t=fill`,
    ];
    if (showEventTitle && title) {
      parts.push(`drawtext=fontfile=${F.bold}:text='${title}':fontcolor=white:fontsize=28:x=${xOff}+16:y=${boxY}+10`);
    }
    if (showGuestName && guest) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${guest}':fontcolor=white@0.88:fontsize=20:x=${xOff}+16:y=${boxY}+46`);
    }
    if (showDate && dateStr) {
      parts.push(`drawtext=fontfile=${F.regular}:text='${dateStr}':fontcolor=white@0.75:fontsize=15:x=${xOff}+16:y=${boxY}+${boxH}+6`);
    }
    return parts.join(',');
  }

  // Fallback — no overlay, just scale
  return scaleFilter;
}

// ── Run FFmpeg as a child process ─────────────────────────────────────────────
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => (stderr += d.toString()));
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', err => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
  });
}

// ── Write buffer to temp file, return path ────────────────────────────────────
function writeTempFile(buffer, ext = 'webm') {
  const p = path.join(os.tmpdir(), `eventify_${crypto.randomBytes(8).toString('hex')}.${ext}`);
  fs.writeFileSync(p, buffer);
  return p;
}

/**
 * Apply a branded frame overlay to a video buffer.
 *
 * @param {Buffer}  inputBuffer   Raw .webm / .mp4 buffer from Cloudinary
 * @param {object}  frameConfig   event.frame settings
 * @param {object}  eventInfo     { name, date, primaryColor, accentColor }
 * @param {string}  guestName
 * @param {object}  [targetSize]  { w, h } — default 1280×720
 * @returns {Promise<Buffer>}     Processed MP4 buffer
 */
async function applyFrameOverlay(inputBuffer, frameConfig, eventInfo, guestName, targetSize = { w: 1280, h: 720 }) {
  if (!frameConfig?.enabled) {
    // No frame — just transcode to mp4 at target size
    return transcodeOnly(inputBuffer, targetSize);
  }

  const inputPath  = writeTempFile(inputBuffer);
  const outputPath = writeTempFile(Buffer.alloc(0), 'mp4');
  fs.unlinkSync(outputPath); // FFmpeg will create it

  try {
    const filterStr = buildFilterComplex(frameConfig.style || 'minimal', {
      eventTitle:    eventInfo?.name || '',
      guestName,
      showEventTitle: frameConfig.showEventTitle !== false,
      showGuestName:  frameConfig.showGuestName  !== false,
      showDate:       frameConfig.showDate        === true,
      eventDate:      eventInfo?.date
        ? new Date(eventInfo.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '',
      textPosition:   frameConfig.textPosition || 'bottom',
      primaryColor:   eventInfo?.theme?.primaryColor || '#7F77DD',
      accentColor:    eventInfo?.theme?.accentColor  || '#3C3489',
      targetW:        targetSize.w,
      targetH:        targetSize.h,
    });

    await runFFmpeg([
      '-y',
      '-i', inputPath,
      '-vf', filterStr,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-max_muxing_queue_size', '1024',
      outputPath,
    ]);

    return fs.readFileSync(outputPath);
  } finally {
    [inputPath, outputPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
  }
}

/**
 * Transcode-only (no overlay) — just resize and encode to mp4.
 */
async function transcodeOnly(inputBuffer, targetSize = { w: 1280, h: 720 }) {
  const inputPath  = writeTempFile(inputBuffer);
  const outputPath = path.join(os.tmpdir(), `eventify_tc_${crypto.randomBytes(6).toString('hex')}.mp4`);

  try {
    await runFFmpeg([
      '-y',
      '-i', inputPath,
      '-vf', `scale=${targetSize.w}:${targetSize.h}:force_original_aspect_ratio=decrease,pad=${targetSize.w}:${targetSize.h}:(ow-iw)/2:(oh-ih)/2:black`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]);
    return fs.readFileSync(outputPath);
  } finally {
    [inputPath, outputPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
  }
}

/**
 * Generate all social platform variants of a processed video.
 *
 * @param {Buffer}  framedBuffer   Already-framed mp4 buffer
 * @param {string[]} platforms     e.g. ['tiktok', 'instagram']
 * @returns {Promise<Object>}      { tiktok: Buffer, instagram: Buffer, ... }
 */
async function generateSocialVariants(framedBuffer, platforms = []) {
  const results = {};

  await Promise.all(
    platforms.map(async (platform) => {
      const config = SOCIAL_CONFIGS[platform];
      if (!config) return;

      const inputPath  = writeTempFile(framedBuffer, 'mp4');
      const outputPath = path.join(os.tmpdir(), `eventify_${platform}_${crypto.randomBytes(6).toString('hex')}.mp4`);

      try {
        await runFFmpeg([
          '-y',
          '-i', inputPath,
          '-vf', `scale=${config.w}:${config.h}:force_original_aspect_ratio=decrease,pad=${config.w}:${config.h}:(ow-iw)/2:(oh-ih)/2:black`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputPath,
        ]);
        results[platform] = fs.readFileSync(outputPath);
      } catch (err) {
        console.error(`[FFmpeg ${platform}]`, err.message);
        results[platform] = null; // non-fatal per platform
      } finally {
        [inputPath, outputPath].forEach(p => { try { fs.unlinkSync(p); } catch {} });
      }
    })
  );

  return results;
}

/**
 * Download a Cloudinary video as a Buffer using its secure URL.
 */
function downloadBuffer(url) {
  const https = require('https');
  const http  = require('http');
  const lib   = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(downloadBuffer(res.headers.location));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  applyFrameOverlay,
  generateSocialVariants,
  transcodeOnly,
  downloadBuffer,
  SOCIAL_CONFIGS,
};
