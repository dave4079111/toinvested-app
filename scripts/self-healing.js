const fs = require('fs');
const path = require('path');
const { logger } = require('../api/logger');

const HEALTH_INTERVAL = Number(process.env.HEALTH_CHECK_INTERVAL) || 60000; // Check every 60s
const MAX_MEMORY_MB = 512;
const MAX_LOG_SIZE_MB = 50;

let healthCheckTimer = null;
let failureCount = 0;
const MAX_FAILURES = Number(process.env.MAX_RESTART_ATTEMPTS) || 5;

function setupSelfHealing(server, app) {
  logger.info('Self-healing system activated');

  // Periodic health checks
  healthCheckTimer = setInterval(() => {
    runHealthChecks(server, app);
  }, HEALTH_INTERVAL);

  // Handle uncaught errors without crashing
  process.on('uncaughtException', (err) => {
    logger.error('SELF-HEAL: Uncaught exception caught', { error: err.message, stack: err.stack });
    logHealthEvent('error', `Uncaught exception: ${err.message}`, 'Error caught and logged, server continuing');
    failureCount++;

    if (failureCount >= MAX_FAILURES) {
      logger.error('SELF-HEAL: Too many failures, initiating graceful restart');
      logHealthEvent('critical', `${failureCount} failures detected`, 'Initiating graceful restart');
      gracefulRestart(server);
    }
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('SELF-HEAL: Unhandled promise rejection', { reason: String(reason) });
    logHealthEvent('warning', `Unhandled rejection: ${String(reason)}`, 'Logged and continuing');
  });

  // Reset failure count periodically (every 10 minutes of stability)
  setInterval(() => {
    if (failureCount > 0) {
      logger.info(`SELF-HEAL: Resetting failure count from ${failureCount} (system stable)`);
      failureCount = 0;
    }
  }, 600000);

  logger.info('Self-healing monitoring started', { interval: HEALTH_INTERVAL });
}

function runHealthChecks(server, app) {
  try {
    // 1. Memory check
    const memory = process.memoryUsage();
    const heapUsedMB = memory.heapUsed / 1024 / 1024;
    if (heapUsedMB > MAX_MEMORY_MB) {
      logger.warn('SELF-HEAL: High memory usage detected', { heapUsedMB: Math.round(heapUsedMB) });
      logHealthEvent('warning', `High memory: ${Math.round(heapUsedMB)}MB`, 'Triggering garbage collection');
      if (global.gc) global.gc();
    }

    // 2. Database check
    checkDatabase();

    // 3. Log rotation
    rotateLogs();

    // 4. Verify critical files exist
    verifyCriticalFiles();

    // 5. Check disk space for data directory
    checkDataDirectory();

    logHealthEvent('ok', `Health check passed. Memory: ${Math.round(heapUsedMB)}MB, Uptime: ${Math.round(process.uptime())}s`);

  } catch (err) {
    logger.error('SELF-HEAL: Health check failed', { error: err.message });
    logHealthEvent('error', `Health check failed: ${err.message}`, 'Will retry next interval');
  }
}

function checkDatabase() {
  try {
    const { getDb } = require('../api/database');
    const db = getDb();
    // Simple query to verify DB is responsive
    db.prepare('SELECT 1').get();

    // Check DB integrity periodically (every 10th check)
    if (Math.random() < 0.1) {
      const integrity = db.pragma('integrity_check');
      if (integrity[0]?.integrity_check !== 'ok') {
        logger.error('SELF-HEAL: Database integrity check failed');
        logHealthEvent('critical', 'Database integrity check failed', 'Manual intervention may be needed');
      }
    }
  } catch (err) {
    logger.error('SELF-HEAL: Database check failed', { error: err.message });

    // Try to repair by reinitializing
    try {
      const { initDatabase } = require('../api/database');
      initDatabase();
      logHealthEvent('repair', 'Database connection lost', 'Successfully reinitialized database');
    } catch (reinitErr) {
      logHealthEvent('critical', 'Database repair failed', reinitErr.message);
    }
  }
}

function rotateLogs() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    return;
  }

  try {
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stat = fs.statSync(filePath);
      const sizeMB = stat.size / 1024 / 1024;

      if (sizeMB > MAX_LOG_SIZE_MB) {
        // Truncate the file to keep last 10% of content
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const keepLines = lines.slice(Math.floor(lines.length * 0.9));
        fs.writeFileSync(filePath, keepLines.join('\n'));
        logger.info(`SELF-HEAL: Rotated log file ${file} (was ${Math.round(sizeMB)}MB)`);
        logHealthEvent('maintenance', `Log file ${file} rotated`, `Reduced from ${Math.round(sizeMB)}MB`);
      }
    }
  } catch (err) {
    logger.error('SELF-HEAL: Log rotation failed', { error: err.message });
  }
}

function verifyCriticalFiles() {
  const criticalPaths = [
    'site/index.html',
    'api/database.js',
    'api/routes/auth.js',
    'api/routes/content.js',
    'api/routes/products.js',
    'api/routes/leads.js',
    'api/routes/analyzers.js',
    'server.js',
    'package.json'
  ];

  for (const filePath of criticalPaths) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      logger.error(`SELF-HEAL: Critical file missing: ${filePath}`);
      logHealthEvent('critical', `Missing file: ${filePath}`, 'File needs to be restored from backup or git');
    }
  }
}

function checkDataDirectory() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logHealthEvent('repair', 'Data directory missing', 'Created data directory');
  }

  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logHealthEvent('repair', 'Logs directory missing', 'Created logs directory');
  }
}

function gracefulRestart(server) {
  logger.info('SELF-HEAL: Initiating graceful restart...');

  if (healthCheckTimer) clearInterval(healthCheckTimer);

  server.close(() => {
    logger.info('SELF-HEAL: Server closed, restarting...');
    // In production, PM2 or Docker will restart the process
    process.exit(1);
  });

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('SELF-HEAL: Forced restart after timeout');
    process.exit(1);
  }, 10000);
}

function logHealthEvent(status, details, actionTaken) {
  try {
    const { getDb } = require('../api/database');
    const db = getDb();
    db.prepare('INSERT INTO health_log (status, details, action_taken) VALUES (?, ?, ?)')
      .run(status, details, actionTaken || '');
  } catch (err) {
    // If we can't log to DB, at least log to file
    logger.error('Could not log health event to DB', { status, details });
  }
}

// Standalone health check (run via npm run health)
if (require.main === module) {
  const http = require('http');
  const port = process.env.PORT || 3000;

  const req = http.get(`http://localhost:${port}/api/health`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log('✅ Server is healthy');
        console.log(`   Status: ${health.status}`);
        console.log(`   Uptime: ${Math.round(health.uptime)}s`);
        console.log(`   Memory: ${Math.round(health.memory.heapUsed / 1024 / 1024)}MB`);
        process.exit(0);
      } catch (e) {
        console.log('❌ Server responded but health check parse failed');
        process.exit(1);
      }
    });
  });

  req.on('error', () => {
    console.log('❌ Server is not responding');
    process.exit(1);
  });

  req.setTimeout(5000, () => {
    console.log('❌ Health check timed out');
    req.destroy();
    process.exit(1);
  });
}

module.exports = { setupSelfHealing };
