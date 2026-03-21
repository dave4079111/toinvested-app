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
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.warn('ADMIN_PASSWORD not set - skipping default admin creation. Set ADMIN_PASSWORD in .env to create admin account.');
  } else {
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (!existingAdmin) {
      const hash = bcrypt.hashSync(adminPassword, 10);
      db.prepare('INSERT INTO users (id, email, password_hash, name, role, membership_tier) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), adminEmail, hash, 'Admin', 'admin', 'premium');
      logger.info('Default admin account created');
    }
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
    },
    {
      id: uuidv4(), title: 'Cash-on-Cash Return Explained: Calculate Real Estate ROI',
      slug: 'cash-on-cash-return-explained',
      content: `<h2>What Is Cash-on-Cash Return?</h2><p>Cash-on-cash return measures the annual return on the actual cash you invested in a property. Unlike cap rate, CoC accounts for financing and gives you a true picture of your investment performance.</p><h3>The Formula</h3><p>CoC Return = Annual Pre-Tax Cash Flow / Total Cash Invested x 100</p><h3>What Is a Good Cash-on-Cash Return?</h3><p>Most investors target 8-12% CoC for rental properties. Value-add deals may target 15%+ after stabilization.</p>`,
      excerpt: 'Learn how to calculate cash-on-cash return and use it to evaluate rental property investments like a professional real estate investor.',
      category: 'education', tags: JSON.stringify(['cash-on-cash', 'roi', 'metrics']),
      status: 'published', published_at: '2026-03-15T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'What Is a 1031 Exchange? Tax-Free Real Estate Investing',
      slug: 'what-is-1031-exchange',
      content: `<h2>Understanding 1031 Exchanges</h2><p>A 1031 exchange allows real estate investors to defer capital gains taxes by reinvesting proceeds from a property sale into a like-kind property.</p><h3>Key Rules</h3><p>You must identify replacement properties within 45 days and close within 180 days. A qualified intermediary must hold the funds.</p>`,
      excerpt: 'Master the 1031 exchange to defer capital gains taxes and grow your real estate portfolio faster with this complete guide.',
      category: 'tax-strategy', tags: JSON.stringify(['1031-exchange', 'tax-strategy', 'capital-gains']),
      status: 'published', published_at: '2026-03-12T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'How to Find Off-Market Real Estate Deals in 2026',
      slug: 'find-off-market-real-estate-deals',
      content: `<h2>Why Off-Market Deals Win</h2><p>Off-market properties have less competition and often sell below market value. Top investors build systems to find these deals through direct mail, driving for dollars, wholesaler networks, and probate leads.</p>`,
      excerpt: 'Discover proven strategies to find off-market real estate deals with less competition and better prices for maximum profit.',
      category: 'strategy', tags: JSON.stringify(['off-market', 'deal-finding', 'wholesaling']),
      status: 'published', published_at: '2026-03-09T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Rental Property vs Stock Market: Which Builds More Wealth?',
      slug: 'rental-property-vs-stock-market',
      content: `<h2>Comparing Two Wealth-Building Powerhouses</h2><p>Both rental properties and the stock market have created generational wealth. Real estate offers leverage, cash flow, and tax benefits. Stocks offer liquidity, diversification, and passive management.</p>`,
      excerpt: 'Compare rental property investing vs stock market returns including leverage, cash flow, taxes, and risk to find your best path.',
      category: 'investing', tags: JSON.stringify(['stocks', 'rental-property', 'comparison']),
      status: 'published', published_at: '2026-03-06T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'DSCR Loans for Investment Properties: Complete 2026 Guide',
      slug: 'dscr-loan-investment-properties',
      content: `<h2>What Are DSCR Loans?</h2><p>DSCR loans qualify based on property income rather than personal income. Most lenders require a DSCR of 1.0-1.25, meaning the property income covers 100-125% of the mortgage payment.</p>`,
      excerpt: 'Everything you need to know about DSCR loans for investment properties including requirements, rates, and how to qualify in 2026.',
      category: 'financing', tags: JSON.stringify(['dscr', 'loans', 'financing']),
      status: 'published', published_at: '2026-03-03T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'House Hacking Guide: Live Free & Build Wealth in 2026',
      slug: 'house-hacking-guide',
      content: `<h2>What Is House Hacking?</h2><p>House hacking means buying a property, living in part of it, and renting out the rest to cover your mortgage. Strategies include duplexes, ADUs, room rentals, and Airbnb.</p>`,
      excerpt: 'Learn how to house hack your way to financial freedom by living for free while building real estate wealth.',
      category: 'strategy', tags: JSON.stringify(['house-hacking', 'beginner', 'fha']),
      status: 'published', published_at: '2026-02-28T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Real Estate Syndication: Passive Investing Explained',
      slug: 'real-estate-syndication-explained',
      content: `<h2>How Syndications Work</h2><p>A syndication pools capital from multiple investors to acquire large commercial properties. General partners manage the deal while limited partners invest passively and receive distributions.</p>`,
      excerpt: 'Understand real estate syndication deals, GP vs LP roles, preferred returns, and how to evaluate passive investing opportunities.',
      category: 'investing', tags: JSON.stringify(['syndication', 'passive-investing', 'commercial']),
      status: 'published', published_at: '2026-02-25T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'How to Build a Real Estate Portfolio from Scratch',
      slug: 'build-real-estate-portfolio-from-scratch',
      content: `<h2>Starting from Zero</h2><p>Building a real estate portfolio requires a systematic approach: start with your first property, stabilize it, leverage equity, and scale. The key is building systems for deal analysis, property management, and financing.</p>`,
      excerpt: 'A step-by-step blueprint for building a profitable real estate portfolio from your first property to a full-scale operation.',
      category: 'strategy', tags: JSON.stringify(['portfolio', 'scaling', 'beginner']),
      status: 'published', published_at: '2026-02-20T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Cap Rate Explained: What Every Investor Must Know',
      slug: 'cap-rate-explained',
      content: `<h2>Understanding Capitalization Rate</h2><p>Cap rate measures a property's potential return independent of financing. Formula: Net Operating Income / Property Value. It helps compare properties across markets.</p>`,
      excerpt: 'Master cap rate calculations to compare investment properties, determine fair value, and make smarter real estate decisions.',
      category: 'education', tags: JSON.stringify(['cap-rate', 'metrics', 'valuation']),
      status: 'published', published_at: '2026-02-15T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'How to Analyze a Rental Property in Under 10 Minutes',
      slug: 'analyze-rental-property-fast',
      content: `<h2>Quick Screening Framework</h2><p>Use the 1% rule for initial screening, then the 50% rule for expense estimation. For properties that pass, run a full analysis with cash flow projections, cap rate, and cash-on-cash return.</p>`,
      excerpt: 'Learn a fast, proven framework to analyze rental properties quickly using the 1% rule, 50% rule, and AI-powered analysis tools.',
      category: 'education', tags: JSON.stringify(['analysis', 'rental-property', 'screening']),
      status: 'published', published_at: '2026-02-10T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Creative Financing for Real Estate: No Bank Required',
      slug: 'creative-financing-real-estate',
      content: `<h2>Beyond Traditional Loans</h2><p>Creative financing opens doors when banks say no. Seller financing, subject-to deals, lease options, private money, and self-directed IRAs let you acquire properties with flexible terms.</p>`,
      excerpt: 'Explore creative financing strategies including seller financing, subject-to, and private money to buy real estate without banks.',
      category: 'financing', tags: JSON.stringify(['creative-financing', 'seller-financing', 'private-money']),
      status: 'published', published_at: '2026-02-08T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Short-Term vs Long-Term Rentals: Which Is More Profitable?',
      slug: 'short-term-vs-long-term-rentals',
      content: `<h2>Comparing Rental Strategies</h2><p>Short-term rentals can generate 2-3x revenue but require more management and face regulatory risks. Long-term rentals offer stability and lower management burden.</p>`,
      excerpt: 'Compare short-term Airbnb rentals vs long-term leases on revenue, management, regulations, and profitability.',
      category: 'strategy', tags: JSON.stringify(['airbnb', 'short-term-rental', 'long-term-rental']),
      status: 'published', published_at: '2026-02-05T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'How AI Helps You Find Undervalued Properties in 2026',
      slug: 'ai-find-undervalued-properties',
      content: `<h2>AI-Powered Deal Finding</h2><p>Artificial intelligence can analyze thousands of properties in seconds, identifying undervalued deals that human investors miss. From predictive pricing to automated market analysis, AI is changing how investors find opportunities.</p>`,
      excerpt: 'Discover how artificial intelligence and machine learning tools help real estate investors find undervalued properties faster.',
      category: 'technology', tags: JSON.stringify(['ai', 'technology', 'deal-finding']),
      status: 'published', published_at: '2026-02-02T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'How to Profit in a Real Estate Market Downturn',
      slug: 'profit-real-estate-market-downturn',
      content: `<h2>Opportunity in Every Downturn</h2><p>Market downturns create the best buying opportunities for prepared investors. Distressed properties, motivated sellers, and creative deal structures emerge when others are fearful.</p>`,
      excerpt: 'Learn proven strategies to find profitable real estate deals during market downturns and economic uncertainty.',
      category: 'strategy', tags: JSON.stringify(['downturn', 'distressed', 'recession']),
      status: 'published', published_at: '2026-01-30T00:00:00.000Z'
    },
    {
      id: uuidv4(), title: 'Building Generational Wealth Through Real Estate',
      slug: 'generational-wealth-real-estate',
      content: `<h2>Creating a Legacy</h2><p>Real estate is one of the most powerful vehicles for building generational wealth. Through entity structuring, trusts, estate planning, and portfolio building, investors can create lasting financial legacies.</p>`,
      excerpt: 'Learn how to build generational wealth through real estate with entity structuring, trusts, and strategic portfolio building.',
      category: 'investing', tags: JSON.stringify(['generational-wealth', 'estate-planning', 'legacy']),
      status: 'published', published_at: '2026-01-25T00:00:00.000Z'
    }
  ];

  const insert = db.prepare(`INSERT INTO posts (id, title, slug, content, excerpt, category, tags, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of posts) {
    insert.run(p.id, p.title, p.slug, p.content, p.excerpt, p.category, p.tags, p.status, p.published_at);
  }
  logger.info('Sample blog posts seeded');
}

module.exports = { getDb, initDatabase };
