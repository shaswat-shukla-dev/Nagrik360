// ====== Nagrik360 motion engine ======
// Small, dependency-free interaction layer. Everything here reacts to a real
// event (scroll position, click, data load) — no decorative loops running
// forever in the background.

(function () {
  const $ = (s, ctx) => (ctx || document).querySelector(s);
  const $all = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));

  /* ---------- Custom cursor (desktop, pointer:fine only) ---------- */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.append(dot, ring);

    let rx = 0, ry = 0, dx = 0, dy = 0;
    window.addEventListener('mousemove', (e) => {
      dx = e.clientX; dy = e.clientY;
      dot.style.left = dx + 'px'; dot.style.top = dy + 'px';
      document.body.classList.add('cursor-ready');
    }, { passive: true });

    (function loop() {
      rx += (dx - rx) * 0.18; ry += (dy - ry) * 0.18;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('button, a, input, textarea, select, .cat-chip, .feed-card')) {
        ring.classList.add('is-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('button, a, input, textarea, select, .cat-chip, .feed-card')) {
        ring.classList.remove('is-hover');
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  function observeReveals(root) {
    $all('.reveal', root).forEach((el) => io.observe(el));
  }

  function markReveals() {
    // Auto-tag section titles & cards that aren't already handled by entrance keyframes
    $all('.panel .card, .panel .section-title, .aqi-card, .chat-card').forEach((el, i) => {
      if (!el.classList.contains('reveal')) el.classList.add('reveal');
    });
    observeReveals(document);
  }
  markReveals();

  /* ---------- Ripple on buttons ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .upvote-btn, .share-btn, .tab, .cat-chip');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size / 2) + 'px';
    span.style.top = (e.clientY - rect.top - size / 2) + 'px';
    const prevPos = getComputedStyle(btn).position;
    if (prevPos === 'static') btn.style.position = 'relative';
    btn.style.overflow = btn.style.overflow || 'hidden';
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  });

  /* ---------- Magnetic pull on primary CTAs ---------- */
  $all('.btn--primary.btn--lg, .fab').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${mx * 0.12}px, ${my * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });

  /* ---------- Sliding tab indicator ---------- */
  const tabnav = $('#tabnav');
  if (tabnav) {
    const indicator = document.createElement('div');
    indicator.className = 'tabnav__indicator';
    tabnav.prepend(indicator);

    function moveIndicator(immediate) {
      const active = $('.tab.is-active', tabnav);
      if (!active) return;
      const navRect = tabnav.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      if (immediate) indicator.style.transition = 'none';
      indicator.style.width = r.width + 'px';
      indicator.style.transform = `translateX(${r.left - navRect.left + tabnav.scrollLeft}px)`;
      if (immediate) requestAnimationFrame(() => { indicator.style.transition = ''; });
    }
    moveIndicator(true);
    window.addEventListener('resize', () => moveIndicator(true));

    // Re-position whenever the active tab changes (MutationObserver, no need to touch app.js)
    const mo = new MutationObserver(() => moveIndicator(false));
    $all('.tab', tabnav).forEach((t) => mo.observe(t, { attributes: true, attributeFilter: ['class'] }));

    window.__moveTabIndicator = moveIndicator;
  }

  /* ---------- Animated stat counters ---------- */
  function animateCount(el, target) {
    const start = Number(el.dataset.count || 0);
    const end = Number(target) || 0;
    if (start === end) { el.textContent = end; return; }
    const dur = 900;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (end - start) * eased);
      el.textContent = val.toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
      else el.dataset.count = end;
    }
    requestAnimationFrame(step);
  }
  window.__animateCount = animateCount;

  /* ---------- Upload drag feedback ---------- */
  $all('.upload-box').forEach((box) => {
    ['dragenter', 'dragover'].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach((ev) => box.addEventListener(ev, () => box.classList.remove('is-dragover')));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      const input = box.querySelector('input[type=file]');
      if (input && e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  /* ---------- Re-run reveal tagging when panels swap (covers feed/leaderboard reload) ---------- */
  const panelObserver = new MutationObserver(() => { markReveals(); });
  $all('.panel').forEach((p) => panelObserver.observe(p, { childList: true, subtree: true }));

  /* ---------- Stagger helper exposed for app.js-rendered lists ---------- */
  window.__stagger = function (selector, root, step = 60) {
    $all(selector, root || document).forEach((el, i) => {
      el.style.setProperty('--d', `${i * step}ms`);
    });
  };
})();
