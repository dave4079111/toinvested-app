require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const session = require('express-session');
const { initDatabase } = require('./api/database');
const { setupSelfHealing } = require('./scripts/self-healing');
const { logger } = require('./api/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARE
// ===========================================
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles/scripts in static pages
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Stripe webhooks need raw body BEFORE json parsing
app.use('/api/products/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ===========================================
// API ROUTES
// ===========================================
app.use('/api/auth', require('./api/routes/auth'));
app.use('/api/content', require('./api/routes/content'));
app.use('/api/products', require('./api/routes/products'));
app.use('/api/leads', require('./api/routes/leads'));
app.use('/api/analyzers', require('./api/routes/analyzers'));
app.use('/api/admin', require('./api/routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: require('./package.json').version
  };
  res.json(health);
});

// ===========================================
// STATIC FILES (serve the site)
// ===========================================
app.use(express.static(path.join(__dirname, 'site'), {
  extensions: ['html'],
  index: 'index.html',
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders: (res, filePath) => {
    // Cache static assets aggressively in production
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.webp') || filePath.endsWith('.svg')) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
    // HTML pages get short cache for fresh content
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  }
}));

// SPA fallback - serve index.html for unmatched routes
app.get('*', (req, res) => {
  // If the request looks like an API call, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'site', 'index.html'));
});

// ===========================================
// GLOBAL ERROR HANDLER
// ===========================================
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({
    error: 'Something went wrong. The system has logged this error and will auto-repair if needed.',
    requestId: Date.now().toString(36)
  });
});

// ===========================================
// START SERVER
// ===========================================
async function start() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`ToInvested server running on port ${PORT}`);
      console.log(`\n🚀 ToInvested.com is live at http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Admin panel: http://localhost:${PORT}/admin\n`);
    });

    // Setup self-healing monitoring
    setupSelfHealing(server, app);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => process.exit(0));
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      // Self-healing will handle restart if needed
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
    });

  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
