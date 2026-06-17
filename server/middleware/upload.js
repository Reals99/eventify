/**
 * Multer middleware — stores upload in memory (buffer).
 * We pass the buffer directly to Cloudinary — no disk I/O.
 *
 * Limits:
 *   - 200 MB max file size (Cloudinary free tier supports up to 100 MB per upload)
 *   - Only video/webm and audio/webm accepted
 */
const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = ['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Only webm/mp4 accepted.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

module.exports = upload;
