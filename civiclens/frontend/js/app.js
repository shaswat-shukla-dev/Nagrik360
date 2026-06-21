// ====== State ======
let selectedCategory = null;
let imageFile = null;
let verifyFile = null;
let currentCoords = null;
let lastReport = null;
let lastAI = null;

// ====== Helpers ======
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return document.querySelectorAll(sel); }

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  setTimeout(() => t.classList.remove('is-visible'), 3000);
}

function fingerprint(){
  let fp = localStorage.getItem('nagrik360_fp');
  if (!fp){ fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('nagrik360_fp', fp); }
  return fp;
}

// ====== Tabs ======
$all('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});
function switchTab(name){
  $all('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  $all('.panel').forEach(p => p.classList.toggle('is-active', p.id === `panel-${name}`));
  if (name === 'feed') loadFeed();
  if (name === 'leaderboard') loadLeaderboard();
  window.__moveTabIndicator?.(false);
  window.scrollTo({ top: $('#tabnav').offsetTop - 10, behavior: 'smooth' });
}
$('#heroReportBtn').addEventListener('click', () => switchTab('report'));
$('#heroFeedBtn').addEventListener('click', () => switchTab('feed'));
$('#fabReport').addEventListener('click', () => switchTab('report'));

// ====== Category grid ======
function renderCategories(){
  const grid = $('#catGrid');
  grid.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="cat-chip" data-cat="${c.id}">
      <span class="emoji">${c.emoji}</span>${c.label}
    </button>`).join('');
  grid.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      grid.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('is-selected'));
      chip.classList.add('is-selected');
      selectedCategory = chip.dataset.cat;
    });
  });

  const filterSelect = $('#feedFilter');
  filterSelect.innerHTML = '<option value="">All categories</option>' +
    CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
}
renderCategories();

// ====== Image upload ======
function wireUpload(inputId, boxId, previewId, placeholderId, onSet){
  const input = $(`#${inputId}`), box = $(`#${boxId}`), preview = $(`#${previewId}`), placeholder = $(`#${placeholderId}`);
  box.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    onSet(file);
    const url = URL.createObjectURL(file);
    preview.src = url; preview.hidden = false; placeholder.hidden = true;
  });
}
wireUpload('imageInput', 'uploadBox1', 'imagePreview1', 'uploadPlaceholder1', f => imageFile = f);
wireUpload('verifyInput', 'uploadBox2', 'imagePreview2', 'uploadPlaceholder2', f => verifyFile = f);

// ====== Geolocation ======
$('#locBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocation not supported on this device');
  $('#locLabel').textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('#locLabel').textContent = `📍 ${currentCoords.lat.toFixed(4)}, ${currentCoords.lon.toFixed(4)}`;
      fetchAndShowAqiPill();
    },
    () => { $('#locLabel').textContent = 'Could not get location — try again'; toast('Location permission denied'); },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// ====== AQI pill (topbar) ======
async function fetchAndShowAqiPill(){
  if (!currentCoords) return;
  try {
    const data = await API.getAQI(currentCoords.lat, currentCoords.lon);
    $('#aqiText').textContent = `AQI ${data.aqi}`;
    $('#aqiDot').style.background = data.color;
  } catch (e) { /* silent */ }
}
$('#aqiPill').addEventListener('click', () => {
  switchTab('aqi');
  if (currentCoords) fetchAqiDetail(currentCoords.lat, currentCoords.lon);
});

// ====== AQI tab ======
$('#fetchAqiBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(
    pos => { currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; fetchAqiDetail(currentCoords.lat, currentCoords.lon); },
    () => toast('Could not access location')
  );
});
async function fetchAqiDetail(lat, lon){
  $('#aqiCard').innerHTML = '<p class="muted">Fetching live air quality…</p>';
  try {
    const data = await API.getAQI(lat, lon);
    const pct = Math.max(0, Math.min(1, data.aqi / 300));
    const circumference = 251;
    $('#aqiCard').innerHTML = `
      <div style="position:relative; width:140px; height:140px; margin:0 auto;">
        <svg class="aqi-ring" width="140" height="140" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="40" fill="none" stroke="var(--line)" stroke-width="7"/>
          <circle class="bar" cx="45" cy="45" r="40" fill="none" stroke="${data.color}" stroke-width="7" stroke-linecap="round"
            stroke-dashoffset="${circumference}"/>
        </svg>
        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div class="aqi-num" style="font-size:1.8rem; color:${data.color}">${data.aqi}</div>
        </div>
      </div>
      <p style="color:${data.color}; font-weight:700; margin-top:10px;">${data.label}</p>
      <p class="muted">US AQI scale · updated just now</p>`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = $('.aqi-ring circle.bar');
      if (bar) bar.style.strokeDashoffset = circumference * (1 - pct);
    }));
    $('#aqiDetail').hidden = false;
    $('#aqiDetail').innerHTML = `
      <div class="aqi-stat" style="--d:0ms"><div class="stat__num" style="font-size:1.3rem">${fmt(data.pm25)}</div><div class="aqi-stat__label">PM2.5 µg/m³</div></div>
      <div class="aqi-stat" style="--d:80ms"><div class="stat__num" style="font-size:1.3rem">${fmt(data.pm10)}</div><div class="aqi-stat__label">PM10 µg/m³</div></div>
      <div class="aqi-stat" style="--d:160ms"><div class="stat__num" style="font-size:1.3rem">${fmt(data.no2)}</div><div class="aqi-stat__label">NO₂ µg/m³</div></div>
      <div class="aqi-stat" style="--d:240ms"><div class="stat__num" style="font-size:1.3rem">${fmt(data.ozone)}</div><div class="aqi-stat__label">Ozone µg/m³</div></div>`;
    $('#aqiText').textContent = `AQI ${data.aqi}`;
    $('#aqiDot').style.background = data.color;
  } catch (e) {
    $('#aqiCard').innerHTML = `<p class="muted">Could not fetch AQI: ${e.message}</p><button class="btn btn--primary" id="fetchAqiBtn2">Retry</button>`;
    $('#fetchAqiBtn2')?.addEventListener('click', () => fetchAqiDetail(lat, lon));
  }
}
function fmt(n){ return (n === undefined || n === null) ? '—' : Math.round(n * 10) / 10; }

// ====== Submit report ======
$('#reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedCategory) return toast('Please select an issue category');
  const desc = $('#description').value.trim();

  const btn = $('#submitBtn');
  btn.disabled = true; btn.classList.add('is-loading');
  $('#submitBtnText').innerHTML = 'AI is analyzing<span class="spinner-dots"><span></span><span></span><span></span></span>';

  const fd = new FormData();
  fd.append('category', selectedCategory);
  fd.append('description', desc);
  if (currentCoords){ fd.append('latitude', currentCoords.lat); fd.append('longitude', currentCoords.lon); }
  if (imageFile) fd.append('image', imageFile);
  if (verifyFile) fd.append('verification_image', verifyFile);

  try {
    const data = await API.submitReport(fd);
    lastReport = data.report; lastAI = data.ai;
    renderResult(data.report, data.ai);
    toast('Report submitted and analyzed ✅');
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    btn.disabled = false; btn.classList.remove('is-loading'); $('#submitBtnText').textContent = 'Analyze & submit report';
  }
});

function renderResult(report, ai){
  $('#resultEmpty').hidden = true;
  $('#resultBody').hidden = false;

  if (!$('#resultSuccessCheck')){
    $('#resultBody').insertAdjacentHTML('afterbegin', `
      <div class="success-check" id="resultSuccessCheck">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4FC78A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      </div>`);
  } else {
    // retrigger the draw animation on subsequent submissions
    const check = $('#resultSuccessCheck');
    check.classList.remove('success-check'); void check.offsetWidth; check.classList.add('success-check');
  }

  const badge = $('#severityBadge');
  badge.textContent = (ai.severity || 'medium') + ' severity';
  badge.className = 'severity-badge ' + (ai.severity || 'medium');

  $('#resultSummary').textContent = ai.summary || report.description || 'Report submitted';

  $('#impactList').innerHTML = (ai.health_impact || []).map(i => `<li>${escapeHtml(i)}</li>`).join('') || '<li>No additional impact data available.</li>';
  window.__stagger?.('#impactList li', null, 60);

  $('#solutionsList').innerHTML = (ai.solutions || []).map(s => `
    <div class="solution-row"><b>${escapeHtml(s.who)}:</b> ${escapeHtml(s.action)}</div>`).join('') || '<p class="muted">No suggestions generated.</p>';
  window.__stagger?.('.solution-row', $('#solutionsList'), 70);

  $('#deptName').textContent = ai.suggested_department || 'Municipal Corporation';
  $('#govComplaintText').value = ai.gov_complaint_text || report.description || '';
  $('#govStatus').textContent = '';

  // share captions
  window.__shareCaption = ai.social_caption || `I just reported a civic issue (${report.category.replace(/_/g,' ')}) via Nagrik360 🚩 #CivicSense #CleanIndia`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ====== Send to government ======
$('#sendGovBtn').addEventListener('click', async () => {
  if (!lastReport) return;
  const text = $('#govComplaintText').value;
  $('#govStatus').textContent = 'Sending…';
  try {
    const data = await API.reportToGov(lastReport.id, text);
    $('#govStatus').textContent = `✅ Forwarded. Reference ID: ${data.gov_result.refId}${data.gov_result.simulated ? ' (demo mode — configure SMTP for live delivery)' : ''}`;
    toast('Sent to government grievance cell');
  } catch (e) {
    $('#govStatus').textContent = '❌ ' + e.message;
  }
});

// ====== Social sharing ======
$('#shareX').addEventListener('click', () => {
  const text = encodeURIComponent(window.__shareCaption || 'Civic issue reported via Nagrik360');
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
});
$('#shareWA').addEventListener('click', () => {
  const text = encodeURIComponent(window.__shareCaption || 'Civic issue reported via Nagrik360');
  window.open(`https://wa.me/?text=${text}`, '_blank');
});
$('#shareFB').addEventListener('click', () => {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}&quote=${encodeURIComponent(window.__shareCaption||'')}`, '_blank');
});
$('#shareCopy').addEventListener('click', () => {
  navigator.clipboard?.writeText(window.__shareCaption || '');
  toast('Caption copied to clipboard');
});

// ====== Feed ======
async function loadFeed(){
  const grid = $('#feedGrid');
  grid.innerHTML = Array.from({length:6}).map(() => '<div class="skeleton skeleton-card"></div>').join('');
  try {
    const cat = $('#feedFilter').value;
    const { reports } = await API.listReports(cat ? { category: cat } : {});
    if (!reports.length){ grid.innerHTML = '<p class="muted">No reports yet — be the first to file one!</p>'; return; }
    grid.innerHTML = reports.map(r => `
      <div class="feed-card">
        ${r.image_path ? `<img src="${r.image_path}" alt="report photo" loading="lazy"/>` : ''}
        <div class="feed-card__body">
          <div class="feed-card__cat">${catEmoji(r.category)} ${r.category.replace(/_/g,' ')}</div>
          <p class="feed-card__desc">${escapeHtml((r.description || r.ai_summary || 'No description').slice(0,110))}</p>
          <div class="feed-card__meta">
            <span class="status-pill" data-status="${r.status}">${r.status.replace(/_/g,' ')}</span>
            <button class="upvote-btn" data-id="${r.id}">▲ ${r.upvotes || 0}</button>
          </div>
        </div>
      </div>`).join('');
    window.__stagger?.('.feed-card', grid, 60);
    grid.querySelectorAll('.upvote-btn').forEach(b => b.addEventListener('click', async () => {
      const data = await API.upvote(b.dataset.id, fingerprint());
      if (data.report) {
        b.textContent = `▲ ${data.report.upvotes}`;
        b.classList.remove('is-voted'); void b.offsetWidth; b.classList.add('is-voted');
      }
    }));
  } catch (e) {
    grid.innerHTML = `<p class="muted">Could not load feed: ${e.message}</p>`;
  }
}
function catEmoji(id){ return (CATEGORIES.find(c => c.id === id) || {}).emoji || '⚠️'; }
$('#feedFilter').addEventListener('change', loadFeed);

// ====== Stats strip ======
async function loadStats(){
  try {
    const s = await API.stats();
    window.__animateCount?.($('#statTotal'), s.total ?? 0);
    window.__animateCount?.($('#statForwarded'), s.forwarded_to_gov ?? 0);
    window.__animateCount?.($('#statResolved'), s.resolved ?? 0);
  } catch (e) { /* silent */ }
}
loadStats();

// ====== Leaderboard ======
async function loadLeaderboard(){
  const tbody = $('#leaderTable tbody');
  try {
    const { leaderboard } = await API.leaderboard();
    if (!leaderboard.length){ tbody.innerHTML = '<tr><td colspan="4" class="muted">Sign up and submit reports to appear here.</td></tr>'; return; }
    tbody.innerHTML = leaderboard.map((u,i) => `<tr><td>${i+1}</td><td>${escapeHtml(u.name)}</td><td>${u.points}</td><td>${escapeHtml(u.badge)}</td></tr>`).join('');
    window.__stagger?.('tr', tbody, 50);
  } catch (e) { /* silent */ }
}

// ====== Chat assistant ======
let chatHistory = [];
$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  appendChat('user', text);
  chatHistory.push({ role: 'user', content: text });
  input.value = '';
  const typingId = appendChat('bot', '');
  document.getElementById(typingId).innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  try {
    const { reply } = await API.chat(chatHistory);
    document.getElementById(typingId).textContent = reply;
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    document.getElementById(typingId).textContent = 'Sorry, AI assistant is unavailable right now: ' + e.message;
  }
});
function appendChat(role, text){
  const log = $('#chatLog');
  const id = 'm_' + Date.now() + Math.random().toString(36).slice(2,6);
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role}`;
  div.id = id; div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return id;
}

// ====== Auth modal ======
const authModal = $('#authModal');
$('#authBtn').addEventListener('click', () => authModal.classList.add('is-open'));
$('#authClose').addEventListener('click', () => authModal.classList.remove('is-open'));
$all('.modal__tab').forEach(t => t.addEventListener('click', () => {
  $all('.modal__tab').forEach(x => x.classList.remove('is-active'));
  t.classList.add('is-active');
  $('#loginForm').hidden = t.dataset.form !== 'login';
  $('#signupForm').hidden = t.dataset.form !== 'signup';
}));
function showAuthError(msg){
  const el = $('#authMsg');
  el.textContent = msg;
  el.classList.remove('has-error'); void el.offsetWidth; el.classList.add('has-error');
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await API.login($('#loginEmail').value, $('#loginPassword').value);
    onAuthed(data.user);
  } catch (err) { showAuthError(err.message); }
});
$('#signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await API.signup($('#signupName').value, $('#signupEmail').value, $('#signupPassword').value);
    onAuthed(data.user);
  } catch (err) { showAuthError(err.message); }
});
function onAuthed(user){
  $('#authBtn').textContent = user.name.split(' ')[0];
  authModal.classList.remove('is-open');
  toast(`Welcome, ${user.name}!`);
}
(function initAuthFromStorage(){
  const u = localStorage.getItem('nagrik360_user');
  if (u) { try { onAuthed(JSON.parse(u)); } catch(e){} }
})();
