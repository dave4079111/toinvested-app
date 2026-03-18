#!/usr/bin/env node
/**
 * ToInvested.com Process Monitor
 * Keeps the server running and auto-restarts on failure.
 * Usage: npm run monitor
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MAX_RESTARTS = 10;
const RESTART_DELAY = 3000; // 3 seconds
const RESET_TIMER = 600000; // Reset restart count after 10 min of stability

let restartCount = 0;
let lastRestart = Date.now();

function startServer() {
  console.log(`\n🔄 Starting ToInvested server (attempt ${restartCount + 1})...\n`);

  const server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env }
  });

  server.on('exit', (code) => {
    if (code === 0) {
      console.log('\n✅ Server stopped gracefully.');
      return;
    }

    console.log(`\n⚠️  Server exited with code ${code}`);

    // Reset counter if server has been stable for a while
    if (Date.now() - lastRestart > RESET_TIMER) {
      restartCount = 0;
    }

    restartCount++;
    lastRestart = Date.now();

    if (restartCount >= MAX_RESTARTS) {
      console.log(`\n❌ Server crashed ${MAX_RESTARTS} times. Stopping monitor.`);
      console.log('   Check logs/error.log for details.\n');

      // Write crash report
      const report = {
        timestamp: new Date().toISOString(),
        restarts: restartCount,
        lastExitCode: code,
        message: 'Server exceeded maximum restart attempts'
      };
      const reportPath = path.join(__dirname, '..', 'logs', 'crash-report.json');
      try {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      } catch (e) { /* ignore */ }
      process.exit(1);
    }

    console.log(`   Restarting in ${RESTART_DELAY / 1000}s... (${restartCount}/${MAX_RESTARTS} restarts)`);
    setTimeout(startServer, RESTART_DELAY);
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    setTimeout(startServer, RESTART_DELAY);
  });
}

console.log('📡 ToInvested.com Monitor Started');
console.log('   Auto-restart: enabled');
console.log(`   Max restarts: ${MAX_RESTARTS}`);
console.log(`   Restart delay: ${RESTART_DELAY / 1000}s\n`);

startServer();
