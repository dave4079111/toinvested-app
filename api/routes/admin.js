const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');
const { logger } = require('../logger');
const path = require('path');
const fs = require('fs');

// Admin dashboard stats
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const leads = db.prepare('SELECT COUNT(*) as count FROM leads').get();
    const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get();
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'completed'").get();
    const posts = db.prepare('SELECT COUNT(*) as count FROM posts').get();
    const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
    const bookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get();

    // Recent activity
    const recentLeads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5').all();
    const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();

    res.json({
      stats: {
        totalUsers: users.count,
        totalLeads: leads.count,
        newLeads: newLeads.count,
        totalOrders: orders.count,
        totalRevenue: revenue.total,
        totalPosts: posts.count,
        totalProducts: products.count,
        pendingBookings: bookings.count
      },
      recentLeads,
      recentOrders: recentOrders.map(o => ({ ...o, items: JSON.parse(o.items) }))
    });
  } catch (err) {
    logger.error('Admin stats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Admin: Get all users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, email, name, role, membership_tier, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Update user role/membership
router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { role, membership_tier } = req.body;
    const db = getDb();
    if (role) db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);
    if (membership_tier) db.prepare('UPDATE users SET membership_tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(membership_tier, req.params.id);
    const user = db.prepare('SELECT id, email, name, role, membership_tier FROM users WHERE id = ?').get(req.params.id);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Admin: Get all orders
router.get('/orders', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    orders.forEach(o => { o.items = JSON.parse(o.items); });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: Get all posts (including drafts)
router.get('/posts', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// System health logs
router.get('/health-logs', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM health_log ORDER BY created_at DESC LIMIT 50').all();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health logs' });
  }
});

// System info
router.get('/system', authenticate, requireAdmin, (req, res) => {
  try {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'toinvested.db');
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const logDir = path.join(__dirname, '..', '..', 'logs');
    let logSize = 0;
    if (fs.existsSync(logDir)) {
      fs.readdirSync(logDir).forEach(f => {
        const stat = fs.statSync(path.join(logDir, f));
        logSize += stat.size;
      });
    }

    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      dbSize: `${(dbSize / 1024).toFixed(1)} KB`,
      logSize: `${(logSize / 1024).toFixed(1)} KB`,
      env: process.env.NODE_ENV || 'development'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

module.exports = router;
