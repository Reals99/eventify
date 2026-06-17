const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { generateEventCaption } = require('../services/claude');

// POST /api/ai/caption
// Body: { name, description, date, location }
// Returns: { description, hashtags }
router.post('/caption', protect, async (req, res) => {
  try {
    const { name, description, date, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Event name is required.' });

    const result = await generateEventCaption({ name, description, date, location });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
