// Page logic: language, today's quests, year goals, progress, settings, player UI.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Store = window.Store;
  const S = () => Store.state;

  const lang = () => S().lang;
  const dict = () => window.I18N[lang()];
  const t = (key, vars) => {
    let s = dict()[key] ?? window.I18N.en[key] ?? key;
    if (vars && typeof s === 'string') for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
    return s;
  };
  const locale = () => (lang() === 'ar' ? 'ar-u-ca-gregory-nu-arab' : 'en-US');
  const num = (n) => new Intl.NumberFormat(locale()).format(n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const year = new Date().getFullYear();
  const reduced = () => S().motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- language ----------------
  function applyLang() {
    const html = document.documentElement;
    html.lang = lang();
    html.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    document.title = t('title');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $('#langBtnLabel').textContent = lang() === 'ar' ? 'EN' : 'ع';
    $$('.seg [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang())));
    $$('.seg [data-motion]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.motion === S().motion)));
    $('#introYear').textContent = num(year).replace(/[٬,]/g, '');
    $('#yearNum').textContent = num(year).replace(/[٬,]/g, '');
  }

  function switchLang(to) {
    if (to === lang()) return;
    S().lang = to;
    Store.save();
    try { sessionStorage.setItem('mq.scroll', String(window.scrollY)); } catch {}
    location.reload();   // direction-dependent scroll choreography rebuilds cleanly on reload
  }

  // ---------------- the year wheel (built in SVG) ----------------
  function buildWheel() {
    const months = dict().months;
    const outer = $('#wheelOuter');
    const R = 418;
    let ticks = '';
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const major = i % 6 === 0;
      const r1 = major ? 452 : 462, r2 = 474;
      ticks += `<line x1="${500 + Math.sin(a) * r1}" y1="${500 - Math.cos(a) * r1}" x2="${500 + Math.sin(a) * r2}" y2="${500 - Math.cos(a) * r2}" class="${major ? 'tick-major' : 'tick'}"/>`;
    }
    // straight labels set on spokes (Arabic shaping breaks on curved text paths);
    // each one flips upright when the turning wheel carries it past the horizon
    let labels = '';
    months.forEach((m, i) => {
      labels += `<g transform="rotate(${i * 30} 500 500)"><text class="month-label" data-m="${i}" x="500" y="${500 - R + 12}" text-anchor="middle" dominant-baseline="middle">${esc(m)}</text></g>`;
    });
    let sprigs = '';
    [15, 105, 195, 285].forEach((deg) => {
      const a = (deg * Math.PI) / 180;
      const x = 500 + Math.sin(a) * 474, y = 500 - Math.cos(a) * 474;
      sprigs += `<g transform="translate(${x} ${y}) rotate(${deg})"><use href="#i-blossom" x="-18" y="-18" width="36" height="36" class="sprig"/><use href="#i-blossom" x="10" y="-30" width="22" height="22" class="sprig dim"/></g>`;
    });
    outer.innerHTML = `
      <circle cx="500" cy="500" r="476" class="ring-line"/>
      <circle cx="500" cy="500" r="378" class="ring-line faint"/>
      ${ticks}${labels}${sprigs}`;
    const inner = $('#wheelInner');
    let pips = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      pips += `<use href="#i-blossom" x="${500 + Math.sin(a) * 334 - 9}" y="${500 - Math.cos(a) * 334 - 9}" width="18" height="18" class="pip"/>`;
    }
    inner.innerHTML = `
      <circle cx="500" cy="500" r="356" class="ring-line dashed"/>
      ${pips}
      <circle cx="500" cy="500" r="312" class="ring-line"/>`;
    flipLabels(0);
  }
  // keep each month label upright: flip it when its spoke points below the horizon
  function flipLabels(rotation) {
    $$('#wheelOuter .month-label').forEach((el) => {
      const a = (((Number(el.dataset.m) * 30 + rotation) % 360) + 360) % 360;
      const flip = a > 95 && a < 265;
      el.setAttribute('transform', flip ? `rotate(180 ${el.getAttribute('x')} ${el.getAttribute('y')})` : '');
    });
  }

  // ---------------- today ----------------
  const today = Store.dayKey();
  function todaysQuests() {
    return S().quests.filter((q) => q.date === today || (!q.done && q.date < today));
  }

  function renderGreeting() {
    const h = new Date().getHours();
    const key = h >= 4 && h < 12 ? 'morning' : 'evening';
    $('#greetText').textContent = t(key, { name: S().name || '' }).replace(/،\s*!|,\s*!/, '!');
    $('#todayDate').textContent = new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
    $('#todayDate').dateTime = today;
    const notes = dict().notes;
    $('#noteQuote').textContent = notes[new Date().getDate() % notes.length];
  }

  function renderQuests() {
    const qs = todaysQuests();
    const done = qs.filter((q) => q.done).length;
    $('#questsCount').textContent = t('done', { d: num(done), t: num(qs.length) });
    const pct = qs.length ? Math.round((done / qs.length) * 100) : 0;
    $('#questsBar').setAttribute('aria-valuenow', pct);
    $('#questsBar span').style.width = pct + '%';
    $('#questEmpty').hidden = qs.length > 0;
    $('#questList').innerHTML = qs.map((q) => `
      <li class="quest${q.done ? ' is-done' : ''}" data-id="${q.id}">
        <label class="quest-check">
          <input type="checkbox" ${q.done ? 'checked' : ''}>
          <span class="box" aria-hidden="true"><svg><use href="#i-check"/></svg></span>
          <span class="quest-text">${esc(q.text)}${q.date < today ? ` <em class="carried">${esc(t('carried'))}</em>` : ''}</span>
        </label>
        <span class="xp-chip">+${num(q.xp)} XP</span>
        <button class="del" type="button" aria-label="${esc(t('deleteQuest', { t: q.text }))}"><svg><use href="#i-x"/></svg></button>
      </li>`).join('');
  }

  function renderStats(animate) {
    const li = Store.levelInfo();
    const st = Store.streaks();
    const set = (sel, v) => {
      const el = $(sel);
      const to = v;
      const from = Number(el.dataset.v || 0);
      el.dataset.v = to;
      if (!animate || reduced() || !window.gsap) { el.textContent = num(to); return; }
      const o = { v: from };
      gsap.to(o, { v: to, duration: 0.9, ease: 'expo.out', onUpdate: () => { el.textContent = num(Math.round(o.v)); } });
    };
    set('#statLevel', li.level);
    set('#statXp', li.xp);
    $('#statStreak').textContent = st.current === 1 ? t('day1') : t('days', { n: num(st.current) });
    $('#levelBarMini').style.width = li.pct * 100 + '%';
    // progress ledger
    set('#pLevel', li.level);
    $('#pLevelBar').style.width = li.pct * 100 + '%';
    $('#pLevelHint').textContent = t('levelHint', { n: num(li.need), l: num(li.level + 1) });
    $('#pXp').textContent = num(li.xp);
    $('#pDone').textContent = num(S().quests.filter((q) => q.done).length);
    $('#pGoals').textContent = num(S().goals.filter((g) => g.done && g.year === year).length);
    $('#pBest').textContent = num(st.best);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // petals burst from a point when something is completed
  function burst(x, y, n = 10) {
    if (reduced() || !window.gsap) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      p.setAttribute('class', 'burst-petal');
      p.innerHTML = '<use href="#i-blossom"/>';
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      gsap.set(p, { x, y, scale: 0.4 + Math.random() * 0.6, rotate: Math.random() * 180 });
      gsap.to(p, {
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 30 + Math.random() * 20,
        rotate: '+=' + (120 + Math.random() * 200), opacity: 0,
        duration: 1.1 + Math.random() * 0.6, ease: 'expo.out', onComplete: () => p.remove()
      });
    }
  }
  function floatXp(x, y, text) {
    const el = document.createElement('span');
    el.className = 'xp-float'; el.textContent = text;
    document.body.appendChild(el);
    if (!window.gsap || reduced()) { setTimeout(() => el.remove(), 900); return; }
    gsap.fromTo(el, { x, y, opacity: 0, scale: 0.8 }, { y: y - 70, opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
    gsap.to(el, { opacity: 0, y: y - 100, delay: 0.7, duration: 0.5, onComplete: () => el.remove() });
  }

  function complete(q, done, originEl) {
    const before = Store.levelInfo().level;
    q.done = done;
    S().log[today] = Math.max(0, (S().log[today] || 0) + (done ? 1 : -1));
    Store.save();
    renderQuests(); renderStats(true); renderHeat();
    if (done && originEl) {
      const r = originEl.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
      floatXp(r.left, r.top + window.scrollY - window.scrollY, t('toastXp', { xp: num(q.xp) }));
    }
    const after = Store.levelInfo().level;
    if (after > before) toast(t('toastLevel', { l: num(after) }));
  }

  // ---------------- year goals ----------------
  function renderMonths() {
    const months = dict().months;
    const cur = new Date().getMonth();
    const goals = S().goals.filter((g) => g.year === year);
    const doneAll = goals.filter((g) => g.done).length;
    $('#yearSummary').textContent = goals.length ? t('yearSummary', { d: num(doneAll), t: num(goals.length) }) : t('yearSummaryEmpty');
    $('#months').innerHTML = months.map((m, i) => {
      const gs = goals.filter((g) => g.month === i);
      const d = gs.filter((g) => g.done).length;
      const pct = gs.length ? (d / gs.length) * 100 : 0;
      return `
      <li class="month${i === cur ? ' is-current' : ''}${i < cur ? ' is-past' : ''}" data-month="${i}">
        <div class="month-inner">
          <header class="month-head">
            <span class="month-num">${num(i + 1)}</span>
            <h3>${esc(m)}</h3>
            ${i === cur ? `<span class="month-now">${esc(t('thisMonth'))}</span>` : ''}
          </header>
          <div class="month-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <p class="month-count">${gs.length ? t('goalCount', { d: num(d), t: num(gs.length) }) : esc(t('goalEmpty'))}</p>
          <ul class="goal-list">
            ${gs.map((g) => `
              <li class="goal${g.done ? ' is-done' : ''}" data-id="${g.id}">
                <label class="quest-check">
                  <input type="checkbox" ${g.done ? 'checked' : ''}>
                  <span class="box" aria-hidden="true"><svg><use href="#i-check"/></svg></span>
                  <span class="quest-text">${esc(g.text)}</span>
                </label>
                <button class="del" type="button" aria-label="${esc(t('deleteGoal', { t: g.text }))}"><svg><use href="#i-x"/></svg></button>
              </li>`).join('')}
          </ul>
          <form class="add-goal" autocomplete="off">
            <label class="sr-only" for="goal-${i}">${esc(t('addGoal'))} · ${esc(m)}</label>
            <input id="goal-${i}" maxlength="70" placeholder="${esc(t('goalPh'))}" required>
            <button type="submit" class="icon-btn small solid" aria-label="${esc(t('addGoal'))}"><svg class="ico"><use href="#i-plus"/></svg></button>
          </form>
        </div>
      </li>`;
    }).join('');
  }

  function renderMonthDots() {
    const box = $('#monthDots');
    if (!box) return;
    const cur = new Date().getMonth();
    box.innerHTML = dict().months.map((m, i) => `<button type="button" data-m="${i}" class="${i === cur ? 'is-now' : ''}" aria-label="${esc(m)}" title="${esc(m)}"><span>${esc(m.slice(0, lang() === 'ar' ? 3 : 3))}</span></button>`).join('');
  }

  // ---------------- heat map of the year ----------------
  function renderHeat() {
    const heat = $('#heat');
    const start = new Date(year, 0, 1);
    const days = (new Date(year + 1, 0, 1) - start) / 864e5;
    const lead = start.getDay();     // empty cells before Jan 1 (week starts Sunday)
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    let html = '';
    for (let i = 0; i < lead; i++) html += '<i class="pad"></i>';
    for (let d = 0; d < days; d++) {
      const date = new Date(year, 0, 1 + d);
      const k = Store.dayKey(date);
      const n = S().log[k] || 0;
      const lvl = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
      const future = date > todayD;
      const isToday = +date === +todayD;
      html += `<i class="l${lvl}${future ? ' future' : ''}${isToday ? ' is-today' : ''}" style="--c:${Math.floor((d + lead) / 7)}"></i>`;
    }
    heat.innerHTML = html;
    const months = dict().months;
    $('#heatMonths').innerHTML = months.map((m, i) => {
      const col = Math.floor((new Date(year, i, 1) - start) / 864e5 + lead) / 7;
      return `<span style="--col:${Math.floor(col)}">${esc(m.slice(0, lang() === 'ar' ? 10 : 3))}</span>`;
    }).join('');
  }

  // ---------------- motivation ----------------
  let quoteIndex = new Date().getDate() % 6;
  function renderQuote() {
    const q = dict().quotes[quoteIndex % dict().quotes.length];
    $('#bigQuote').innerHTML = q.split(/\s+/).map((w) => `<span class="w"><span>${esc(w)}</span></span>`).join(' ');
    document.dispatchEvent(new CustomEvent('mq:quote'));
  }

  // ---------------- player UI ----------------
  function setupPlayer() {
    const panel = $('#player');
    const openBtn = $('#nowPlayingBtn');
    const open = (v) => {
      panel.inert = !v;
      openBtn.setAttribute('aria-expanded', String(v));
      if (v) {
        if (location.protocol === 'file:' && S().playlist.some((e) => e.kind === 'youtube')) $('#trackMsg').textContent = t('fileWarn');
        requestAnimationFrame(() => panel.classList.add('open'));
      } else panel.classList.remove('open');
    };
    openBtn.addEventListener('click', () => open(!panel.classList.contains('open')));
    $('#playerClose').addEventListener('click', () => { open(false); openBtn.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) { open(false); openBtn.focus(); } });

    $('#playBtn').addEventListener('click', () => window.Music.toggle());
    $('#themeBtn').addEventListener('click', () => window.Music.playTheme());
    const topBtn = $('#themeTopBtn');
    topBtn.addEventListener('click', () => {
      const on = topBtn.getAttribute('aria-pressed') === 'true';
      if (on) { window.Music.pause(); S().autoMusic = false; }
      else { window.Music.startTheme(); S().autoMusic = true; }
      Store.save();
      window.Sky.audio.ensure();              // thunder becomes audible once sound is allowed
    });
    // Browsers only allow sound after the visitor interacts, so the theme starts on the first
    // click / tap / key press (for a new visitor that is the "Let's begin" button).
    const startAmbience = (e) => {
      window.removeEventListener('pointerdown', startAmbience, true);
      window.removeEventListener('keydown', startAmbience, true);
      window.Sky.audio.ensure();
      if (e && e.target && e.target.closest && e.target.closest('#themeTopBtn, #themeBtn, #playBtn, #player')) return;
      if (S().autoMusic !== false) window.Music.startTheme();
    };
    window.addEventListener('pointerdown', startAmbience, true);
    window.addEventListener('keydown', startAmbience, true);
    $('#nextBtn').addEventListener('click', () => window.Music.next());
    $('#prevBtn').addEventListener('click', () => window.Music.prev());

    $('#addTrack').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = window.Music.add($('#trackUrl').value, $('#trackName').value);
      const msg = $('#trackMsg');
      msg.textContent = r.msg;
      msg.classList.toggle('is-error', !r.ok);
      if (r.ok) { $('#trackUrl').value = ''; $('#trackName').value = ''; }
      else $('#trackUrl').focus();
    });

    $('#tracks').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      if (e.target.closest('.del')) return window.Music.remove(li.dataset.id);
      if (e.target.closest('.track-play')) window.Music.play(Number(li.dataset.i));
    });

    window.Music.init(t, ({ playing, title, items, current, labelFor, isTheme }) => {
      const themeOn = playing && isTheme;
      $('#themeBtn').setAttribute('aria-pressed', String(themeOn));
      $('#themeTopBtn').setAttribute('aria-pressed', String(themeOn));
      $('#themeTopBtn').setAttribute('aria-label', themeOn ? t('pause') + ' · ' + t('themeMusic') : t('themeMusic'));
      $('#themeTopBtn').innerHTML = `<svg class="ico"><use href="#i-${themeOn ? 'pause' : 'play'}"/></svg>`;
      $('#themeBtn').classList.toggle('is-on', themeOn);
      $('#themeBtn .theme-disc').innerHTML = `<svg class="ico"><use href="#i-${themeOn ? 'pause' : 'play'}"/></svg>`;
      document.body.classList.toggle('is-playing', playing);
      $('#playBtn').innerHTML = `<svg class="ico"><use href="#i-${playing ? 'pause' : 'play'}"/></svg>`;
      $('#playBtn').setAttribute('aria-label', t(playing ? 'pause' : 'play'));
      $('#nowTitle').textContent = title;
      $('#npLabel').textContent = playing && title ? title : t('music');
      $('#playerEmpty').hidden = items.length > 0;
      $('#playerStage').classList.toggle('has-embed', items.length > 0);
      ['#playBtn', '#nextBtn', '#prevBtn'].forEach((s) => { $(s).disabled = !items.length; });
      $('#tracks').innerHTML = items.map((it, i) => `
        <li data-id="${it.id}" data-i="${i}" class="${i === current ? 'is-current' : ''}">
          <button type="button" class="track-play" ${i === current ? 'aria-current="true"' : ''}>
            <svg class="ico"><use href="#i-${it.kind === 'youtube' ? 'yt' : 'spotify'}"/></svg>
            <span>${esc(labelFor(it))}</span>
          </button>
          <button type="button" class="del" aria-label="${esc(t('removeTrack', { t: labelFor(it) }))}"><svg><use href="#i-x"/></svg></button>
        </li>`).join('');
    });
  }

  // ---------------- events ----------------
  function bind() {
    $('#langBtn').addEventListener('click', () => switchLang(lang() === 'ar' ? 'en' : 'ar'));
    $$('.seg [data-lang]').forEach((b) => b.addEventListener('click', () => switchLang(b.dataset.lang)));
    $$('.seg [data-motion]').forEach((b) => b.addEventListener('click', () => {
      if (S().motion === b.dataset.motion) return;
      S().motion = b.dataset.motion; Store.save();
      try { sessionStorage.setItem('mq.scroll', String(window.scrollY)); } catch {}
      location.reload();
    }));

    $('#addQuest').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#questInput');
      const text = input.value.trim();
      if (!text) return;
      S().quests.push({ id: Store.uid(), text, xp: Number($('#questXp').value), done: false, date: today });
      Store.save();
      input.value = '';
      renderQuests();
      const last = $('#questList li:last-child');
      if (last && window.gsap && !reduced()) gsap.from(last, { y: 18, opacity: 0, filter: 'blur(6px)', duration: 0.7, ease: 'expo.out' });
    });

    $('#questList').addEventListener('change', (e) => {
      const li = e.target.closest('li[data-id]');
      const q = S().quests.find((x) => x.id === li.dataset.id);
      if (q) complete(q, e.target.checked, li.querySelector('.box'));
    });
    $('#questList').addEventListener('click', (e) => {
      const btn = e.target.closest('.del'); if (!btn) return;
      const li = btn.closest('li');
      const i = S().quests.findIndex((x) => x.id === li.dataset.id);
      if (i < 0) return;
      const q = S().quests[i];
      if (q.done) S().log[q.date] = Math.max(0, (S().log[q.date] || 0) - 1);
      S().quests.splice(i, 1); Store.save();
      renderQuests(); renderStats(true); renderHeat();
      $('#questInput').focus();
    });

    const months = $('#months');
    months.addEventListener('submit', (e) => {
      e.preventDefault();
      const li = e.target.closest('[data-month]');
      const input = e.target.querySelector('input');
      const text = input.value.trim(); if (!text) return;
      const m = Number(li.dataset.month);
      S().goals.push({ id: Store.uid(), text, month: m, done: false, year });
      Store.save(); renderMonths();
      const next = $(`#goal-${m}`); next && next.focus({ preventScroll: true });
    });
    months.addEventListener('change', (e) => {
      const li = e.target.closest('li[data-id]'); if (!li) return;
      const g = S().goals.find((x) => x.id === li.dataset.id); if (!g) return;
      const before = Store.levelInfo().level;
      g.done = e.target.checked;
      S().bonusXp = Math.max(0, S().bonusXp + (g.done ? 100 : -100));
      Store.save();
      const m = g.month;
      renderMonths(); renderStats(true);
      if (g.done) {
        const box = $(`#months li[data-id="${g.id}"] .box`);
        if (box) { const r = box.getBoundingClientRect(); burst(r.left + 10, r.top + 10, 14); }
        toast(t('toastGoal'));
      }
      const after = Store.levelInfo().level;
      if (after > before) setTimeout(() => toast(t('toastLevel', { l: num(after) })), 1400);
      const input = $(`#goal-${m}`); input && input.blur();
    });
    months.addEventListener('click', (e) => {
      const btn = e.target.closest('.del'); if (!btn) return;
      const li = btn.closest('li[data-id]');
      const i = S().goals.findIndex((x) => x.id === li.dataset.id);
      if (i < 0) return;
      if (S().goals[i].done) S().bonusXp = Math.max(0, S().bonusXp - 100);
      S().goals.splice(i, 1); Store.save(); renderMonths(); renderStats(true);
    });

    $('#newQuote').addEventListener('click', () => { quoteIndex++; renderQuote(); });

    const nameInput = $('#nameInput');
    nameInput.value = S().name;
    nameInput.addEventListener('input', () => { S().name = nameInput.value.trim(); Store.save(); renderGreeting(); });

    $('#resetBtn').addEventListener('click', () => {
      if (!confirm(t('resetConfirm'))) return;
      Store.reset();
      location.reload();
    });

    const rainBtn = $('#rainBtn');
    const setRain = (on) => {
      const ok = on ? window.Sky.audio.start() : (window.Sky.audio.stop(), true);
      rainBtn.setAttribute('aria-pressed', String(on && ok));
      S().rain = on && ok; Store.save();
    };
    rainBtn.addEventListener('click', () => setRain(rainBtn.getAttribute('aria-pressed') !== 'true'));
  }

  // ---------------- the cloud deck we fall through ----------------
  // Three depth layers, each pre-composited once into a half-resolution canvas. Scrolling only moves
  // them (transform), so the fall costs the same as moving three pictures.
  function buildFall() {
    const deck = $('.fall-clouds');
    if (!deck || !window.Sky.cloudCanvas) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const light = [0, 1, 2].map(() => window.Sky.cloudCanvas('150,162,162', 900, 420, 44));
    const stormy = window.Sky.cloudCanvas('96,108,108', 900, 420, 40);
    const band = (cls, hVh, n, wMin, wMax, aMin, aMax, stormyShare) => {
      const scale = 0.4;
      const c = document.createElement('canvas');
      const pw = Math.round(window.innerWidth * 1.4 * scale), ph = Math.round(window.innerHeight * hVh / 100 * scale);
      c.width = pw; c.height = ph;
      c.className = 'cloud-band ' + cls;
      c.style.height = hVh + 'vh';
      const g = c.getContext('2d');
      for (let i = 0; i < n; i++) {
        const tw = pw * rnd(wMin, wMax) / 100, th = tw * 420 / 900;
        const x = pw * (((i + 0.5) / n) + rnd(-0.12, 0.12));
        const y = ph * (0.05 + ((i + rnd(0, 1)) / n) * 0.9);
        g.globalAlpha = rnd(aMin, aMax);
        g.drawImage(Math.random() < stormyShare ? stormy : light[i % 3], x - tw / 2, y - th / 2, tw, th);
      }
      return c;
    };
    deck.append(
      band('far', 260, 9, 22, 36, 0.6, 0.8, 0.45),
      band('mid', 300, 7, 34, 52, 0.8, 0.95, 0.2),
      band('near', 340, 5, 55, 85, 0.95, 1, 0));
  }

  // ---------------- first visit: ask the name ----------------
  function setupWelcome() {
    if (S().name) return;
    const layer = $('#welcomeLayer');
    const input = $('#welcomeName');
    document.documentElement.classList.add('needs-name');
    layer.hidden = false;
    // keep the page behind out of the tab order while the question is open
    $$('body > header, body > nav, body > main, body > .skip').forEach((el) => { el.inert = true; });
    setTimeout(() => input.focus(), 400);
    if (window.gsap && !reduced()) {
      gsap.from('.welcome', { y: 60, opacity: 0, scale: 0.94, duration: 1.1, ease: 'expo.out', delay: 0.15 });
      gsap.from('.welcome-face', { scale: 0, rotate: -30, duration: 1, ease: 'back.out(2)', delay: 0.45 });
    }
    $('#welcome').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) {
        $('#welcomeMsg').textContent = t('nameNeeded');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        if (window.gsap && !reduced()) gsap.fromTo('.welcome', { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      S().name = name; Store.save();
      $('#nameInput').value = name;
      renderGreeting();
      const finish = () => {
        layer.hidden = true;
        document.documentElement.classList.remove('needs-name');
        $$('[inert]').forEach((el) => { el.inert = false; });
        document.dispatchEvent(new CustomEvent('mq:welcomed'));
      };
      if (window.gsap && !reduced()) {
        const r = $('.welcome-face').getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 16);
        gsap.to('.welcome', { y: -40, opacity: 0, scale: 0.96, filter: 'blur(8px)', duration: 0.7, ease: 'power2.in' });
        gsap.to(layer, { opacity: 0, duration: 0.9, delay: 0.35, ease: 'power2.out', onComplete: finish });
      } else finish();
    });
    input.addEventListener('input', () => { $('#welcomeMsg').textContent = ''; input.removeAttribute('aria-invalid'); });
  }

  // ---------------- boot ----------------
  applyLang();
  buildWheel();
  buildFall();
  renderGreeting();
  renderQuests();
  renderMonths();
  renderMonthDots();
  renderHeat();
  renderStats(false);
  renderQuote();
  bind();
  setupPlayer();
  setupWelcome();
  window.Sky.calm = reduced();
  document.documentElement.classList.toggle('calm', reduced());

  window.MQ = { reduced, renderMonths, t, flipLabels };
})();
