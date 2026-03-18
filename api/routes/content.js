const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware');
const { logger } = require('../logger');

// Get all published posts (public)
router.get('/posts', (req, res) => {
  try {
    const db = getDb();
    const { category, tag, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, title, slug, excerpt, category, tags, featured_image, published_at FROM posts WHERE status = ?';
    const params = ['published'];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const posts = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM posts WHERE status = ?').get('published');

    res.json({ posts, total: total.count, page: Number(page), totalPages: Math.ceil(total.count / limit) });
  } catch (err) {
    logger.error('Failed to fetch posts', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post by slug (public)
router.get('/posts/:slug', (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare('SELECT * FROM posts WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create post (admin only)
router.post('/posts', authenticate, requireAdmin, (req, res) => {
  try {
    const { title, content, excerpt, category, tags, status, featured_image } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

    const db = getDb();
    const id = uuidv4();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    db.prepare(`INSERT INTO posts (id, title, slug, content, excerpt, category, tags, status, featured_image, author_id, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, title, slug, content, excerpt || '', category || 'general',
        JSON.stringify(tags || []), status || 'draft', featured_image || '',
        req.user.id, status === 'published' ? new Date().toISOString() : null);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    logger.info('Post created', { id, title });
    res.status(201).json({ post });
  } catch (err) {
    logger.error('Failed to create post', { error: err.message });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post (admin only)
router.put('/posts/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { title, content, excerpt, category, tags, status, featured_image } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    const publishedAt = status === 'published' && existing.status !== 'published'
      ? new Date().toISOString() : existing.published_at;

    db.prepare(`UPDATE posts SET title=?, content=?, excerpt=?, category=?, tags=?, status=?, featured_image=?, published_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(title || existing.title, content || existing.content, excerpt ?? existing.excerpt,
        category || existing.category, JSON.stringify(tags || JSON.parse(existing.tags)),
        status || existing.status, featured_image ?? existing.featured_image, publishedAt, req.params.id);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post (admin only)
router.delete('/posts/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
