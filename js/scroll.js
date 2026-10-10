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

  // ================= Section hand-offs in 3D =================
  // As each section arrives, the one before swings away to one side in depth while the new one
  // swings in from the other; the sides alternate down the page. Transform + opacity only.
  const chain = [
    ['.intro-stage', '#home'],
    ['#home', '.year-pin'],
    ['.year-pin', '#progress'],
    ['#progress', '#motivation'],
    ['#motivation', '#settings'],
    ['#settings', '.closing']
  ];
  const triggerOf = (sel) => (sel === '.year-pin' ? '#goals' : sel === '.intro-stage' ? '#intro' : sel);
  chain.forEach(([prev, next], i) => {
    const side = i % 2 === 0 ? 1 : -1;              // +1: previous leaves to the right, next comes from the left
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: triggerOf(next), start: 'top bottom', end: 'top 20%', scrub: 0.8 }
    });
    tl.fromTo(prev,
      { xPercent: 0, rotateY: 0, z: 0, opacity: 1, transformPerspective: 1400, transformOrigin: side > 0 ? '100% 50%' : '0% 50%' },
      { xPercent: 38 * side, rotateY: -32 * side, z: -260, opacity: 0, duration: 1 }, 0)
      .fromTo(next,
        { xPercent: -38 * side, rotateY: 32 * side, z: -260, opacity: 0, transformPerspective: 1400, transformOrigin: side > 0 ? '0% 50%' : '100% 50%' },
        { xPercent: 0, rotateY: 0, z: 0, opacity: 1, duration: 1, ease: 'power2.out' }, 0);
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
    .fromTo('.standing img', { y: 160, scale: 0.86, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 1.5, ease: 'expo.out' })
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
  gsap.to(track, {
    x: () => (rtl ? 1 : -1) * dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '#goals', start: 'top top', end: () => '+=' + dist() * 1.1,
      pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: tilt, onRefresh: tilt
    }
  });
  new MutationObserver(tilt).observe(track, { childList: true });
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
