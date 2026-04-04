/**
 * ToInvested Conversion Optimization Engine
 * Mechanisms: urgency bar, email gate, exit intent, social proof ticker, timed offer
 */
(function () {
  'use strict';

  // ============================================================
  // 1. URGENCY BAR
  // ============================================================
  function initUrgencyBar() {
    var bar = document.getElementById('urgency-bar');
    if (!bar) return;
    if (sessionStorage.getItem('urgencyBarDismissed')) { bar.style.display = 'none'; return; }

    setTimeout(function () {
      bar.style.transform = 'translateY(0)';
    }, 1500);

    var closeBtn = document.getElementById('urgency-bar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        bar.style.transform = 'translateY(-100%)';
        sessionStorage.setItem('urgencyBarDismissed', '1');
      });
    }
  }

  // ============================================================
  // 2. SOCIAL PROOF ACTIVITY TICKER
  // ============================================================
  var PROOF_EVENTS = [
    { name: 'Marcus R.', city: 'Atlanta, GA', action: 'just analyzed a rental deal' },
    { name: 'Tamara W.', city: 'Houston, TX', action: 'joined Wealth Builder' },
    { name: 'James L.', city: 'Phoenix, AZ', action: 'found a $412/mo cash-flow deal' },
    { name: 'Kevin M.', city: 'Charlotte, NC', action: 'upgraded to Pro Investor' },
    { name: 'Shayla B.', city: 'Las Vegas, NV', action: 'ran a BRRRR analysis' },
    { name: 'David T.', city: 'Memphis, TN', action: 'analyzed 3 flip deals today' },
    { name: 'Lisa K.', city: 'Dallas, TX', action: 'just avoided a bad deal' },
    { name: 'Raymond J.', city: 'Detroit, MI', action: 'found a 9.4% cap rate property' },
    { name: 'Priya S.', city: 'Atlanta, GA', action: 'started her free trial' },
    { name: 'Andre B.', city: 'Chicago, IL', action: 'ran a Fix & Flip analysis' },
  ];

  function showProofNotification(evt) {
    var el = document.getElementById('social-proof-ticker');
    if (!el) return;
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="width:34px;height:34px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#0A0E17;font-size:13px;flex-shrink:0;">' + evt.name.charAt(0) + '</div>' +
        '<div>' +
          '<div style="font-size:12px;font-weight:600;color:#fff;line-height:1.3;">' + evt.name + ' · ' + evt.city + '</div>' +
          '<div style="font-size:11px;color:#A0A8B8;">' + evt.action + ' · just now</div>' +
        '</div>' +
      '</div>';
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
    setTimeout(function () {
      el.style.transform = 'translateX(-110%)';
      el.style.opacity = '0';
    }, 4500);
  }

  function initSocialProofTicker() {
    var el = document.getElementById('social-proof-ticker');
    if (!el) return;
    var idx = 0;
    setTimeout(function () {
      showProofNotification(PROOF_EVENTS[idx]);
      idx = (idx + 1) % PROOF_EVENTS.length;
      setInterval(function () {
        showProofNotification(PROOF_EVENTS[idx]);
        idx = (idx + 1) % PROOF_EVENTS.length;
      }, 14000);
    }, 10000);
  }

  // ============================================================
  // 3. ANALYZER EMAIL GATE
  // ============================================================
  var ANALYSIS_STEPS = [
    'Fetching market comps\u2026',
    'Calculating cash flow\u2026',
    'Running AI risk analysis\u2026',
    'Generating deal verdict\u2026',
  ];

  function runAnalyzerAnimation(btn) {
    var step = 0;
    btn.textContent = ANALYSIS_STEPS[0];
    btn.disabled = true;
    btn.style.opacity = '0.85';
    var iv = setInterval(function () {
      step++;
      if (step < ANALYSIS_STEPS.length) {
        btn.textContent = ANALYSIS_STEPS[step];
      } else {
        clearInterval(iv);
        btn.textContent = 'View Full Report \u2192';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.background = 'linear-gradient(135deg,#2ECC71,#27AE60)';
        btn.onclick = function () { window.location.href = '/property-analyzer/'; };
        showResultUpsell();
      }
    }, 1100);
  }

  function showResultUpsell() {
    var container = document.querySelector('.sample-result');
    if (!container || container.querySelector('.result-upsell-overlay')) return;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    var overlay = document.createElement('div');
    overlay.className = 'result-upsell-overlay';
    overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,rgba(10,14,23,0.97) 55%,transparent);padding:36px 20px 20px;text-align:center;border-radius:0 0 14px 14px;';
    overlay.innerHTML =
      '<p style="font-size:11px;font-weight:700;color:#C9A84C;letter-spacing:2px;margin-bottom:6px;">UNLOCK FULL REPORT</p>' +
      '<p style="font-size:13px;color:#C8D0DC;margin-bottom:14px;">5-yr projections · Neighborhood risk · Renovation estimates</p>' +
      '<a href="/membership/" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#B8943A);color:#0A0E17;padding:11px 26px;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;">Get Full Report \u2014 Start Free \u2192</a>';
    container.appendChild(overlay);
  }

  function initAnalyzerGate() {
    var btn = document.querySelector('.analyzer-btn');
    var modal = document.getElementById('analyzer-gate-modal');
    if (!btn || !modal) return;

    // Replace the inline onclick already wired in the page script by re-wiring here
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var input = document.querySelector('.analyzer-input');
      if (!input || input.value.trim() === '') return;

      if (localStorage.getItem('tiEmailCaptured')) {
        runAnalyzerAnimation(btn);
        return;
      }

      var addrEl = modal.querySelector('.gate-address');
      if (addrEl) addrEl.textContent = input.value.trim();
      openModal(modal);
    }, true); // capture phase to fire before the inline handler

    var closeBtn = document.getElementById('gate-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });

    var form = document.getElementById('gate-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('gate-email').value;
        var name = document.getElementById('gate-name').value || '';
        var submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Getting Your Analysis\u2026';
        submitBtn.disabled = true;

        if (window.TI) await TI.subscribeNewsletter(email, name);
        localStorage.setItem('tiEmailCaptured', '1');

        closeModal(modal);
        runAnalyzerAnimation(document.querySelector('.analyzer-btn'));
      });
    }
  }

  // ============================================================
  // 4. EXIT INTENT POPUP
  // ============================================================
  function initExitIntent() {
    var modal = document.getElementById('exit-intent-modal');
    if (!modal) return;
    if (sessionStorage.getItem('exitIntentShown')) return;

    var triggered = false;
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0 && !triggered) {
        triggered = true;
        sessionStorage.setItem('exitIntentShown', '1');
        openModal(modal);
      }
    });

    var closeBtn = document.getElementById('exit-intent-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });

    var form = document.getElementById('exit-intent-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('exit-email').value;
        var submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Sending\u2026';
        submitBtn.disabled = true;

        if (window.TI) await TI.subscribeNewsletter(email, 'Exit Intent');

        var wrap = modal.querySelector('.exit-form-wrap');
        if (wrap) {
          wrap.innerHTML =
            '<div style="text-align:center;padding:16px 0;">' +
              '<div style="font-size:42px;margin-bottom:12px;">&#10003;</div>' +
              '<h3 style="color:#C9A84C;font-family:\'Playfair Display\',serif;margin-bottom:10px;">Check Your Email!</h3>' +
              '<p style="color:#A0A8B8;font-size:15px;margin-bottom:20px;">Your free checklist is on its way.</p>' +
              '<a href="/membership/" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#B8943A);color:#0A0E17;padding:13px 30px;border-radius:10px;font-weight:700;text-decoration:none;">Start Free Trial \u2192</a>' +
            '</div>';
        }
        setTimeout(function () { closeModal(modal); }, 5000);
      });
    }
  }

  // ============================================================
  // 5. TIMED OFFER (fires after 45 s of engagement)
  // ============================================================
  function startOfferCountdown() {
    var el = document.getElementById('offer-countdown');
    if (!el) return;
    var secs = 10 * 60;
    var iv = setInterval(function () {
      secs--;
      var m = Math.floor(secs / 60).toString().padStart(2, '0');
      var s = (secs % 60).toString().padStart(2, '0');
      el.textContent = m + ':' + s;
      if (secs <= 0) {
        clearInterval(iv);
        var modal = document.getElementById('timed-offer-modal');
        if (modal) closeModal(modal);
      }
    }, 1000);
  }

  function initTimedOffer() {
    var modal = document.getElementById('timed-offer-modal');
    if (!modal) return;
    if (sessionStorage.getItem('timedOfferShown')) return;

    setTimeout(function () {
      if (document.visibilityState !== 'visible') return;
      sessionStorage.setItem('timedOfferShown', '1');
      openModal(modal);
      startOfferCountdown();
    }, 45000);

    var closeBtn = document.getElementById('timed-offer-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  function openModal(modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // next frame for CSS transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add('conv-visible'); });
    });
  }

  function closeModal(modal) {
    modal.classList.remove('conv-visible');
    setTimeout(function () {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }, 300);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    initUrgencyBar();
    initSocialProofTicker();
    initAnalyzerGate();
    initExitIntent();
    initTimedOffer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
