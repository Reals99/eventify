const router  = require('express').Router();
const Video   = require('../models/Video');
const Event   = require('../models/Event');
const { protect }         = require('../middleware/auth');
const upload              = require('../middleware/upload');
const { uploadVideo, deleteVideo } = require('../services/cloudinary');
const { uploadToDrive, isDriveConnected } = require('../services/googleDrive');

// ── POST /api/videos/upload ───────────────────────────────────────────────────
// Called by the guest kiosk — no admin auth required.
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { eventId, guestName, phase, recordingType } = req.body;

    if (!req.file)      return res.status(400).json({ error: 'No file received.' });
    if (!eventId)       return res.status(400).json({ error: 'eventId is required.' });
    if (!phase)         return res.status(400).json({ error: 'phase is required.' });
    if (!recordingType) return res.status(400).json({ error: 'recordingType is required.' });

    const event = await Event.findOne({ _id: eventId, status: 'active' });
    if (!event) return res.status(404).json({ error: 'Event not found or not active.' });

    const safeName = (guestName || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const ts       = Date.now();
    const publicId = `${safeName}_${phase}_${ts}`;
    const fileName = `${publicId}.webm`;

    // ── Upload to Cloudinary ──────────────────────────────────────────────
    let cloudinaryData;
    try {
      cloudinaryData = await uploadVideo(req.file.buffer, {
        eventSlug:    event.slug,
        publicId,
        resourceType: 'video',
      });
    } catch (cloudErr) {
      console.error('[Cloudinary Error]', cloudErr.message);
      return res.status(502).json({ error: 'Video storage failed: ' + cloudErr.message });
    }

    // ── Upload raw to Google Drive (async, best-effort) ───────────────────
    const driveEnabled = await isDriveConnected();
    let driveData = { uploaded: false };
    if (driveEnabled) {
      uploadToDrive(req.file.buffer, {
        eventName: event.name,
        fileName,
        mimeType: req.file.mimetype || 'video/webm',
      })
        .then(({ fileId, webViewLink }) => {
          Video.findOneAndUpdate(
            { 'cloudinary.publicId': cloudinaryData.publicId },
            { 'drive.fileId': fileId, 'drive.webViewLink': webViewLink, 'drive.uploaded': true, 'drive.uploadedAt': new Date() }
          ).catch(e => console.error('[Drive DB]', e.message));
        })
        .catch(e => console.error('[Drive Upload]', e.message));
    }

    // ── Save Video record ─────────────────────────────────────────────────
    const video = await Video.create({
      event: event._id,
      guestName: guestName || 'Anonymous',
      phase,
      recordingType,
      cloudinary: {
        publicId:  cloudinaryData.publicId,
        url:       cloudinaryData.url,
        secureUrl: cloudinaryData.secureUrl,
        format:    cloudinaryData.format,
        duration:  cloudinaryData.duration,
        bytes:     cloudinaryData.bytes,
        width:     cloudinaryData.width,
        height:    cloudinaryData.height,
      },
      drive: driveData,
      status: 'pending',
    });

    await Event.findByIdAndUpdate(event._id, { $inc: { 'stats.totalRecordings': 1 } });

    res.status(201).json({
      message: 'Recording saved successfully.',
      videoId: video._id,
      cloudinaryUrl: cloudinaryData.secureUrl,
      driveQueued: driveEnabled,
    });
  } catch (err) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: err.message || 'Upload failed.' });
  }
});

// ── GET /api/videos ───────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { eventId, status, phase, page = 1, limit = 20 } = req.query;
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    const filter = { event: eventId };
    if (status) filter.status = status;
    if (phase)  filter.phase  = phase;

    const [videos, total] = await Promise.all([
      Video.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).lean(),
      Video.countDocuments(filter),
    ]);

    res.json({ videos, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/videos/:id ───────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).lean();
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    res.json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/videos/:id/review ─────────────────────────────────────────────
router.patch('/:id/review', protect, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['approved', 'flagged', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Status must be: approved, flagged or pending.' });
    }
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote: reviewNote || '', reviewedBy: req.admin._id, reviewedAt: new Date() },
      { new: true }
    );
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    await _updateEventStats(video.event);
    res.json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/videos/:id/caption ────────────────────────────────────────────
router.patch('/:id/caption', protect, async (req, res) => {
  try {
    const { caption, hashtags } = req.body;
    const video = await Video.findByIdAndUpdate(req.params.id, { caption: caption || '', hashtags: hashtags || [] }, { new: true });
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    res.json({ video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/videos/:id ────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    if (video.cloudinary?.publicId) {
      deleteVideo(video.cloudinary.publicId).catch(e => console.error('[Cloudinary Delete]', e.message));
    }
    await Video.findByIdAndDelete(req.params.id);
    await _updateEventStats(video.event);
    res.json({ message: 'Video deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/videos/:id/drive-status ─────────────────────────────────────────
router.get('/:id/drive-status', protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).select('drive').lean();
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    res.json({ drive: video.drive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
async function _updateEventStats(eventId) {
  const [total, approved, flagged, published] = await Promise.all([
    Video.countDocuments({ event: eventId }),
    Video.countDocuments({ event: eventId, status: 'approved' }),
    Video.countDocuments({ event: eventId, status: 'flagged' }),
    Video.countDocuments({
      event: eventId,
      $or: [
        { 'published.tiktok.done': true }, { 'published.instagram.done': true },
        { 'published.facebook.done': true }, { 'published.twitter.done': true },
        { 'published.youtube.done': true },
      ],
    }),
  ]);
  await Event.findByIdAndUpdate(eventId, {
    'stats.totalRecordings': total, 'stats.approvedCount': approved,
    'stats.flaggedCount': flagged,  'stats.publishedCount': published,
  });
}

module.exports = router;
