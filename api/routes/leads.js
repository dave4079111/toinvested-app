const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware');
const { logger } = require('../logger');

// Newsletter signup (public)
router.post('/newsletter', (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM leads WHERE email = ? AND type = ?').get(email.toLowerCase(), 'newsletter');
    if (existing) return res.json({ message: 'You\'re already subscribed!' });

    db.prepare('INSERT INTO leads (id, email, name, type, source) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), email.toLowerCase(), name || '', 'newsletter', 'website');

    logger.info('Newsletter signup', { email: email.toLowerCase() });
    res.status(201).json({ message: 'Successfully subscribed to our newsletter!' });
  } catch (err) {
    logger.error('Newsletter signup error', { error: err.message });
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// Contact form (public)
router.post('/contact', (req, res) => {
  try {
    const { email, name, phone, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'Email and message are required' });

    const db = getDb();
    db.prepare('INSERT INTO leads (id, email, name, phone, type, message, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), email.toLowerCase(), name || '', phone || '', 'contact', message, 'contact-form');

    logger.info('Contact form submitted', { email: email.toLowerCase() });
    res.status(201).json({ message: 'Thank you! We\'ll get back to you within 24 hours.' });
  } catch (err) {
    logger.error('Contact form error', { error: err.message });
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

// Coaching booking (public)
router.post('/booking', (req, res) => {
  try {
    const { email, name, type, date, time, notes } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email and name are required' });

    const db = getDb();
    db.prepare('INSERT INTO bookings (id, user_email, name, type, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), email.toLowerCase(), name, type || 'coaching', date || '', time || '', notes || '');

    // Also save as lead
    const existingLead = db.prepare('SELECT id FROM leads WHERE email = ? AND type = ?').get(email.toLowerCase(), 'booking');
    if (!existingLead) {
      db.prepare('INSERT INTO leads (id, email, name, phone, type, source) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), email.toLowerCase(), name, '', 'booking', 'coaching-page');
    }

    logger.info('Coaching booking submitted', { email: email.toLowerCase(), type });
    res.status(201).json({ message: 'Booking request received! We\'ll confirm your session within 24 hours.' });
  } catch (err) {
    logger.error('Booking error', { error: err.message });
    res.status(500).json({ error: 'Booking failed. Please try again.' });
  }
});

// Admin: Get all leads
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { type, status } = req.query;
    let query = 'SELECT * FROM leads';
    const params = [];
    const conditions = [];
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const leads = db.prepare(query).all(...params);
    res.json({ leads, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Admin: Get all bookings
router.get('/bookings', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Admin: Update lead status
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    const db = getDb();
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Lead updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

module.exports = router;
