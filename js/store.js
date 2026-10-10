// Local persistence. Everything lives in this browser's localStorage.
(function () {
  const KEY = 'year-todo.v2';

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }

  function seed(lang) {
    const t = window.I18N[lang];
    const today = dayKey();
    const xps = [20, 20, 50, 20, 10];
    return {
      v: 2,
      lang,
      motion: 'full',
      name: '',         // asked on first visit
      quests: t.seedQuests.map((text, i) => ({ id: uid(), text, xp: xps[i], done: false, date: today })),
      goals: t.seedGoals.map(([month, text]) => ({ id: uid(), text, month, done: false, year: new Date().getFullYear() })),
      log: {},          // 'YYYY-MM-DD' -> completions that day
      bonusXp: 0,       // XP from goals
      playlist: [],
      current: 0,
      rain: false
    };
  }

  let state = read();
  if (!state || state.v !== 2) state = seed('ar');

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep working in memory */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    state = seed(state.lang);   // name is cleared too, so the welcome question returns
    save();
  }

  // Derived numbers
  function xpTotal() {
    return state.quests.reduce((s, q) => s + (q.done ? q.xp : 0), 0) + state.bonusXp;
  }
  const XP_PER_LEVEL = 200;
  function levelInfo() {
    const xp = xpTotal();
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const into = xp % XP_PER_LEVEL;
    return { xp, level, into, need: XP_PER_LEVEL - into, pct: into / XP_PER_LEVEL };
  }
  function streaks() {
    const has = (d) => (state.log[dayKey(d)] || 0) > 0;
    const d = new Date();
    let current = 0;
    if (!has(d)) d.setDate(d.getDate() - 1);   // today not done yet still keeps yesterday's streak alive
    while (has(d)) { current++; d.setDate(d.getDate() - 1); }
    const keys = Object.keys(state.log).filter((k) => state.log[k] > 0).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const cur = new Date(k + 'T00:00:00');
      run = prev && (cur - prev) / 864e5 === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = cur;
    }
    return { current, best: Math.max(best, current) };
  }

  window.Store = {
    get state() { return state; },
    save, reset, uid, dayKey, xpTotal, levelInfo, streaks, XP_PER_LEVEL
  };
})();
