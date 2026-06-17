const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },

    // ── Guest info ─────────────────────────────────────────────────────────
    guestName: { type: String, default: 'Anonymous', trim: true, maxlength: 80 },
    phase: {
      type: String,
      enum: ['expectation', 'takeaway'],
      required: true,
    },
    recordingType: {
      type: String,
      enum: ['video', 'audio'],
      required: true,
    },

    // ── Raw file (Cloudinary) ──────────────────────────────────────────────
    cloudinary: {
      publicId: String,
      url: String,        // original URL
      secureUrl: String,  // https URL
      format: String,
      duration: Number,   // seconds
      bytes: Number,
      width: Number,
      height: Number,
    },

    // ── Google Drive (raw export) ──────────────────────────────────────────
    drive: {
      fileId: String,
      webViewLink: String,
      uploaded: { type: Boolean, default: false },
      uploadedAt: Date,
    },

    // ── Processed versions (after FFmpeg frame overlay) ────────────────────
    processed: {
      framed: {           // with event frame overlay
        cloudinaryId: String,
        url: String,
      },
      tiktok: { cloudinaryId: String, url: String },      // 9:16
      instagram: { cloudinaryId: String, url: String },   // 1:1
      facebook: { cloudinaryId: String, url: String },    // 16:9
      twitter: { cloudinaryId: String, url: String },     // 16:9
      youtube: { cloudinaryId: String, url: String },     // 16:9
    },

    // ── Review ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'flagged'],
      default: 'pending',
      index: true,
    },
    reviewNote: { type: String, default: '', maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: Date,

    // ── Publishing ─────────────────────────────────────────────────────────
    published: {
      tiktok:    { done: Boolean, postId: String, publishedAt: Date, error: String },
      instagram: { done: Boolean, postId: String, publishedAt: Date, error: String },
      facebook:  { done: Boolean, postId: String, publishedAt: Date, error: String },
      twitter:   { done: Boolean, postId: String, publishedAt: Date, error: String },
      youtube:   { done: Boolean, postId: String, publishedAt: Date, error: String },
    },

    // ── Caption / hashtags (can be overridden per video) ───────────────────
    caption: { type: String, default: '' },
    hashtags: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
