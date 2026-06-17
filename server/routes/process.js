/**
 * POST /api/process/:videoId
 *
 * Called when an admin approves a video.
 * 1. Downloads raw video from Cloudinary
 * 2. Applies the event's frame overlay via FFmpeg
 * 3. Generates social-platform variants (tiktok=9:16, instagram=1:1, etc.)
 * 4. Uploads all processed versions back to Cloudinary
 * 5. Updates the Video document with processed URLs
 */

const router = require('express').Router();
const Video  = require('../models/Video');
const Event  = require('../models/Event');
const { protect } = require('../middleware/auth');
const { uploadVideo } = require('../services/cloudinary');
const {
  applyFrameOverlay,
  generateSocialVariants,
  downloadBuffer,
  SOCIAL_CONFIGS,
} = require('../services/ffmpeg');

// ── POST /api/process/:videoId ────────────────────────────────────────────────
router.post('/:videoId', protect, async (req, res) => {
  const { videoId } = req.params;

  // Validate video exists and is approved
  const video = await Video.findById(videoId).lean();
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  if (video.status !== 'approved') {
    return res.status(400).json({ error: 'Video must be approved before processing.' });
  }
  if (!video.cloudinary?.secureUrl) {
    return res.status(400).json({ error: 'No source video URL on record.' });
  }

  // Load the event for frame config + theme
  const event = await Event.findById(video.event).lean();
  if (!event) return res.status(404).json({ error: 'Associated event not found.' });

  // Respond immediately — processing is async (can take 10-60s)
  res.json({ message: 'Processing started.', videoId });

  // ── Background processing ──────────────────────────────────────────────────
  _processVideo(video, event).catch(err => {
    console.error(`[Process ${videoId}]`, err.message);
    Video.findByIdAndUpdate(videoId, { 'processed.error': err.message }).catch(() => {});
  });
});

async function _processVideo(video, event) {
  const videoId = video._id.toString();
  console.log(`[Process] Starting ${videoId} — style: ${event.frame?.style || 'minimal'}`);

  // 1. Download raw buffer from Cloudinary
  const rawBuffer = await downloadBuffer(video.cloudinary.secureUrl);
  console.log(`[Process] Downloaded ${rawBuffer.length} bytes`);

  // 2. Apply frame overlay (produces 1280×720 mp4 by default)
  const framedBuffer = await applyFrameOverlay(
    rawBuffer,
    event.frame,
    {
      name:  event.name,
      date:  event.date,
      theme: event.theme,
    },
    video.guestName
  );
  console.log(`[Process] Frame applied — ${framedBuffer.length} bytes`);

  // 3. Upload framed version to Cloudinary
  const framedPublicId = `${video.cloudinary.publicId}_framed`;
  const framedUpload = await uploadVideo(framedBuffer, {
    eventSlug:    event.slug,
    publicId:     framedPublicId,
    resourceType: 'video',
  });
  console.log(`[Process] Framed uploaded: ${framedUpload.secureUrl}`);

  // Partial save — framed version available immediately
  await Video.findByIdAndUpdate(videoId, {
    'processed.framed.cloudinaryId': framedUpload.publicId,
    'processed.framed.url':          framedUpload.secureUrl,
  });

  // 4. Determine which social platforms need variants
  const enabledPlatforms = Object.entries(event.socials || {})
    .filter(([, enabled]) => enabled)
    .map(([k]) => k);

  if (enabledPlatforms.length === 0) {
    console.log(`[Process] No social platforms enabled — done.`);
    return;
  }

  // 5. Generate social variants from the framed version
  const variants = await generateSocialVariants(framedBuffer, enabledPlatforms);
  console.log(`[Process] Social variants generated: ${Object.keys(variants).join(', ')}`);

  // 6. Upload each variant to Cloudinary
  const updatePayload = {};

  await Promise.all(
    enabledPlatforms.map(async (platform) => {
      const buf = variants[platform];
      if (!buf) {
        console.warn(`[Process] No buffer for ${platform} — skipping`);
        return;
      }

      try {
        const result = await uploadVideo(buf, {
          eventSlug:    event.slug,
          publicId:     `${video.cloudinary.publicId}_${platform}`,
          resourceType: 'video',
        });
        updatePayload[`processed.${platform}.cloudinaryId`] = result.publicId;
        updatePayload[`processed.${platform}.url`]          = result.secureUrl;
        console.log(`[Process] ${platform} uploaded: ${result.secureUrl}`);
      } catch (err) {
        console.error(`[Process] ${platform} upload failed:`, err.message);
      }
    })
  );

  // 7. Final DB update
  if (Object.keys(updatePayload).length > 0) {
    await Video.findByIdAndUpdate(videoId, updatePayload);
  }

  console.log(`[Process] ✅ Complete for ${videoId}`);
}

// ── GET /api/process/:videoId/status ─────────────────────────────────────────
// Poll to check if processing is done
router.get('/:videoId/status', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId)
      .select('processed cloudinary status')
      .lean();
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    const done = !!(video.processed?.framed?.url);
    res.json({
      ready:       done,
      framedUrl:   video.processed?.framed?.url   || null,
      tiktokUrl:   video.processed?.tiktok?.url   || null,
      instagramUrl: video.processed?.instagram?.url || null,
      facebookUrl: video.processed?.facebook?.url  || null,
      twitterUrl:  video.processed?.twitter?.url   || null,
      youtubeUrl:  video.processed?.youtube?.url   || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
