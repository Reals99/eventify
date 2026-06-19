require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const eventRoutes   = require('./routes/events');
const videoRoutes   = require('./routes/videos');
const aiRoutes      = require('./routes/ai');
const processRoutes = require('./routes/process');
const socialRoutes  = require('./routes/social');

const app = express();

// ── Trust proxy (required on Render behind load balancer) ─────────────────────
app.set('trust proxy', 1);

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary video embeds
}));

const allowedOrigins = [
  process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return cb(null, true);
    
    // Exact match
    if (allowedOrigins.includes(origin)) return cb(null, true);
    
    // Auto-allow any Vercel deployment of this app for seamless preview/prod
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve local uploads fallback ──────────────────────────────────────────────
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,             // 10 uploads per minute per IP
  message: { error: 'Too many uploads. Please wait a moment.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',    authLimiter,    authRoutes);
app.use('/api/videos',  uploadLimiter,  videoRoutes);
app.use('/api/events',  generalLimiter, eventRoutes);
app.use('/api/ai',      generalLimiter, aiRoutes);
app.use('/api/process', generalLimiter, processRoutes);
app.use('/api/social',  generalLimiter, socialRoutes);

// Health check (used by Render, uptime monitors)
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    app:     'Eventify',
    env:     process.env.NODE_ENV || 'development',
    uptime:  Math.floor(process.uptime()) + 's',
  });
});

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[Server Error]', err.message, err.stack);
  res.status(status).json({
    error: err.message,
    stack: err.stack
  });
});

// ── Global Error Handling ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err.message, err.stack);
  process.exit(1);
});

// ── Database + server start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const mongoOpts = {
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS:          45_000,
};

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI, mongoOpts);
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 Eventify server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

start();
