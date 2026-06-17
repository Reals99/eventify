const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * Protect routes — verifies JWT and attaches admin to req.admin
 */
const protect = async (req, res, next) => {
  try {
    // Accept token from Authorization header or cookie
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    // Verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch admin (ensures account still exists and is active)
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

/**
 * Restrict to superadmin role
 */
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required.' });
  }
  next();
};

/**
 * Generate a signed JWT for an admin
 */
const signToken = (admin) =>
  jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

module.exports = { protect, superAdminOnly, signToken };
