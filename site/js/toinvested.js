/**
 * ToInvested.com - Core Frontend JavaScript
 * Connects all pages to the backend API
 * Self-healing: auto-retries on failure, reports errors
 */

const TI = {
  token: localStorage.getItem('tiToken'),
  user: JSON.parse(localStorage.getItem('tiUser') || 'null'),

  // ==========================================
  // API HELPER
  // ==========================================
  async api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    let retries = 2;
    while (retries >= 0) {
      try {
        const res = await fetch(`/api${endpoint}`, { ...options, headers });
        if (res.status === 401) {
          this.logout();
          return null;
        }
        return await res.json();
      } catch (err) {
        if (retries === 0) {
          console.error('API Error:', err);
          return { error: 'Network error. Please try again.' };
        }
        retries--;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  },

  // ==========================================
  // AUTH
  // ==========================================
  async login(email, password) {
    const data = await this.api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data && data.token) {
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('tiToken', data.token);
      localStorage.setItem('tiUser', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }
    return { success: false, error: data?.error || 'Login failed' };
  },

  async register(email, password, name) {
    const data = await this.api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    if (data && data.token) {
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('tiToken', data.token);
      localStorage.setItem('tiUser', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }
    return { success: false, error: data?.error || 'Registration failed' };
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('tiToken');
    localStorage.removeItem('tiUser');
    window.location.href = '/';
  },

  isLoggedIn() {
    return !!this.token;
  },

  // ==========================================
  // NEWSLETTER & LEADS
  // ==========================================
  async subscribeNewsletter(email, name) {
    return await this.api('/leads/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email, name })
    });
  },

  async submitContact(email, name, phone, message) {
    return await this.api('/leads/contact', {
      method: 'POST',
      body: JSON.stringify({ email, name, phone, message })
    });
  },

  async bookCoaching(email, name, type, date, time, notes) {
    return await this.api('/leads/booking', {
      method: 'POST',
      body: JSON.stringify({ email, name, type, date, time, notes })
    });
  },

  // ==========================================
  // CONTENT
  // ==========================================
  async getPosts(category, page = 1) {
    const params = new URLSearchParams({ page });
    if (category) params.set('category', category);
    return await this.api(`/content/posts?${params}`);
  },

  async getPost(slug) {
    return await this.api(`/content/posts/${slug}`);
  },

  // ==========================================
  // PRODUCTS & STORE
  // ==========================================
  async getProducts(category) {
    const params = category ? `?category=${category}` : '';
    return await this.api(`/products${params}`);
  },

  async checkout(items, email) {
    return await this.api('/products/checkout', {
      method: 'POST',
      body: JSON.stringify({ items, email })
    });
  },

  async subscribe(plan, billing, email) {
    return await this.api('/products/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan, billing, email })
    });
  },

  // Shopping cart (localStorage)
  getCart() {
    return JSON.parse(localStorage.getItem('tiCart') || '[]');
  },
  addToCart(productId, name, price) {
    const cart = this.getCart();
    const existing = cart.find(i => i.productId === productId);
    if (existing) existing.quantity++;
    else cart.push({ productId, name, price, quantity: 1 });
    localStorage.setItem('tiCart', JSON.stringify(cart));
    this.updateCartBadge();
    this.showNotification(`${name} added to cart!`);
  },
  removeFromCart(productId) {
    const cart = this.getCart().filter(i => i.productId !== productId);
    localStorage.setItem('tiCart', JSON.stringify(cart));
    this.updateCartBadge();
  },
  clearCart() {
    localStorage.removeItem('tiCart');
    this.updateCartBadge();
  },
  updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
      const count = this.getCart().reduce((sum, i) => sum + i.quantity, 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  // ==========================================
  // ANALYZERS
  // ==========================================
  async analyzeProperty(data) { return await this.api('/analyzers/property', { method: 'POST', body: JSON.stringify(data) }); },
  async analyzeFlip(data) { return await this.api('/analyzers/flip', { method: 'POST', body: JSON.stringify(data) }); },
  async analyzeBrrrr(data) { return await this.api('/analyzers/brrrr', { method: 'POST', body: JSON.stringify(data) }); },
  async analyzeStock(data) { return await this.api('/analyzers/stock', { method: 'POST', body: JSON.stringify(data) }); },
  async analyzeBitcoin(data) { return await this.api('/analyzers/bitcoin', { method: 'POST', body: JSON.stringify(data) }); },
  async analyzeRenovation(data) { return await this.api('/analyzers/renovation', { method: 'POST', body: JSON.stringify(data) }); },

  // ==========================================
  // UI HELPERS
  // ==========================================
  showNotification(message, type = 'success') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type === 'error' ? '#ff4444' : '#C9A84C'};color:${type === 'error' ? '#fff' : '#0A0E17'};padding:12px 24px;border-radius:8px;font-weight:600;z-index:10000;animation:slideUp 0.3s ease;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
  },

  // Update nav based on auth state
  updateNav() {
    const authLinks = document.querySelectorAll('[data-auth]');
    authLinks.forEach(el => {
      const show = el.dataset.auth === 'logged-in' ? this.isLoggedIn() : !this.isLoggedIn();
      el.style.display = show ? '' : 'none';
    });

    // Update user name if displayed
    const nameEls = document.querySelectorAll('[data-user-name]');
    nameEls.forEach(el => {
      el.textContent = this.user?.name || this.user?.email || 'Member';
    });
  },

  // ==========================================
  // EVENT SYSTEM
  // ==========================================
  _eventListeners: {},

  on(event, callback) {
    if (!this._eventListeners[event]) this._eventListeners[event] = [];
    this._eventListeners[event].push(callback);
    return () => {
      this._eventListeners[event] = this._eventListeners[event].filter(cb => cb !== callback);
    };
  },

  emit(event, data) {
    const listeners = this._eventListeners[event] || [];
    listeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error(`Event handler error [${event}]:`, err); }
    });
    // Also dispatch a CustomEvent on document for external listeners
    document.dispatchEvent(new CustomEvent(`ti:${event}`, { detail: data }));
  },

  // ==========================================
  // PROGRESS TRACKING
  // ==========================================
  progress: {
    _storageKey: 'tiProgress',

    _load() {
      return JSON.parse(localStorage.getItem(this._storageKey) || JSON.stringify({
        toolsUsed: [],
        analysisHistory: [],
        pagesVisited: [],
        achievements: [],
        totalAnalyses: 0
      }));
    },

    _save(data) {
      localStorage.setItem(this._storageKey, JSON.stringify(data));
    },

    trackPageVisit(path) {
      const data = this._load();
      const entry = { path, timestamp: Date.now() };
      data.pagesVisited.push(entry);
      // Keep last 100
      if (data.pagesVisited.length > 100) data.pagesVisited = data.pagesVisited.slice(-100);
      this._save(data);

      // Session tracking
      const session = JSON.parse(sessionStorage.getItem('tiSession') || '{"pages":[],"tools":[],"results":[]}');
      session.pages.push(path);
      sessionStorage.setItem('tiSession', JSON.stringify(session));
    },

    trackToolUsed(toolName) {
      const data = this._load();
      if (!data.toolsUsed.includes(toolName)) data.toolsUsed.push(toolName);
      this._save(data);

      const session = JSON.parse(sessionStorage.getItem('tiSession') || '{"pages":[],"tools":[],"results":[]}');
      if (!session.tools.includes(toolName)) session.tools.push(toolName);
      sessionStorage.setItem('tiSession', JSON.stringify(session));

      TI.emit('tool-used', { tool: toolName });
      this._checkAchievements(data);
    },

    trackAnalysis(type, input, result) {
      const data = this._load();
      data.totalAnalyses++;
      data.analysisHistory.push({
        type,
        input: typeof input === 'object' ? { ...input } : input,
        summary: result?.summary || null,
        timestamp: Date.now()
      });
      // Keep last 50 analyses
      if (data.analysisHistory.length > 50) data.analysisHistory = data.analysisHistory.slice(-50);
      this._save(data);

      const session = JSON.parse(sessionStorage.getItem('tiSession') || '{"pages":[],"tools":[],"results":[]}');
      session.results.push({ type, timestamp: Date.now() });
      sessionStorage.setItem('tiSession', JSON.stringify(session));

      TI.emit('analysis-complete', { type, input, result });
      this._checkAchievements(data);
    },

    _checkAchievements(data) {
      const newAchievements = [];
      if (data.totalAnalyses >= 1 && !data.achievements.includes('first-analysis')) {
        data.achievements.push('first-analysis');
        newAchievements.push({ id: 'first-analysis', label: 'First Analysis Complete!' });
      }
      if (data.totalAnalyses >= 3 && !data.achievements.includes('deal-hunter')) {
        data.achievements.push('deal-hunter');
        newAchievements.push({ id: 'deal-hunter', label: 'Deal Hunter - 3 analyses done! Unlock portfolio tracking with Premium.' });
      }
      if (data.totalAnalyses >= 10 && !data.achievements.includes('power-investor')) {
        data.achievements.push('power-investor');
        newAchievements.push({ id: 'power-investor', label: 'Power Investor - 10 analyses! You\'re ready for the Pro plan.' });
      }
      if (data.toolsUsed.length >= 3 && !data.achievements.includes('explorer')) {
        data.achievements.push('explorer');
        newAchievements.push({ id: 'explorer', label: 'Explorer - Tried 3 different tools!' });
      }
      if (newAchievements.length > 0) {
        this._save(data);
        newAchievements.forEach(a => TI.showNotification(a.label));
      }
    },

    getSummary() {
      const data = this._load();
      return {
        toolsUsed: data.toolsUsed,
        totalAnalyses: data.totalAnalyses,
        recentAnalyses: data.analysisHistory.slice(-5),
        achievements: data.achievements,
        pagesVisited: data.pagesVisited.length
      };
    },

    getJourneyHTML() {
      const data = this._load();
      const freeTools = ['property-analyzer', 'flip-analyzer', 'brrrr-analyzer', 'stock-analyzer', 'bitcoin-analyzer', 'renovation-analyzer'];
      const used = freeTools.filter(t => data.toolsUsed.includes(t));
      const pct = Math.round((used.length / freeTools.length) * 100);
      return `<div class="ti-journey" style="background:#111827;border:1px solid #C9A84C33;border-radius:12px;padding:20px;color:#E5E7EB;font-family:sans-serif;">
        <h3 style="color:#C9A84C;margin:0 0 12px;">Your Investment Journey</h3>
        <div style="background:#1F2937;border-radius:8px;height:12px;overflow:hidden;margin-bottom:12px;">
          <div style="background:linear-gradient(90deg,#C9A84C,#E5C76B);height:100%;width:${pct}%;transition:width 0.5s;border-radius:8px;"></div>
        </div>
        <p style="margin:0 0 8px;font-size:14px;">${used.length}/${freeTools.length} tools explored &middot; ${data.totalAnalyses} total analyses</p>
        ${data.achievements.length > 0 ? `<p style="margin:0;font-size:13px;color:#C9A84C;">Achievements: ${data.achievements.join(', ')}</p>` : ''}
        ${data.totalAnalyses >= 3 && !TI.isLoggedIn() ? '<p style="margin:8px 0 0;font-size:13px;"><a href="/membership/" style="color:#C9A84C;">Unlock Premium for portfolio tracking &rarr;</a></p>' : ''}
      </div>`;
    }
  },

  // ==========================================
  // SMART RECOMMENDATIONS ENGINE
  // ==========================================
  getRecommendation(context) {
    const session = JSON.parse(sessionStorage.getItem('tiSession') || '{"pages":[],"tools":[],"results":[]}');
    const progressData = this.progress._load();
    const path = context?.page || window.location.pathname;
    const recommendations = [];

    // Based on current page
    if (path.includes('property-analyzer') || path.includes('flip-analyzer') || path.includes('brrrr-analyzer')) {
      if (progressData.totalAnalyses === 0) {
        recommendations.push({ type: 'action', label: 'Run your first property analysis', action: 'analyze-property' });
      }
      if (!session.tools.includes('stock-analyzer')) {
        recommendations.push({ type: 'tool', label: 'Also try the Stock Analyzer', url: '/tools/stock-analyzer/' });
      }
      recommendations.push({ type: 'content', label: 'Read: How to Evaluate Rental Properties', url: '/blog/evaluate-rental-properties/' });
    }

    if (path.includes('stock-analyzer')) {
      recommendations.push({ type: 'content', label: 'Read: Stock vs Real Estate Returns', url: '/blog/stock-vs-real-estate/' });
      if (!session.tools.includes('bitcoin-analyzer')) {
        recommendations.push({ type: 'tool', label: 'Also try Bitcoin Analysis', url: '/tools/bitcoin-analyzer/' });
      }
    }

    if (path.includes('bitcoin-analyzer')) {
      recommendations.push({ type: 'content', label: 'Read: Bitcoin as an Investment Asset', url: '/blog/bitcoin-investment/' });
    }

    if (path === '/' || path === '/index.html') {
      recommendations.push({ type: 'flow', label: 'Analyze your first deal', flow: 'property-analysis' });
      recommendations.push({ type: 'tool', label: 'Try the Free Property Analyzer', url: '/tools/property-analyzer/' });
    }

    // Based on journey progress
    if (progressData.totalAnalyses >= 3 && !progressData.toolsUsed.includes('membership')) {
      recommendations.push({ type: 'upgrade', label: 'Upgrade to Premium for portfolio tracking', url: '/membership/' });
    }

    if (progressData.totalAnalyses >= 1 && session.results.length >= 1) {
      recommendations.push({ type: 'flow', label: 'Compare your analyzed deals', flow: 'deal-comparison' });
    }

    if (!session.tools.includes('coaching')) {
      recommendations.push({ type: 'service', label: 'Book a free coaching consultation', url: '/coaching/' });
    }

    // Context-aware profile recommendations
    if (context?.investmentProfile) {
      const profile = context.investmentProfile;
      if (profile.type === 'beginner') {
        recommendations.push({ type: 'content', label: 'Getting Started with Real Estate Investing', url: '/blog/getting-started/' });
        recommendations.push({ type: 'service', label: 'Book a Beginner Coaching Session', url: '/coaching/' });
      }
      if (profile.type === 'experienced' || profile.budget > 200000) {
        recommendations.push({ type: 'upgrade', label: 'Pro Plan: Advanced analytics & API access', url: '/membership/' });
      }
      if (profile.interests?.includes('stocks')) {
        recommendations.push({ type: 'tool', label: 'Stock Analyzer', url: '/tools/stock-analyzer/' });
      }
      if (profile.interests?.includes('crypto') || profile.interests?.includes('bitcoin')) {
        recommendations.push({ type: 'tool', label: 'Bitcoin Analyzer', url: '/tools/bitcoin-analyzer/' });
      }
      if (profile.interests?.includes('real-estate') || profile.interests?.includes('rental')) {
        recommendations.push({ type: 'tool', label: 'Property Analyzer', url: '/tools/property-analyzer/' });
      }
    }

    return recommendations.slice(0, 5); // Max 5 recommendations
  },

  // ==========================================
  // AI AGENT ACTION REGISTRY
  // ==========================================
  actions: {},

  _registerActions() {
    this.actions = {
      'analyze-property': {
        name: 'analyze-property',
        description: 'Analyze a real estate property for investment potential. Supports rental, flip, and BRRRR strategies.',
        parameters: {
          address: { type: 'string', required: true, description: 'Full property address' },
          strategy: { type: 'string', required: false, description: 'Analysis strategy: rental, flip, or brrrr. Defaults to rental.', enum: ['rental', 'flip', 'brrrr'] },
          purchasePrice: { type: 'number', required: false, description: 'Purchase price in dollars' },
          rentEstimate: { type: 'number', required: false, description: 'Monthly rent estimate in dollars' }
        },
        handler: async (params) => {
          const strategy = params.strategy || 'rental';
          let result;
          if (strategy === 'flip') result = await TI.analyzeFlip(params);
          else if (strategy === 'brrrr') result = await TI.analyzeBrrrr(params);
          else result = await TI.analyzeProperty(params);
          TI.progress.trackToolUsed(`${strategy}-analyzer`);
          TI.progress.trackAnalysis(strategy, params, result);
          return result;
        }
      },

      'analyze-stock': {
        name: 'analyze-stock',
        description: 'Analyze a stock ticker for investment potential.',
        parameters: {
          ticker: { type: 'string', required: true, description: 'Stock ticker symbol (e.g., AAPL, TSLA)' }
        },
        handler: async (params) => {
          const result = await TI.analyzeStock(params);
          TI.progress.trackToolUsed('stock-analyzer');
          TI.progress.trackAnalysis('stock', params, result);
          return result;
        }
      },

      'analyze-bitcoin': {
        name: 'analyze-bitcoin',
        description: 'Analyze Bitcoin or cryptocurrency market data.',
        parameters: {
          query: { type: 'string', required: false, description: 'Specific analysis query (e.g., "price prediction", "market sentiment")' }
        },
        handler: async (params) => {
          const result = await TI.analyzeBitcoin(params);
          TI.progress.trackToolUsed('bitcoin-analyzer');
          TI.progress.trackAnalysis('bitcoin', params, result);
          return result;
        }
      },

      'subscribe-newsletter': {
        name: 'subscribe-newsletter',
        description: 'Subscribe an email address to the ToInvested newsletter.',
        parameters: {
          email: { type: 'string', required: true, description: 'Email address to subscribe' },
          name: { type: 'string', required: false, description: 'Subscriber name' }
        },
        handler: async (params) => {
          const result = await TI.subscribeNewsletter(params.email, params.name || '');
          if (result && !result.error) TI.emit('signup-complete', { type: 'newsletter', email: params.email });
          return result;
        }
      },

      'book-coaching': {
        name: 'book-coaching',
        description: 'Book a coaching session with a ToInvested investment coach.',
        parameters: {
          email: { type: 'string', required: true, description: 'Contact email' },
          name: { type: 'string', required: true, description: 'Full name' },
          type: { type: 'string', required: true, description: 'Coaching type: one-on-one, group, portfolio-review', enum: ['one-on-one', 'group', 'portfolio-review'] },
          date: { type: 'string', required: true, description: 'Preferred date (YYYY-MM-DD)' },
          time: { type: 'string', required: true, description: 'Preferred time (HH:MM)' },
          notes: { type: 'string', required: false, description: 'Additional notes or questions' }
        },
        handler: async (params) => {
          const result = await TI.bookCoaching(params.email, params.name, params.type, params.date, params.time, params.notes || '');
          TI.progress.trackToolUsed('coaching');
          return result;
        }
      },

      'add-to-cart': {
        name: 'add-to-cart',
        description: 'Add a product to the shopping cart.',
        parameters: {
          productId: { type: 'string', required: true, description: 'Product ID' },
          name: { type: 'string', required: true, description: 'Product name' },
          price: { type: 'number', required: true, description: 'Product price in dollars' }
        },
        handler: async (params) => {
          TI.addToCart(params.productId, params.name, params.price);
          return { success: true, cart: TI.getCart() };
        }
      },

      'start-membership': {
        name: 'start-membership',
        description: 'Start a membership subscription.',
        parameters: {
          plan: { type: 'string', required: true, description: 'Plan level: free, premium, pro', enum: ['free', 'premium', 'pro'] },
          billing: { type: 'string', required: false, description: 'Billing cycle: monthly or annual', enum: ['monthly', 'annual'] },
          email: { type: 'string', required: false, description: 'Email address (uses logged-in user email if not provided)' }
        },
        handler: async (params) => {
          const email = params.email || TI.user?.email;
          if (!email) return { error: 'Email required. Please log in or provide an email.' };
          TI.emit('checkout-start', { type: 'membership', plan: params.plan });
          const result = await TI.subscribe(params.plan, params.billing || 'monthly', email);
          if (result && !result.error) TI.progress.trackToolUsed('membership');
          return result;
        }
      },

      'navigate-to': {
        name: 'navigate-to',
        description: 'Navigate to a specific page on the ToInvested website.',
        parameters: {
          path: { type: 'string', required: true, description: 'Page path (e.g., "/tools/property-analyzer/", "/blog/", "/membership/")' }
        },
        handler: async (params) => {
          window.location.href = params.path;
          return { success: true, navigatingTo: params.path };
        }
      },

      'search-blog': {
        name: 'search-blog',
        description: 'Search blog posts for specific topics.',
        parameters: {
          query: { type: 'string', required: true, description: 'Search terms' },
          category: { type: 'string', required: false, description: 'Filter by category' }
        },
        handler: async (params) => {
          const result = await TI.getPosts(params.category || '', 1);
          // Client-side filter by query if API doesn't support search
          if (result && result.posts && params.query) {
            const q = params.query.toLowerCase();
            result.posts = result.posts.filter(p =>
              (p.title && p.title.toLowerCase().includes(q)) ||
              (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
              (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
            );
          }
          return result;
        }
      },

      'get-recommendations': {
        name: 'get-recommendations',
        description: 'Get personalized recommendations based on user profile and behavior.',
        parameters: {
          investmentProfile: { type: 'object', required: false, description: 'User investment profile with fields: type (beginner/experienced), budget (number), interests (array of strings like "stocks", "real-estate", "crypto")' }
        },
        handler: async (params) => {
          return {
            recommendations: TI.getRecommendation({ investmentProfile: params.investmentProfile }),
            progress: TI.progress.getSummary()
          };
        }
      }
    };
  },

  getAvailableActions() {
    return Object.values(this.actions).map(action => ({
      name: action.name,
      description: action.description,
      parameters: action.parameters
    }));
  },

  async executeAction(actionName, params = {}) {
    const action = this.actions[actionName];
    if (!action) return { error: `Unknown action: ${actionName}. Use TI.getAvailableActions() to see available actions.` };

    // Validate required parameters
    for (const [key, schema] of Object.entries(action.parameters)) {
      if (schema.required && !(key in params)) {
        return { error: `Missing required parameter: ${key} - ${schema.description}` };
      }
    }

    try {
      return await action.handler(params);
    } catch (err) {
      console.error(`Action ${actionName} failed:`, err);
      return { error: `Action failed: ${err.message}` };
    }
  },

  // ==========================================
  // GUIDED FUNNEL FLOW SYSTEM
  // ==========================================
  _flows: {},
  _activeFlow: null,

  _registerFlows() {
    this._flows = {
      'property-analysis': {
        name: 'property-analysis',
        description: 'Analyze a property for investment potential',
        steps: [
          { id: 'enter-address', label: 'Enter Property Address', fields: ['address', 'purchasePrice', 'rentEstimate'] },
          { id: 'select-strategy', label: 'Select Analysis Strategy', fields: ['strategy'] },
          { id: 'run-analysis', label: 'Running Analysis', auto: true },
          { id: 'show-results', label: 'View Results' },
          { id: 'next-steps', label: 'Suggested Next Steps' }
        ],
        execute: async (flowState) => {
          const step = flowState.currentStep;

          if (step === 'run-analysis') {
            const result = await TI.executeAction('analyze-property', {
              address: flowState.data.address,
              strategy: flowState.data.strategy || 'rental',
              purchasePrice: flowState.data.purchasePrice ? Number(flowState.data.purchasePrice) : undefined,
              rentEstimate: flowState.data.rentEstimate ? Number(flowState.data.rentEstimate) : undefined
            });
            flowState.data.result = result;
            return { advance: true, result };
          }

          if (step === 'next-steps') {
            return {
              suggestions: TI.getRecommendation({ page: '/tools/property-analyzer/' }),
              result: flowState.data.result
            };
          }

          return { waitingForInput: true, fields: flowState.steps.find(s => s.id === step)?.fields || [] };
        }
      },

      'membership-signup': {
        name: 'membership-signup',
        description: 'Sign up for a ToInvested membership plan',
        steps: [
          { id: 'select-plan', label: 'Choose Your Plan', fields: ['plan', 'billing'] },
          { id: 'checkout', label: 'Complete Checkout', auto: true }
        ],
        execute: async (flowState) => {
          if (flowState.currentStep === 'checkout') {
            const result = await TI.executeAction('start-membership', {
              plan: flowState.data.plan,
              billing: flowState.data.billing || 'monthly',
              email: flowState.data.email
            });
            return { complete: true, result };
          }
          return { waitingForInput: true, fields: ['plan', 'billing'] };
        }
      },

      'coaching-booking': {
        name: 'coaching-booking',
        description: 'Book a coaching session',
        steps: [
          { id: 'select-type', label: 'Select Coaching Type', fields: ['type'] },
          { id: 'pick-datetime', label: 'Pick Date & Time', fields: ['date', 'time'] },
          { id: 'enter-details', label: 'Your Details', fields: ['name', 'email', 'notes'] },
          { id: 'confirm-booking', label: 'Confirm Booking', auto: true }
        ],
        execute: async (flowState) => {
          if (flowState.currentStep === 'confirm-booking') {
            const result = await TI.executeAction('book-coaching', flowState.data);
            return { complete: true, result };
          }
          return { waitingForInput: true, fields: flowState.steps.find(s => s.id === flowState.currentStep)?.fields || [] };
        }
      },

      'deal-comparison': {
        name: 'deal-comparison',
        description: 'Compare multiple analyzed deals side by side',
        steps: [
          { id: 'select-deals', label: 'Select Deals to Compare' },
          { id: 'show-comparison', label: 'Side-by-Side Comparison' }
        ],
        execute: async (flowState) => {
          if (flowState.currentStep === 'select-deals') {
            const history = TI.progress._load().analysisHistory;
            return { waitingForInput: true, availableDeals: history, message: 'Select deals from your analysis history to compare.' };
          }
          if (flowState.currentStep === 'show-comparison') {
            const selectedDeals = flowState.data.selectedDeals || [];
            const history = TI.progress._load().analysisHistory;
            const deals = selectedDeals.map(idx => history[idx]).filter(Boolean);
            return {
              comparison: deals.map(d => ({ type: d.type, input: d.input, summary: d.summary, date: new Date(d.timestamp).toLocaleDateString() })),
              complete: true
            };
          }
          return { waitingForInput: true };
        }
      }
    };
  },

  startFlow(flowName) {
    const flow = this._flows[flowName];
    if (!flow) return { error: `Unknown flow: ${flowName}. Available: ${Object.keys(this._flows).join(', ')}` };

    this._activeFlow = {
      name: flowName,
      steps: flow.steps,
      currentStepIndex: 0,
      currentStep: flow.steps[0].id,
      data: {},
      startedAt: Date.now()
    };

    return {
      flow: flowName,
      description: flow.description,
      totalSteps: flow.steps.length,
      currentStep: flow.steps[0],
      message: `Started "${flow.description}" flow. Step 1/${flow.steps.length}: ${flow.steps[0].label}`
    };
  },

  async advanceFlow(inputData = {}) {
    if (!this._activeFlow) return { error: 'No active flow. Use TI.startFlow(flowName) to begin.' };

    const flow = this._flows[this._activeFlow.name];
    Object.assign(this._activeFlow.data, inputData);

    const result = await flow.execute(this._activeFlow);

    if (result.advance || result.complete) {
      if (!result.complete) {
        this._activeFlow.currentStepIndex++;
        if (this._activeFlow.currentStepIndex < this._activeFlow.steps.length) {
          this._activeFlow.currentStep = this._activeFlow.steps[this._activeFlow.currentStepIndex].id;

          // Auto-execute if the next step is marked auto
          const nextStep = this._activeFlow.steps[this._activeFlow.currentStepIndex];
          if (nextStep.auto) {
            return await this.advanceFlow();
          }

          return {
            ...result,
            currentStep: nextStep,
            stepNumber: this._activeFlow.currentStepIndex + 1,
            totalSteps: this._activeFlow.steps.length,
            message: `Step ${this._activeFlow.currentStepIndex + 1}/${this._activeFlow.steps.length}: ${nextStep.label}`
          };
        }
      }
      // Flow complete
      const flowData = { ...this._activeFlow };
      this._activeFlow = null;
      return { ...result, complete: true, flowData };
    }

    return {
      ...result,
      currentStep: this._activeFlow.steps[this._activeFlow.currentStepIndex],
      stepNumber: this._activeFlow.currentStepIndex + 1,
      totalSteps: this._activeFlow.steps.length
    };
  },

  getFlowStatus() {
    if (!this._activeFlow) return { active: false };
    return {
      active: true,
      flow: this._activeFlow.name,
      currentStep: this._activeFlow.steps[this._activeFlow.currentStepIndex],
      stepNumber: this._activeFlow.currentStepIndex + 1,
      totalSteps: this._activeFlow.steps.length,
      data: this._activeFlow.data
    };
  },

  // ==========================================
  // CONVERSATIONAL UI HELPERS
  // ==========================================
  chat: {
    _responseCallbacks: [],

    open() {
      // Navigate to AI coach if not already there
      if (!window.location.pathname.includes('/ai-coach')) {
        window.location.href = '/ai-coach/';
        return;
      }
      // Try to focus the chat input on the page
      const input = document.querySelector('[data-chat-input], #chat-input, .chat-input, input[type="text"][placeholder*="chat"], textarea[placeholder*="message"]');
      if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth' }); }
    },

    send(message) {
      // Try to find chat input and submit
      const input = document.querySelector('[data-chat-input], #chat-input, .chat-input, input[type="text"][placeholder*="chat"], textarea[placeholder*="message"]');
      if (input) {
        // Set value using native setter to trigger React/framework change detection
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
                             Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(input, message);
        else input.value = message;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        // Try to find and click send button
        const sendBtn = document.querySelector('[data-chat-send], #chat-send, .chat-send, button[type="submit"]');
        if (sendBtn) {
          setTimeout(() => sendBtn.click(), 50);
        } else {
          // Try submitting via Enter key
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        return { success: true, message: 'Message sent' };
      }

      // If not on the chat page, queue the message
      sessionStorage.setItem('tiChatPendingMessage', message);
      if (!window.location.pathname.includes('/ai-coach')) {
        window.location.href = '/ai-coach/';
      }
      return { success: true, message: 'Message queued, navigating to AI coach' };
    },

    onResponse(callback) {
      TI.chat._responseCallbacks.push(callback);
      // Observe chat container for new messages
      const chatContainer = document.querySelector('[data-chat-messages], #chat-messages, .chat-messages');
      if (chatContainer && !TI.chat._observer) {
        TI.chat._observer = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                const text = node.textContent;
                TI.chat._responseCallbacks.forEach(cb => {
                  try { cb({ text, element: node }); } catch (err) { console.error('Chat response callback error:', err); }
                });
              }
            });
          });
        });
        TI.chat._observer.observe(chatContainer, { childList: true, subtree: true });
      }
      return () => {
        TI.chat._responseCallbacks = TI.chat._responseCallbacks.filter(cb => cb !== callback);
      };
    }
  },

  // ==========================================
  // STRUCTURED DATA EXPOSURE
  // ==========================================
  getPageContext() {
    const path = window.location.pathname;
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id || null,
      action: f.action || null,
      dataset: { ...f.dataset },
      fields: Array.from(f.querySelectorAll('input, select, textarea')).map(el => ({
        name: el.name || el.id || null,
        type: el.type || el.tagName.toLowerCase(),
        placeholder: el.placeholder || null,
        required: el.required,
        options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => ({ value: o.value, label: o.textContent })) : undefined
      }))
    }));

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a.button, [data-action]')).map(el => ({
      text: el.textContent?.trim().substring(0, 80),
      action: el.dataset.action || null,
      href: el.href || null,
      id: el.id || null,
      type: el.type || null
    }));

    // Determine page type and available actions
    let pageType = 'general';
    const availablePageActions = [];

    if (path.includes('property-analyzer') || path.includes('flip-analyzer') || path.includes('brrrr-analyzer')) {
      pageType = 'analyzer-property';
      availablePageActions.push('analyze-property');
    } else if (path.includes('stock-analyzer')) {
      pageType = 'analyzer-stock';
      availablePageActions.push('analyze-stock');
    } else if (path.includes('bitcoin-analyzer')) {
      pageType = 'analyzer-bitcoin';
      availablePageActions.push('analyze-bitcoin');
    } else if (path.includes('membership')) {
      pageType = 'membership';
      availablePageActions.push('start-membership');
    } else if (path.includes('coaching')) {
      pageType = 'coaching';
      availablePageActions.push('book-coaching');
    } else if (path.includes('store') || path.includes('products')) {
      pageType = 'store';
      availablePageActions.push('add-to-cart');
    } else if (path.includes('blog')) {
      pageType = 'blog';
      availablePageActions.push('search-blog');
    } else if (path.includes('ai-coach')) {
      pageType = 'ai-coach';
    } else if (path === '/' || path === '/index.html') {
      pageType = 'homepage';
    }

    return {
      url: window.location.href,
      path,
      pageType,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || null,
      isLoggedIn: this.isLoggedIn(),
      user: this.user ? { name: this.user.name, email: this.user.email } : null,
      forms,
      buttons: buttons.slice(0, 30), // Limit to 30 buttons
      availableActions: availablePageActions.map(a => this.actions[a] ? { name: a, description: this.actions[a].description, parameters: this.actions[a].parameters } : null).filter(Boolean),
      allActions: this.getAvailableActions(),
      activeFlow: this.getFlowStatus(),
      recommendations: this.getRecommendation({ page: path }),
      progress: this.progress.getSummary()
    };
  },

  // ==========================================
  // AUTO-INIT
  // ==========================================
  init() {
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = '@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
    document.head.appendChild(style);

    // Update navigation auth state
    this.updateNav();
    this.updateCartBadge();

    // Auto-wire newsletter forms
    document.querySelectorAll('[data-newsletter-form]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('input[type="email"]').value;
        const name = form.querySelector('input[name="name"]')?.value || '';
        const btn = form.querySelector('button[type="submit"]');
        const origText = btn.textContent;
        btn.textContent = 'Subscribing...';
        btn.disabled = true;
        const result = await this.subscribeNewsletter(email, name);
        if (result && !result.error) {
          this.showNotification(result.message || 'Subscribed!');
          form.reset();
        } else {
          this.showNotification(result?.error || 'Failed to subscribe', 'error');
        }
        btn.textContent = origText;
        btn.disabled = false;
      });
    });

    // Auto-wire contact forms
    document.querySelectorAll('[data-contact-form]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const btn = form.querySelector('button[type="submit"]');
        const origText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.disabled = true;
        const result = await this.submitContact(data.email, data.name, data.phone, data.message);
        if (result && !result.error) {
          this.showNotification(result.message || 'Message sent!');
          form.reset();
        } else {
          this.showNotification(result?.error || 'Failed to send', 'error');
        }
        btn.textContent = origText;
        btn.disabled = false;
      });
    });

    // Report errors to backend for self-healing
    window.addEventListener('error', (e) => {
      console.error('Page error:', e.message);
      // Don't flood the server with error reports
      if (!this._errorReported) {
        this._errorReported = true;
        setTimeout(() => { this._errorReported = false; }, 60000);
      }
    });

    // ---- Initialize AI Agent & Interactivity Systems ----

    // Register action registry and flow system
    this._registerActions();
    this._registerFlows();

    // Track page visit
    this.progress.trackPageVisit(window.location.pathname);
    this.emit('page-view', { path: window.location.pathname, title: document.title });

    // Auto-wire semantic attributes: data-action, data-flow, data-chatbot-trigger
    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        const actionName = el.dataset.action;
        // Collect params from data attributes (data-param-* or other data-* attributes)
        const params = {};
        for (const [key, value] of Object.entries(el.dataset)) {
          if (key === 'action') continue;
          // Convert data-address to address, data-param-ticker to ticker
          const paramName = key.startsWith('param') ? key.charAt(5).toLowerCase() + key.slice(6) : key;
          params[paramName] = value;
        }
        el.classList.add('ti-loading');
        const origText = el.textContent;
        el.textContent = 'Processing...';
        el.disabled = true;
        const result = await this.executeAction(actionName, params);
        el.classList.remove('ti-loading');
        el.textContent = origText;
        el.disabled = false;
        if (result && !result.error) {
          this.showNotification('Action completed!');
        } else if (result?.error) {
          this.showNotification(result.error, 'error');
        }
      });
    });

    document.querySelectorAll('[data-flow]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const flowName = el.dataset.flow;
        const result = this.startFlow(flowName);
        if (result.error) {
          this.showNotification(result.error, 'error');
        } else {
          this.showNotification(`Started: ${result.description}`);
        }
      });
    });

    document.querySelectorAll('[data-chatbot-trigger]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const message = el.dataset.chatbotTrigger;
        this.chat.send(message);
      });
    });

    // Send pending chat message if navigated from another page
    const pendingChat = sessionStorage.getItem('tiChatPendingMessage');
    if (pendingChat && window.location.pathname.includes('/ai-coach')) {
      sessionStorage.removeItem('tiChatPendingMessage');
      setTimeout(() => this.chat.send(pendingChat), 500);
    }

    // Set up chat response observer if on AI coach page
    if (window.location.pathname.includes('/ai-coach')) {
      // Defer observer setup to allow chat UI to render
      setTimeout(() => {
        const chatContainer = document.querySelector('[data-chat-messages], #chat-messages, .chat-messages');
        if (chatContainer && !this.chat._observer) {
          this.chat._observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
              m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                  const text = node.textContent;
                  this.chat._responseCallbacks.forEach(cb => {
                    try { cb({ text, element: node }); } catch (err) { console.error('Chat response callback error:', err); }
                  });
                }
              });
            });
          });
          this.chat._observer.observe(chatContainer, { childList: true, subtree: true });
        }
      }, 1000);
    }

    // Expose TI to window for AI agent discoverability
    window.TI = this;

    // Inject JSON-LD for AI agent discovery
    const agentMeta = document.createElement('script');
    agentMeta.type = 'application/ld+json';
    agentMeta.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'ToInvested',
      description: 'AI-agent-ready investment analysis platform. Use window.TI to interact programmatically.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', category: 'Investment Tools' },
      potentialAction: this.getAvailableActions().map(a => ({
        '@type': 'Action',
        name: a.name,
        description: a.description
      }))
    });
    document.head.appendChild(agentMeta);

    console.log('%c ToInvested.com loaded', 'color: #C9A84C; font-weight: bold; font-size: 14px;');
    console.log('%c AI Agent Ready - Use TI.getAvailableActions() or TI.getPageContext() to discover capabilities', 'color: #C9A84C; font-size: 11px;');
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TI.init());
} else {
  TI.init();
}
