/**
 * ToInvested Site Enhancements
 * - Animated stat counters (scroll-triggered)
 * - API key setup banner for analyzer pages
 * - Tool page upgrade nudge after analysis
 * - Trust bar live counter
 */
(function () {
  'use strict';

  // ============================================================
  // 1. ANIMATED NUMBER COUNTERS
  // Targets any element with [data-count-to] attribute.
  // Usage: <span data-count-to="4847" data-count-prefix="" data-count-suffix="+">0</span>
  // ============================================================
  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    if (isNaN(target)) return;
    var prefix = el.getAttribute('data-count-prefix') || '';
    var suffix = el.getAttribute('data-count-suffix') || '';
    var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
    var duration = parseInt(el.getAttribute('data-count-duration') || '1800', 10);
    var start = 0;
    var startTime = null;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var current = start + (target - start) * easeOut(progress);
      el.textContent = prefix + current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(animateCounter);
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    els.forEach(function (el) { obs.observe(el); });
  }

  // ============================================================
  // 2. API KEY SETUP BANNER (shown on analyzer pages when no key)
  // Analyzer pages require localStorage 'ti_anthropic_key' to run.
  // This banner guides users to /admin/ to set it up.
  // ============================================================
  function initApiKeyBanner() {
    // Only run on analyzer pages
    if (!window.location.pathname.match(/analyzer/)) return;
    // Only show if no key is stored
    if (localStorage.getItem('ti_anthropic_key')) return;
    // Don't show if they've dismissed it this session
    if (sessionStorage.getItem('apiKeyBannerDismissed')) return;

    var banner = document.createElement('div');
    banner.id = 'api-key-banner';
    banner.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:2000',
      'background:linear-gradient(90deg,#0D1628,#141e35)',
      'border-top:2px solid #C9A84C',
      'padding:14px 20px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:16px',
      'font-family:\'DM Sans\',sans-serif',
      'flex-wrap:wrap',
    ].join(';');

    banner.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;flex:1;">' +
        '<span style="font-size:22px;">&#128273;</span>' +
        '<div>' +
          '<p style="font-size:14px;font-weight:700;color:#fff;margin:0;">Set up your free API key to run live AI analysis</p>' +
          '<p style="font-size:12px;color:#8890A0;margin:2px 0 0;">One-time setup &mdash; takes 60 seconds. Free Anthropic account required.</p>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-shrink:0;">' +
        '<a href="/admin/" style="background:linear-gradient(135deg,#C9A84C,#B8943A);color:#0A0E17;padding:10px 22px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap;">Set Up Free API Key &rarr;</a>' +
        '<button id="api-banner-dismiss" style="background:none;border:none;color:#6A7080;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1;" aria-label="Dismiss">&times;</button>' +
      '</div>';

    document.body.appendChild(banner);

    document.getElementById('api-banner-dismiss').addEventListener('click', function () {
      banner.style.transform = 'translateY(100%)';
      banner.style.transition = 'transform 0.3s ease';
      sessionStorage.setItem('apiKeyBannerDismissed', '1');
    });
  }

  // ============================================================
  // 3. TOOL RESULT UPGRADE NUDGE
  // After an analysis completes, inject a sticky upgrade strip
  // at the bottom of the results area.
  // Called externally: window.TI_showUpgradeNudge()
  // ============================================================
  window.TI_showUpgradeNudge = function (planUrl) {
    if (document.getElementById('ti-upgrade-nudge')) return;
    var nudge = document.createElement('div');
    nudge.id = 'ti-upgrade-nudge';
    nudge.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:1800',
      'background:linear-gradient(90deg,#0D1628,#1a2540)',
      'border-top:1px solid rgba(201,168,76,0.4)',
      'padding:12px 20px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:20px',
      'font-family:\'DM Sans\',sans-serif',
      'flex-wrap:wrap',
      'animation:slideUpNudge 0.4s ease',
    ].join(';');

    var url = planUrl || '/membership/';
    nudge.innerHTML =
      '<p style="font-size:14px;color:#C8D0DC;margin:0;">&#127942;&nbsp; <strong style="color:#fff;">Liked this analysis?</strong> Get unlimited reports, portfolio tracking &amp; monthly strategy calls.</p>' +
      '<a href="' + url + '" style="background:linear-gradient(135deg,#C9A84C,#B8943A);color:#0A0E17;padding:10px 22px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap;">Join Wealth Builder &mdash; $47/mo &rarr;</a>' +
      '<button onclick="document.getElementById(\'ti-upgrade-nudge\').remove();" style="background:none;border:none;color:#6A7080;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1;" aria-label="Close">&times;</button>';

    var style = document.createElement('style');
    style.textContent = '@keyframes slideUpNudge { from { transform:translateY(100%); } to { transform:translateY(0); } }';
    document.head.appendChild(style);

    document.body.appendChild(nudge);
  };

  // ============================================================
  // 4. LIVE TRUST BAR COUNTER
  // Increments the "X Deals Analyzed" number displayed in hero
  // to give sense of real-time activity.
  // ============================================================
  function initLiveTrustCounter() {
    var el = document.querySelector('[data-live-count]');
    if (!el) return;
    var base = parseInt(el.getAttribute('data-live-count'), 10) || 4847;
    var format = function (n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    el.textContent = format(base);
    // Increment by 1 every 45-90 seconds to simulate live activity
    setInterval(function () {
      base += Math.floor(Math.random() * 3) + 1;
      el.textContent = format(base);
    }, Math.floor(Math.random() * 45000) + 45000);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    initCounters();
    initApiKeyBanner();
    initLiveTrustCounter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
