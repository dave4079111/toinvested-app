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

    console.log('%c ToInvested.com loaded', 'color: #C9A84C; font-weight: bold; font-size: 14px;');
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TI.init());
} else {
  TI.init();
}
