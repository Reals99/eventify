const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never return password in queries by default
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin'],
      default: 'admin',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,

    // ── Social OAuth tokens (one per platform) ────────────────────────────
    socialTokens: {
      tiktok:    { accessToken: String, refreshToken: String, expiresAt: Number, userId: String, username: String, savedAt: Date },
      instagram: { accessToken: String, refreshToken: String, expiresAt: Number, userId: String, username: String, savedAt: Date },
      facebook:  { accessToken: String, refreshToken: String, expiresAt: Number, userId: String, username: String, savedAt: Date },
      twitter:   { accessToken: String, refreshToken: String, expiresAt: Number, userId: String, username: String, savedAt: Date },
      youtube:   { accessToken: String, refreshToken: String, expiresAt: Number, userId: String, username: String, savedAt: Date },
    },
  },
  { timestamps: true }
);

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never return password in JSON
adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Admin', adminSchema);
