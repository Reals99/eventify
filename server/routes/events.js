const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../services/cloudinary');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, SVG, WebP) are accepted.'), false);
    }
  },
});

// ── PUBLIC: slug lookup (kiosk uses this — no auth required) ──────────────
router.get('/slug/:slug', async (req, res) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug, status: 'active' })
      .select('name description date location theme frame kiosk slug _id')
      .lean();
    if (!event) return res.status(404).json({ error: 'Event not found or not active.' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All routes below require authentication
router.use(protect);

// ── POST /api/events/upload-logo ──────────────────────────────────────────
// Upload event logo from device gallery / computer
router.post('/upload-logo', imageUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo image file was provided.' });

    let logoUrl = '';
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME) {
      const result = await uploadImage(req.file.buffer, { folder: 'eventify/logos' });
      logoUrl = result.secureUrl;
    } else {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const ext = req.file.originalname ? path.extname(req.file.originalname) || '.png' : '.png';
      const fileName = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, fileName), req.file.buffer);
      const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
      logoUrl = `${serverUrl}/uploads/${fileName}`;
    }

    res.json({ url: logoUrl });
  } catch (err) {
    console.error('[Logo Upload]', err.message);
    res.status(500).json({ error: err.message || 'Logo upload failed.' });
  }
});

// ── GET /api/events ───────────────────────────────────────────────────────
// List all events for this admin
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { createdBy: req.admin._id };
    if (status) filter.status = status;

    const events = await Event.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Event.countDocuments(filter);

    res.json({ events, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────
// Create a new event
router.post('/', async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, createdBy: req.admin._id });
    res.status(201).json({ event });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/events/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      createdBy: req.admin._id,
    });
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/events/:id ─────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.admin._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/events/:id/status ──────────────────────────────────────────
// Quickly activate / end / archive an event
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'active', 'ended', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.admin._id },
      { status },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.admin._id,
    });
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
