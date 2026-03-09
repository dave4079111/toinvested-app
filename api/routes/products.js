const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware');
const { logger } = require('../logger');

// Get all active products (public)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category } = req.query;
    let query = 'SELECT * FROM products WHERE status = ?';
    const params = ['active'];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY created_at DESC';
    const products = db.prepare(query).all(...params);
    products.forEach(p => { p.features = JSON.parse(p.features || '[]'); });
    res.json({ products });
  } catch (err) {
    logger.error('Failed to fetch products', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
router.get('/:slug', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE slug = ? AND status = ?').get(req.params.slug, 'active');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.features = JSON.parse(product.features || '[]');
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create checkout session
router.post('/checkout', (req, res) => {
  try {
    const { items, email } = req.body;
    if (!items || !items.length || !email) {
      return res.status(400).json({ error: 'Items and email are required' });
    }

    const db = getDb();
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
      if (!product) continue;
      const price = product.sale_price || product.price;
      total += price * (item.quantity || 1);
      orderItems.push({ productId: product.id, name: product.name, price, quantity: item.quantity || 1 });
    }

    const orderId = uuidv4();
    db.prepare('INSERT INTO orders (id, user_email, items, total, status) VALUES (?, ?, ?, ?, ?)')
      .run(orderId, email, JSON.stringify(orderItems), total, 'pending');

    // If Stripe is configured, create a real checkout session
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_your_key_here') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // Build line items for Stripe
      const lineItems = orderItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100)
        },
        quantity: item.quantity
      }));

      stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/store?success=true&order=${orderId}`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/store?canceled=true`,
        customer_email: email,
        metadata: { orderId }
      }).then(session => {
        db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
        res.json({ url: session.url, orderId });
      }).catch(err => {
        logger.error('Stripe checkout error', { error: err.message });
        res.status(500).json({ error: 'Payment processing failed' });
      });
    } else {
      // Demo mode - mark order as completed
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('completed', orderId);
      logger.info('Demo order completed', { orderId, total });
      res.json({
        orderId,
        total,
        status: 'completed',
        message: 'Order placed successfully (demo mode - configure Stripe for real payments)'
      });
    }
  } catch (err) {
    logger.error('Checkout error', { error: err.message });
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Get user's orders
router.get('/orders/mine', authenticate, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
    const orders = db.prepare('SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC').all(user.email);
    orders.forEach(o => { o.items = JSON.parse(o.items); });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(200).json({ received: true });

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const db = getDb();
      db.prepare('UPDATE orders SET status = ?, payment_intent_id = ? WHERE stripe_session_id = ?')
        .run('completed', session.payment_intent, session.id);
      logger.info('Payment completed', { sessionId: session.id });
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error', { error: err.message });
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

// Admin: Create product
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, price, sale_price, category, type, features, image_url } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

    const db = getDb();
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    db.prepare(`INSERT INTO products (id, name, slug, description, price, sale_price, category, type, features, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, name, slug, description || '', price, sale_price || null,
        category || 'tool', type || 'digital', JSON.stringify(features || []), image_url || '', 'active');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    product.features = JSON.parse(product.features);
    res.status(201).json({ product });
  } catch (err) {
    logger.error('Failed to create product', { error: err.message });
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Admin: Update product
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, description, price, sale_price, category, type, features, image_url, status } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(`UPDATE products SET name=?, description=?, price=?, sale_price=?, category=?, type=?, features=?, image_url=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name || existing.name, description ?? existing.description, price ?? existing.price,
        sale_price ?? existing.sale_price, category || existing.category, type || existing.type,
        JSON.stringify(features || JSON.parse(existing.features)), image_url ?? existing.image_url,
        status || existing.status, req.params.id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    product.features = JSON.parse(product.features);
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

module.exports = router;
