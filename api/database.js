const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');

const DB_PATH = path.join(__dirname, '..', 'data', 'toinvested.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDatabase() {
  const db = getDb();

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'member',
      membership_tier TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Blog/Content posts
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      category TEXT DEFAULT 'general',
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      featured_image TEXT,
      author_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME
    )
  `);

  // Products (digital products, courses, tools)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      sale_price REAL,
      category TEXT DEFAULT 'tool',
      type TEXT DEFAULT 'digital',
      file_url TEXT,
      image_url TEXT,
      features TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      stripe_price_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      stripe_session_id TEXT,
      payment_intent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Leads (contact forms, newsletter signups)
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      source TEXT DEFAULT 'website',
      type TEXT DEFAULT 'newsletter',
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Coaching bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      name TEXT,
      type TEXT DEFAULT 'coaching',
      date TEXT,
      time TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // System health log
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      details TEXT,
      action_taken TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin if not exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@toinvested.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, membership_tier) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), adminEmail, hash, 'Admin', 'admin', 'premium');
    logger.info('Default admin account created');
  }

  // Seed sample products if empty
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (productCount.count === 0) {
    seedProducts(db);
  }

  // Seed sample blog posts if empty
  const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get();
  if (postCount.count === 0) {
    seedPosts(db);
  }

  logger.info('Database initialization complete');
}

function seedProducts(db) {
  const products = [
    {
      id: uuidv4(), name: 'Real Estate Deal Analyzer Pro', slug: 'deal-analyzer-pro',
      description: 'Complete spreadsheet toolkit for analyzing rental properties, fix & flips, and BRRRR deals. Includes cash flow projections, ROI calculations, and market comparisons.',
      price: 49.99, sale_price: 29.99, category: 'tool', type: 'digital',
      features: JSON.stringify(['Cash flow analysis', 'ROI calculator', 'Market comparison', 'Print-ready reports']),
      status: 'active'
    },
    {
      id: uuidv4(), name: 'Investor Business Plan Template', slug: 'investor-business-plan',
      description: 'Professional business plan template designed specifically for real estate investors seeking funding or partnerships.',
      price: 29.99, category: 'template', type: 'digital',
      features: JSON.stringify(['Executive summary template', 'Financial projections', 'Market analysis framework', 'Investor pitch deck']),
      status: 'active'
    },
    {
      id: uuidv4(), name: 'Fix & Flip Masterclass', slug: 'fix-flip-masterclass',
      description: 'Complete video course covering everything from finding deals to managing renovations to maximizing profit on fix and flip properties.',
      price: 199.99, sale_price: 149.99, category: 'course', type: 'digital',
      features: JSON.stringify(['20+ hours of video', 'Deal analysis worksheets', 'Contractor management guides', 'Lifetime access']),
      status: 'active'
    },
    {
      id: uuidv4(), name: 'Rental Property Cash Flow Tracker', slug: 'cashflow-tracker',
      description: 'Track income, expenses, and cash flow across your entire rental portfolio. Automated reports and tax-ready summaries.',
      price: 39.99, category: 'tool', type: 'digital',
      features: JSON.stringify(['Multi-property tracking', 'Expense categorization', 'Tax-ready reports', 'Monthly/yearly summaries']),
      status: 'active'
    },
    {
      id: uuidv4(), name: 'BRRRR Strategy Blueprint', slug: 'brrrr-blueprint',
      description: 'Step-by-step guide to executing the BRRRR (Buy, Rehab, Rent, Refinance, Repeat) strategy with real-world case studies.',
      price: 79.99, sale_price: 59.99, category: 'course', type: 'digital',
      features: JSON.stringify(['Strategy framework', 'Case studies', 'Lender comparison tools', 'Refinance calculator']),
      status: 'active'
    },
    {
      id: uuidv4(), name: 'Premium Membership - Annual', slug: 'premium-annual',
      description: 'Full access to all tools, courses, AI analyzers, coaching sessions, and exclusive investment opportunities for one year.',
      price: 299.99, category: 'membership', type: 'subscription',
      features: JSON.stringify(['All tools & courses', 'AI analyzers unlimited', 'Monthly coaching call', 'Deal pipeline access', 'Private community']),
      status: 'active'
    }
  ];

  const insert = db.prepare(`INSERT INTO products (id, name, slug, description, price, sale_price, category, type, features, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const p of products) {
    insert.run(p.id, p.name, p.slug, p.description, p.price, p.sale_price || null, p.category, p.type, p.features, p.status);
  }
  logger.info('Sample products seeded');
}

function seedPosts(db) {
  const posts = [
    {
      id: uuidv4(), title: '5 Key Metrics Every Real Estate Investor Must Know',
      slug: '5-key-metrics-real-estate-investor',
      content: `<h2>Understanding the Numbers Behind Every Deal</h2>
<p>Whether you're analyzing your first rental property or your fiftieth, these five metrics will determine whether a deal makes money or loses it.</p>
<h3>1. Cash-on-Cash Return (CoC)</h3>
<p>This tells you the annual return on the actual cash you invested. Formula: Annual Pre-Tax Cash Flow ÷ Total Cash Invested. A good CoC return is typically 8-12% or higher.</p>
<h3>2. Cap Rate (Capitalization Rate)</h3>
<p>Cap rate measures a property's potential return independent of financing. Formula: Net Operating Income ÷ Property Value. This helps you compare properties across different markets.</p>
<h3>3. Gross Rent Multiplier (GRM)</h3>
<p>A quick screening tool: Property Price ÷ Annual Gross Rent. Lower GRM = potentially better deal. Use this for initial filtering before deep analysis.</p>
<h3>4. Debt Service Coverage Ratio (DSCR)</h3>
<p>Lenders love this metric. Formula: Net Operating Income ÷ Annual Debt Service. A DSCR above 1.25 means the property generates 25% more income than needed to cover the mortgage.</p>
<h3>5. Internal Rate of Return (IRR)</h3>
<p>The gold standard for measuring total investment performance over time, including appreciation, tax benefits, and cash flow. Aim for 15%+ IRR on value-add deals.</p>
<p><strong>Use our free AI Property Analyzer to calculate all five metrics instantly.</strong></p>`,
      excerpt: 'Master the five essential metrics that separate profitable real estate deals from money pits.',
      category: 'education', tags: JSON.stringify(['real-estate', 'metrics', 'analysis']),
      status: 'published', published_at: new Date().toISOString()
    },
    {
      id: uuidv4(), title: 'BRRRR Strategy: The Complete 2024 Guide',
      slug: 'brrrr-strategy-complete-guide',
      content: `<h2>Buy, Rehab, Rent, Refinance, Repeat</h2>
<p>The BRRRR strategy is one of the most powerful wealth-building methods in real estate. Here's how to execute it step by step.</p>
<h3>Step 1: Buy Below Market Value</h3>
<p>The deal is made at purchase. Look for distressed properties, motivated sellers, and off-market opportunities. Your purchase price should be 70-75% of the After Repair Value (ARV).</p>
<h3>Step 2: Rehab Strategically</h3>
<p>Focus renovations on items that add the most value: kitchens, bathrooms, curb appeal. Create a detailed scope of work and budget before starting. Always add 10-15% contingency.</p>
<h3>Step 3: Rent at Market Rate</h3>
<p>Screen tenants thoroughly. A great tenant is worth more than an extra $50/month in rent. Use our rental analysis tools to determine optimal pricing.</p>
<h3>Step 4: Refinance</h3>
<p>After seasoning (typically 6-12 months), refinance based on the new appraised value. Aim to pull out 75-80% of the ARV, ideally recovering most or all of your initial investment.</p>
<h3>Step 5: Repeat</h3>
<p>Take the recovered capital and do it again. Each cycle builds equity and cash flow simultaneously.</p>`,
      excerpt: 'Master the BRRRR strategy to build a rental portfolio with minimal capital.',
      category: 'strategy', tags: JSON.stringify(['brrrr', 'real-estate', 'strategy']),
      status: 'published', published_at: new Date().toISOString()
    },
    {
      id: uuidv4(), title: 'Bitcoin vs Real Estate: Where to Invest in 2024',
      slug: 'bitcoin-vs-real-estate-2024',
      content: `<h2>Comparing Two Powerful Asset Classes</h2>
<p>Both Bitcoin and real estate have created generational wealth. But which is right for your portfolio? Let's break it down.</p>
<h3>Real Estate Advantages</h3>
<ul><li>Leverage: Control $500K with $100K</li><li>Cash flow: Monthly rental income</li><li>Tax benefits: Depreciation, 1031 exchanges</li><li>Tangible asset with intrinsic value</li></ul>
<h3>Bitcoin Advantages</h3>
<ul><li>Liquidity: Buy/sell 24/7</li><li>No maintenance or management</li><li>Potentially higher short-term returns</li><li>Portable and borderless</li></ul>
<h3>The Smart Approach: Diversify</h3>
<p>The most resilient portfolios include both. Use real estate for stable cash flow and tax benefits. Use Bitcoin for growth potential and liquidity. Our AI tools can help you analyze both.</p>`,
      excerpt: 'A balanced analysis of both asset classes to help you build a diversified investment portfolio.',
      category: 'investing', tags: JSON.stringify(['bitcoin', 'real-estate', 'comparison']),
      status: 'published', published_at: new Date().toISOString()
    }
  ];

  const insert = db.prepare(`INSERT INTO posts (id, title, slug, content, excerpt, category, tags, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of posts) {
    insert.run(p.id, p.title, p.slug, p.content, p.excerpt, p.category, p.tags, p.status, p.published_at);
  }
  logger.info('Sample blog posts seeded');
}

module.exports = { getDb, initDatabase };
