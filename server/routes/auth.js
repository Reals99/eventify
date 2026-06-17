const router = require('express').Router();
const Admin = require('../models/Admin');
const { protect, signToken } = require('../middleware/auth');
const { getAuthUrl, exchangeCodeForTokens, isDriveConnected } = require('../services/googleDrive');

// ── POST /api/auth/register ───────────────────────────────────────────────
// Creates the first superadmin (only works when no admins exist yet)
// or creates a new admin when called by an existing superadmin
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Check if any admin exists yet (first-time setup)
    const adminCount = await Admin.countDocuments();
    const isFirstAdmin = adminCount === 0;

    // If admins already exist, this endpoint requires auth (handled separately via /invite)
    // For now: open only for first admin setup
    if (!isFirstAdmin) {
      return res.status(403).json({
        error: 'Registration is closed. Ask your superadmin to invite you.',
      });
    }

    // Check duplicate email
    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const admin = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: isFirstAdmin ? 'superadmin' : (role || 'admin'),
    });

    const token = signToken(admin);

    res.status(201).json({
      message: isFirstAdmin
        ? 'Superadmin account created successfully!'
        : 'Admin account created successfully!',
      token,
      admin,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Include password field explicitly (it's select:false on schema)
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = signToken(admin);

    res.json({
      message: 'Login successful',
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
// Returns the currently authenticated admin's profile
router.get('/me', protect, async (req, res) => {
  res.json({ admin: req.admin });
});

// ── PATCH /api/auth/password ──────────────────────────────────────────────
// Change password (authenticated)
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/invite ─────────────────────────────────────────────────
// Superadmin creates a new admin account
router.post('/invite', protect, async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can invite new admins.' });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const admin = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'admin',
    });

    res.status(201).json({ message: 'Admin invited successfully.', admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/first-run ───────────────────────────────────────────────
// Public — tells client whether any admin exists yet.
// Used to auto-redirect to /admin/setup on first boot.
router.get('/first-run', async (_req, res) => {
  try {
    const count = await Admin.countDocuments();
    res.json({ isFirstRun: count === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// ── GET /api/auth/google ───────────────────────────────────────────────────
// Redirect admin to Google consent screen
router.get('/google', protect, (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google Drive not configured. Add credentials to .env' });
  }
  res.redirect(getAuthUrl());
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────
// Google redirects here after consent — exchange code for tokens
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Google auth error: ${error}`);
  if (!code)  return res.status(400).send('No auth code received.');

  try {
    await exchangeCodeForTokens(code);
    // Redirect back to admin dashboard with success flag
    res.redirect(`${process.env.CLIENT_URL}/admin?drive=connected`);
  } catch (err) {
    res.status(500).send(`Token exchange failed: ${err.message}`);
  }
});

// ── GET /api/auth/drive-status ────────────────────────────────────────────
router.get('/drive-status', protect, async (_req, res) => {
  const connected = await isDriveConnected();
  res.json({ connected });
});
