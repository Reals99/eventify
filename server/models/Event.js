const mongoose = require('mongoose');

// ── Frame template options ───────────────────────────────────────────────────
const FRAME_STYLES = ['minimal', 'bold', 'elegant', 'neon', 'classic'];

const eventSchema = new mongoose.Schema(
  {
    // Basic info
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // ── Theme ──────────────────────────────────────────────────────────────
    theme: {
      primaryColor: { type: String, default: '#7F77DD' },   // hex
      secondaryColor: { type: String, default: '#EEEDFE' },
      accentColor: { type: String, default: '#3C3489' },
      fontStyle: {
        type: String,
        enum: ['modern', 'serif', 'playful', 'corporate'],
        default: 'modern',
      },
      preset: {
        type: String,
        enum: ['purple', 'teal', 'coral', 'amber', 'dark', 'custom'],
        default: 'purple',
      },
    },

    // ── Frame / overlay settings ───────────────────────────────────────────
    frame: {
      enabled: { type: Boolean, default: true },
      style: {
        type: String,
        enum: FRAME_STYLES,
        default: 'minimal',
      },
      showEventTitle: { type: Boolean, default: true },
      showGuestName: { type: Boolean, default: true },
      showDate: { type: Boolean, default: false },
      showLogo: { type: Boolean, default: false },
      logoUrl: { type: String, default: '' },
      // position of text overlay on video
      textPosition: {
        type: String,
        enum: ['bottom', 'top', 'top-left', 'bottom-left'],
        default: 'bottom',
      },
    },

    // ── Social / publishing ────────────────────────────────────────────────
    hashtags: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'Maximum 5 hashtags allowed',
      },
      default: [],
    },
    postDescription: {
      type: String,
      maxlength: 2200,
      default: '',
    },
    // which socials are enabled for this event
    socials: {
      tiktok: { type: Boolean, default: false },
      instagram: { type: Boolean, default: false },
      facebook: { type: Boolean, default: false },
      twitter: { type: Boolean, default: false },
      youtube: { type: Boolean, default: false },
    },

    // ── Google Drive ───────────────────────────────────────────────────────
    driveFolderId: { type: String, default: '' },
    driveFolderName: { type: String, default: '' },

    // ── Kiosk settings ─────────────────────────────────────────────────────
    kiosk: {
      welcomeMessage: { type: String, default: 'Welcome! Tap to record your message.' },
      maxRecordingSeconds: { type: Number, default: 120 },
      allowVideo: { type: Boolean, default: true },
      allowAudio: { type: Boolean, default: true },
      askGuestName: { type: Boolean, default: true },
    },

    // ── Status ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'active', 'ended', 'archived'],
      default: 'draft',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },

    // ── Stats (denormalised for quick reads) ───────────────────────────────
    stats: {
      totalRecordings: { type: Number, default: 0 },
      approvedCount: { type: Number, default: 0 },
      flaggedCount: { type: Number, default: 0 },
      publishedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Auto-generate slug from name
eventSchema.pre('save', function (next) {
  if (!this.isModified('name') && this.slug) return next();
  this.slug =
    this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString(36);
  next();
});

module.exports = mongoose.model('Event', eventSchema);
