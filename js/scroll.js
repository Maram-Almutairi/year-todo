// Scroll choreography. One authored moment per section:
// intro wheel turns and opens on the kitten → quest log unfolds → months process sideways
// → the year's days bloom in a wave → the quote rises word by word → the storm eases at the close.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rtl = document.documentElement.dir === 'rtl';
  const calm = window.MQ.reduced();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const restore = () => {
    let y = null;
    try { y = sessionStorage.getItem('mq.scroll'); sessionStorage.removeItem('mq.scroll'); } catch {}
    if (y !== null) window.scrollTo(0, Number(y));
  };

  if (!window.gsap || !window.ScrollTrigger) {
    // libraries failed to load (offline): page stays fully readable, no choreography
    document.documentElement.classList.add('calm', 'no-gsap');
    document.body.classList.add('past-intro');
    restore();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Native scrolling: the browser scrolls on its own thread, so a busy frame never freezes the page.
  // (Smooth-scroll libraries tie every scroll step to JavaScript and stutter under load.)
  const lenis = null;
  ScrollTrigger.config({ ignoreMobileResize: true });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
    const focusable = target.querySelector('h1, h2');
    if (focusable) { focusable.setAttribute('tabindex', '-1'); focusable.focus({ preventScroll: true }); }
  });

  // ---------- weather follows the scroll ----------
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      window.Sky.wind = self.getVelocity() / 7000;
      window.Sky.intensity = 1 - self.progress * 0.75;     // the storm eases as you go
      window.Sky.scroll = window.scrollY;
    }
  });

  // Created after the pinned sections so their positions include pin spacing.
  function navTriggers() {
    // rail + topbar appear once the wheel has done its work
    ScrollTrigger.create({
      trigger: '#home', start: 'top 70%',
      onEnter: () => document.body.classList.add('past-intro'),
      onLeaveBack: () => document.body.classList.remove('past-intro')
    });
    // active rail link
    ['home', 'goals', 'progress', 'motivation', 'settings'].forEach((id) => {
      ScrollTrigger.create({
        trigger: '#' + id, start: 'top 55%', end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          $$('.rail a').forEach((a) => a.removeAttribute('aria-current'));
          const a = $(`.rail a[data-nav="${id}"]`); a && a.setAttribute('aria-current', 'true');
        }
      });
    });
  }

  if (calm) {
    navTriggers();
    document.body.classList.add('past-intro');
    restore();
    return;
  }

  // ================= 1. The year wheel =================
  const month = new Date().getMonth();
  const finalRot = -(360 + month * 30);               // lands this month under the notch
  const petals = $$('.petals svg');
  const petalPaths = petals.map((p, i) => {
    const a = (i / petals.length) * Math.PI * 2 + 0.4;
    return { x: Math.cos(a) * (55 + (i % 3) * 14), y: Math.sin(a) * (45 + (i % 2) * 18), r: 160 + i * 47 };
  });

  const intro = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#intro', start: 'top top', end: '+=260%', pin: true, scrub: 1.1 },
    onUpdate: () => window.MQ.flipLabels(Number(gsap.getProperty('.wheel-outer', 'rotate')) || 0)
  });
  intro
    .to('.scroll-cue', { opacity: 0, y: 24, duration: 0.08 }, 0)
    .to('.intro-title', { yPercent: -70, opacity: 0, scale: 0.88, filter: 'blur(14px)', duration: 0.4, ease: 'power2.in' }, 0.04)
    .fromTo('.wheel', { scale: 0.84 }, { scale: 1.06, duration: 1, ease: 'power1.inOut' }, 0)
    .fromTo('.wheel-outer', { rotate: 0 }, { rotate: finalRot, duration: 1, ease: 'power3.inOut' }, 0)
    .fromTo('.wheel-inner', { rotate: 0 }, { rotate: 220, duration: 1, ease: 'power2.inOut' }, 0)
    .fromTo('.iris', { clipPath: 'circle(14% at 50% 50%)' }, { clipPath: 'circle(50% at 50% 50%)', duration: 0.75, ease: 'expo.inOut' }, 0.22)
    .fromTo('.iris img',
      { scale: 1.7, rotate: -50, filter: 'blur(18px) brightness(0.35) saturate(0.5)' },
      { scale: 1, rotate: 0, filter: 'blur(0px) brightness(1) saturate(1)', duration: 0.8, ease: 'power2.out' }, 0.16)
    .fromTo('.wheel-glow', { opacity: 0.25, scale: 0.6 }, { opacity: 1, scale: 1.15, duration: 0.7 }, 0.25)
    .to(`.month-label[data-m="${month}"]`, { attr: { class: 'month-label is-now' }, duration: 0.01 }, 0.93)
    .fromTo('.wheel-notch', { scaleY: 0 }, { scaleY: 1, duration: 0.1, ease: 'back.out(3)' }, 0.9)
    .fromTo('.intro-caption', { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.18, ease: 'power2.out' }, 0.86);
  petals.forEach((p, i) => {
    const d = petalPaths[i];
    intro.fromTo(p,
      { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0, rotate: 0, opacity: 0 },
      { x: () => (d.x / 100) * window.innerWidth, y: () => (d.y / 100) * window.innerHeight, scale: 1 + (i % 3) * 0.35, rotate: d.r, opacity: 1, duration: 0.7, ease: 'power2.out' },
      0.3 + i * 0.02)
      .to(p, { opacity: 0, duration: 0.15 }, 0.96);
  });
  intro.to({}, { duration: 0.12 });       // a breath on the revealed kitten before release

  // ================= 1½. The drop through the cloud deck =================
  // Right after the wheel: three cloud layers rush upward past the visitor (near = fastest),
  // the frame tilts a little, a thin mist passes, the rain streaks upward, and we land in today.
  const fallTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#fall', start: 'top top', end: '+=130%', pin: true, scrub: 0.6,
      onUpdate: (self) => { window.Sky.fall = Math.sin(Math.PI * Math.min(1, self.progress * 1.08)); },
      onLeave: () => { window.Sky.fall = 0; },
      onLeaveBack: () => { window.Sky.fall = 0; },
      onToggle: (self) => $('.fall-clouds').classList.toggle('is-on', self.isActive)
    }
  });
  [['far', 6], ['mid', -8], ['near', 12]].forEach(([d, drift]) => {
    fallTl.fromTo(`.fall-clouds .${d}`,
      { yPercent: 0, y: () => window.innerHeight * 1.05, x: 0 },
      { yPercent: -100, y: () => -window.innerHeight * 0.05, x: () => window.innerWidth * drift / 100, duration: 1 }, 0);
  });
  fallTl
    .fromTo('.fall-stage', { rotate: rtl ? 2 : -2 }, { rotate: rtl ? -1 : 1, duration: 1, ease: 'sine.inOut' }, 0)
    .fromTo('.fall-line', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.14, ease: 'power2.out' }, 0.1)
    .to('.fall-line', { opacity: 0, y: -70, duration: 0.14, ease: 'power2.in' }, 0.38)
    .fromTo('.fall-mist', { opacity: 0 }, { opacity: 0.5, duration: 0.16, ease: 'power1.in' }, 0.44)
    .to('.fall-mist', { opacity: 0, duration: 0.24, ease: 'power2.out' }, 0.6);

  // ================= The blossom's fall =================
  // A blossom slips out of the wheel's eye, tumbles down in front of the visitor through the clouds
  // (spinning, swaying, turning edge-on like a real falling flower, three loose petals trailing), and
  // settles onto the flower on the knight's head in today. Positions are read live; scrolling back reverses it.
  const flower = $('#flyFlower');
  const loosePetals = $$('.fly-petals svg');
  const iris = $('.iris');
  const landing = $('.standing img');
  const BASE = 320;                                       // drawn size; only ever scaled down, so it stays crisp
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let flyingOn = false;
  const place = (el, cx, cy, size, rot, flip, op, base) => {
    const sc = size / base;
    el.style.transform = `translate3d(${(cx - base / 2).toFixed(1)}px, ${(cy - base / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${(sc * flip).toFixed(4)}, ${sc.toFixed(4)})`;
    el.style.opacity = op.toFixed(3);
  };
  function placeFlower(p) {
    const on = p > 0 && p < 1;
    if (on !== flyingOn) { flyingOn = on; document.body.classList.toggle('fly-on', on); }
    if (!on) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const ir = iris.getBoundingClientRect();
    const lr = landing.getBoundingClientRect();
    const A = { x: ir.left + ir.width / 2, y: ir.top + ir.height / 2, s: Math.max(30, ir.width * 0.18) };
    const B = { x: vw / 2, y: vh * 0.42, s: Math.min(vw, vh) * 0.42 };
    // the blossom on the knight's head sits ~66% across, ~16% down the standing image
    const C = { x: lr.left + lr.width * 0.66, y: lr.top + lr.height * 0.165, s: lr.width * 0.16 };
    const swayEnd = Math.sin(Math.PI * 2.2) * vw * 0.16;
    const flipEnd = 0.35 + 0.65 * Math.abs(Math.cos(Math.PI * 2.5));
    let x, y, size, rot, flip = 1, op = 1;
    if (p < 0.14) {                                       // slips out of the wheel's eye and grows toward you
      const t = ease(p / 0.14);
      x = lerp(A.x, B.x, t); y = lerp(A.y, B.y, t); size = lerp(A.s, B.s, t); rot = t * 140; op = Math.min(1, p / 0.04);
    } else if (p < 0.74) {                                // the tumble
      const t = (p - 0.14) / 0.6;
      x = B.x + Math.sin(t * Math.PI * 2.2) * vw * 0.16;
      y = B.y + Math.sin(t * Math.PI * 4) * vh * 0.04;
      size = B.s * (0.94 + 0.06 * Math.sin(t * Math.PI * 3));
      rot = 140 + t * 540 + Math.sin(t * Math.PI * 5) * 18;
      flip = 0.35 + 0.65 * Math.abs(Math.cos(t * Math.PI * 2.5));   // turns edge-on and back as it falls
    } else {                                              // settles onto the knight's head
      const t = ease((p - 0.74) / 0.26);
      x = lerp(B.x + swayEnd, C.x, t); y = lerp(B.y, C.y, t); size = lerp(B.s, C.s, t);
      rot = lerp(680, 740, t); flip = lerp(flipEnd, 1, t);
      op = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
    }
    place(flower, x, y, size, rot, flip, op, BASE);
    // loose petals trail above it, each on its own lag and sway; they drift away before the landing
    loosePetals.forEach((el, i) => {
      const q = Math.max(0, p - (0.06 + i * 0.05));
      const px = x + Math.sin(q * 9 + i * 2.1) * vw * (0.1 + i * 0.05) + (i - 1) * vw * 0.12;
      const py = y - vh * (0.2 + i * 0.12) + Math.min(1, q / 0.7) * vh * 0.1;
      const pOp = p < 0.06 ? p / 0.06 : p > 0.7 ? Math.max(0, 1 - (p - 0.7) / 0.12) : 1;
      place(el, px, py, 64 * (0.7 + i * 0.25), q * (600 + i * 200), 0.4 + 0.6 * Math.abs(Math.cos(q * 12 + i)), pOp * 0.95, 64);
    });
  }
  ScrollTrigger.create({
    trigger: '#fall', start: 'top top', endTrigger: '#home', end: 'top 12%',
    onUpdate: (self) => placeFlower(self.progress),
    onLeave: () => placeFlower(1),
    onLeaveBack: () => placeFlower(0)
  });

  // ================= 2. Today =================
  gsap.fromTo('.greeting', { clipPath: 'inset(0 0 100% 0)', y: 50 }, {
    clipPath: 'inset(0 0 0% 0)', y: 0, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '#home', start: 'top 75%' }
  });
  gsap.from('.tagline, .date-pill', {
    opacity: 0, y: 24, duration: 1, stagger: 0.12, ease: 'expo.out', delay: 0.25,
    scrollTrigger: { trigger: '#home', start: 'top 75%' }
  });
  const questTl = gsap.timeline({ scrollTrigger: { trigger: '.quests', start: 'top 82%' } });
  questTl
    .fromTo('.quests', { clipPath: 'inset(0% 0% 100% 0% round 28px)', rotateX: 14, y: 60 },
      { clipPath: 'inset(0% 0% 0% 0% round 28px)', rotateX: 0, y: 0, duration: 1.3, ease: 'expo.out' })
    .from('.quests .quest, .quests .bar, .add-quest', { y: 22, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.25);
  // the knight steps up out of the grass, full height, and holds the ground
  const stand = gsap.timeline({ scrollTrigger: { trigger: '.standing', start: 'top 85%' } });
  stand
    .fromTo('.standing img', { y: 140, scale: 0.88, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 1.5, ease: 'expo.out' })
    .fromTo('.standing-halo', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6, ease: 'expo.out' }, 0.2);
  gsap.from('.note-card', {
    rotate: rtl ? 10 : -10, y: 80, opacity: 0, duration: 1.4, ease: 'elastic.out(1, 0.7)',
    scrollTrigger: { trigger: '.note-card', start: 'top 88%' }
  });
  gsap.from('.stat', {
    y: 70, rotateX: -50, opacity: 0, transformOrigin: '50% 100%', duration: 1.1, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.stats', start: 'top 92%' }
  });

  // ================= 3. Months procession =================
  const track = $('#months');
  const viewport = $('.months-viewport');
  const dist = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  function tilt() {
    const vw = window.innerWidth, c = vw / 2;
    $$('.month', track).forEach((m) => {
      const r = m.getBoundingClientRect();
      const d = Math.max(-1.4, Math.min(1.4, (r.left + r.width / 2 - c) / (vw * 0.6)));
      const inner = m.firstElementChild;
      inner.style.transform = `perspective(1100px) rotateY(${(-d * 16).toFixed(2)}deg) translateY(${(Math.abs(d) * 26).toFixed(1)}px) scale(${(1 - Math.abs(d) * 0.07).toFixed(3)})`;
      inner.style.opacity = (1 - Math.min(1, Math.abs(d)) * 0.35).toFixed(3);
    });
  }
  const monthsTween = gsap.to(track, {
    x: () => (rtl ? 1 : -1) * dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '#goals', start: 'top top', end: () => '+=' + dist() * 1.1,
      pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: tilt, onRefresh: tilt
    }
  });
  new MutationObserver(tilt).observe(track, { childList: true });

  // Month browsing: dots + previous/next jump the pinned scroll to a month (or scroll the strip in calm mode)
  const monthsST = monthsTween.scrollTrigger;
  const dots = () => $$('#monthDots button');
  let currentMonthIdx = -1;
  function setActiveMonth(i) {
    if (i === currentMonthIdx) return;
    currentMonthIdx = i;
    dots().forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
  }
  const monthAt = () => Math.round(monthsST.progress * 11);
  ScrollTrigger.create({ trigger: '#goals', start: 'top top', end: () => '+=' + dist() * 1.1, onUpdate: () => setActiveMonth(monthAt()), onRefresh: () => setActiveMonth(monthAt()) });
  setActiveMonth(0);
  function goToMonth(i) {
    i = Math.max(0, Math.min(11, i));
    const y = monthsST.start + (monthsST.end - monthsST.start) * (i / 11) + 2;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  $('#monthDots').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) goToMonth(Number(b.dataset.m)); });
  $('#monthPrev').addEventListener('click', () => goToMonth(Math.max(0, monthAt() - 1)));
  $('#monthNext').addEventListener('click', () => goToMonth(Math.min(11, monthAt() + 1)));
  gsap.from('#goals .section-head > *', {
    y: 50, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '#goals', start: 'top 70%' }
  });

  // ================= 4. Year heat map =================
  ScrollTrigger.create({
    trigger: '.heat', start: 'top 80%', once: true,
    onEnter: () => {
      const cells = $$('#heat i:not(.pad)');
      const maxCol = 53;
      gsap.fromTo(cells, { scale: 0, opacity: 0, rotate: -45 }, {
        scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.2)',
        delay: (i, el) => Number(getComputedStyle(el).getPropertyValue('--c')) / maxCol * 1.4 + (i % 7) * 0.02,
        clearProps: 'transform,opacity'
      });
    }
  });
  gsap.from('.ledger > *', {
    x: rtl ? 60 : -60, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.ledger', start: 'top 80%' }
  });
  gsap.from('#progress .section-head > *', {
    y: 50, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '#progress', start: 'top 70%' }
  });

  // ================= 5. Quote, word by word =================
  let quoteTween = null;
  function quoteScrub() {
    if (quoteTween) { quoteTween.scrollTrigger && quoteTween.scrollTrigger.kill(); quoteTween.kill(); }
    quoteTween = gsap.fromTo('.big-quote .w > span',
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.12, ease: 'power2.out',
        scrollTrigger: { trigger: '#motivation', start: 'top 72%', end: 'center 50%', scrub: 1 } });
  }
  quoteScrub();
  document.addEventListener('mq:quote', () => {
    if (quoteTween) { quoteTween.scrollTrigger && quoteTween.scrollTrigger.kill(); quoteTween.kill(); quoteTween = null; }
    gsap.fromTo('.big-quote .w > span', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.8, ease: 'expo.out' });
  });
  gsap.from('.quote-hand, #newQuote', {
    opacity: 0, y: 20, duration: 1, stagger: 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '.quote-hand', start: 'top 90%' }
  });

  // ================= 6. Settings + close =================
  gsap.from('.settings-card', {
    y: 80, opacity: 0, scale: 0.96, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.settings-card', start: 'top 88%' }
  });
  gsap.from('.sleepy', {
    y: 60, opacity: 0, rotate: rtl ? 6 : -6, duration: 1.5, ease: 'elastic.out(1, 0.6)',
    scrollTrigger: { trigger: '.closing', start: 'top 85%' }
  });

  // ================= Section hand-offs in 3D =================
  // Each section swings in from one side as it arrives and swings out to the other only once it has
  // been scrolled past; sides alternate down the page. Created after every pin, so the positions
  // account for pinned scroll. Transform + opacity only.
  const sections = [
    { el: '#home', enter: '#home', exit: '#home' },
    { el: '.year-pin', enter: '#goals', exit: '#progress', exitStart: 'top 95%', exitEnd: 'top 35%' },
    { el: '#progress', enter: '#progress', exit: '#progress' },
    { el: '#motivation', enter: '#motivation', exit: '#motivation' },
    { el: '#settings', enter: '#settings', exit: '#settings' },
    { el: '.closing', enter: '.closing' }
  ];
  sections.forEach((c, i) => {
    const side = i % 2 === 0 ? 1 : -1;            // +1: comes in from the left, leaves to the right
    gsap.fromTo(c.el,
      { xPercent: -30 * side, rotateY: 26 * side, z: -200, opacity: 0, transformPerspective: 1400, transformOrigin: side > 0 ? '0% 50%' : '100% 50%' },
      { xPercent: 0, rotateY: 0, z: 0, opacity: 1, ease: 'power2.out',
        scrollTrigger: { trigger: c.enter, start: 'top bottom', end: 'top 35%', scrub: 0.8 } });
    if (!c.exit) return;
    gsap.to(c.el, {
      xPercent: 30 * side, rotateY: -26 * side, z: -200, opacity: 0, ease: 'power1.in', immediateRender: false,
      scrollTrigger: { trigger: c.exit, start: c.exitStart || 'bottom 40%', end: c.exitEnd || 'bottom top', scrub: 0.8 }
    });
  });

  navTriggers();

  window.addEventListener('load', () => {
    ScrollTrigger.refresh(); restore();
    // review captures: ?at=<section id>&dy=<px> jumps straight to a scroll position
    const q = new URLSearchParams(location.search);
    if (q.has('at')) {
      const el = document.getElementById(q.get('at'));
      const y = (el ? el.getBoundingClientRect().top + window.scrollY : 0) + Number(q.get('dy') || 0);
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      ScrollTrigger.update();
    }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
