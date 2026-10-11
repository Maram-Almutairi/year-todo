// The weather: drifting cloud banks, slanted rain that leans with scroll speed,
// rare soft sheet lightning, and an optional synthesized rain sound.
(function () {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  const flash = document.querySelector('.flash');
  let W = 0, H = 0, DPR = 1;

  const opts = {
    intensity: 1,     // 0..1 rain density, eased by scroll position
    wind: 0,          // extra slant from scroll velocity
    calm: false,      // reduced motion
    scroll: 0,        // page scroll for cloud parallax
    fall: 0           // 0..1 while falling through the clouds
  };
  let windNow = 0;

  // ---------- clouds ----------
  function makeCloud(w, h, tone, puffs) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let i = 0; i < puffs; i++) {
      const x = w * (0.12 + Math.random() * 0.76);
      const y = h * (0.35 + Math.random() * 0.35) - Math.sin((x / w) * Math.PI) * h * 0.12;
      const r = h * (0.18 + Math.random() * 0.3);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.05 + Math.random() * 0.08;
      grd.addColorStop(0, `rgba(${tone},${a})`);
      grd.addColorStop(0.55, `rgba(${tone},${a * 0.6})`);
      grd.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // a darker underbelly so banks read as rain clouds, not fog
    const belly = g.createLinearGradient(0, h * 0.45, 0, h);
    belly.addColorStop(0, 'rgba(40,48,50,0)');
    belly.addColorStop(1, 'rgba(40,48,50,0.10)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = belly; g.fillRect(0, 0, w, h);
    return c;
  }

  const layers = [
    { speed: 6,  par: 0.04, y: [0.02, 0.22], scale: 1.25, tone: '178,188,186', count: 4, alpha: 0.75 },
    { speed: 11, par: 0.08, y: [0.08, 0.38], scale: 1,    tone: '150,162,160', count: 5, alpha: 0.85 },
    { speed: 18, par: 0.14, y: [0.0,  0.3],  scale: 0.8,  tone: '92,104,104',  count: 5, alpha: 0.7 }
  ];
  let clouds = [];
  function buildClouds() {
    clouds = [];
    layers.forEach((L, li) => {
      for (let i = 0; i < L.count; i++) {
        const w = Math.round(Math.max(520, W * 0.7) * L.scale);
        const h = Math.round(w * 0.38);
        clouds.push({
          layer: li, img: makeCloud(w, h, L.tone, 26),
          x: Math.random() * (W + w) - w, y: H * (L.y[0] + Math.random() * (L.y[1] - L.y[0])),
          w, h
        });
      }
    });
  }

  // ---------- rain ----------
  let drops = [], splashes = [];
  function buildRain() {
    const n = Math.round((W * H) / 5200);
    drops = Array.from({ length: n }, () => newDrop(true));
  }
  function newDrop(anywhere) {
    const z = Math.random();             // depth: far drops are short, slow, faint
    return {
      x: Math.random() * (W * 1.3) - W * 0.15,
      y: anywhere ? Math.random() * H : -20 - Math.random() * 80,
      len: 8 + z * 20,
      v: 9 + z * 13,
      a: 0.12 + z * 0.32,
      z
    };
  }

  // clouds live on their own half-resolution canvas (they are soft anyway) and redraw every other frame
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.id = 'skyClouds';
  cloudCanvas.setAttribute('aria-hidden', 'true');
  canvas.parentNode.insertBefore(cloudCanvas, canvas);
  const cctx = cloudCanvas.getContext('2d');
  const CS = 0.5;

  function resize() {
    DPR = 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cloudCanvas.width = Math.ceil(W * CS); cloudCanvas.height = Math.ceil(H * CS);
    cctx.setTransform(CS, 0, 0, CS, 0, 0);
    buildClouds(); buildRain();
  }

  let boost = 0;  // lightning brightening
  let last = performance.now();
  let tick = 0, cloudsHidden = false;
  const BUCKETS = 4;
  const paths = Array.from({ length: BUCKETS }, () => []);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);

    // clouds: every other frame, and not at all while falling through the DOM cloud deck
    const tMul = opts.calm ? 0.25 : 1;
    for (const c of clouds) {
      c.x += layers[c.layer].speed * dt * tMul;
      if (c.x > W + 40) { c.x = -c.w - Math.random() * 200; }
    }
    if (opts.fall > 0.25) {
      if (!cloudsHidden) { cctx.clearRect(0, 0, W, H); cloudsHidden = true; }
    } else if ((tick++ & 1) === 0 || cloudsHidden) {
      cloudsHidden = false;
      cctx.clearRect(0, 0, W, H);
      for (const c of clouds) {
        const L = layers[c.layer];
        const y = c.y - Math.min(opts.scroll * L.par, H * 0.8);
        cctx.globalAlpha = Math.min(1, L.alpha + boost * 0.6);
        cctx.drawImage(c.img, c.x, y, c.w, c.h);
      }
      cctx.globalAlpha = 1;
    }

    // rain
    windNow += ((opts.calm ? 0 : opts.wind) - windNow) * 0.06;
    opts.wind *= 0.94;
    // while the visitor falls, the rain is overtaken: streaks race upward, straight and long
    const fall = opts.calm ? 0 : opts.fall;
    const slant = (0.22 + windNow) * (1 - fall);   // horizontal run per unit fall
    const active = Math.round(drops.length * (opts.calm ? 0.25 : Math.max(opts.intensity, fall)));
    const vMul = (opts.calm ? 0.5 : 1) * (1 - fall * 4.2);
    const stretch = 1 + fall * 5;
    ctx.lineCap = 'round';
    for (const b of paths) b.length = 0;
    for (let i = 0; i < active; i++) {
      const d = drops[i];
      const step = d.v * vMul * dt * 60;
      d.y += step; d.x -= step * slant;
      if (step < 0 && d.y < -d.len * stretch - 20) { d.y = H + Math.random() * 80; d.x = Math.random() * W; continue; }
      if (d.y > H + 10 || d.x < -40) {
        if (d.z > 0.7 && !opts.calm && splashes.length < 60) splashes.push({ x: d.x, y: H - Math.random() * H * 0.12, t: 0 });
        drops[i] = newDrop(false);
        continue;
      }
      const len = d.len * stretch;
      paths[Math.min(BUCKETS - 1, (d.z * BUCKETS) | 0)].push(d.x, d.y, d.x + len * slant, step < 0 ? d.y + len : d.y - len);
    }
    // one stroke per depth bucket instead of one per drop
    for (let b = 0; b < BUCKETS; b++) {
      const pts = paths[b]; if (!pts.length) continue;
      const z = (b + 0.5) / BUCKETS;
      ctx.strokeStyle = `rgba(226,232,232,${(0.12 + z * 0.32).toFixed(2)})`;
      ctx.lineWidth = 0.6 + z * 0.9;
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 4) { ctx.moveTo(pts[k], pts[k + 1]); ctx.lineTo(pts[k + 2], pts[k + 3]); }
      ctx.stroke();
    }
    // splashes: tiny flattened rings at ground level
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.t += dt * 3;
      if (s.t >= 1) { splashes.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(230,236,236,${0.35 * (1 - s.t)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 2 + s.t * 7, 0.8 + s.t * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    boost *= 0.92;
    requestAnimationFrame(frame);
  }

  // ---------- lightning ----------
  function lightning() {
    if (!opts.calm && document.visibilityState === 'visible' && opts.intensity > 0.3) {
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      boost = 0.5;
      if (audio.ctx) audio.thunder();
      // sometimes a second, closer strike right after the first
      if (Math.random() < 0.35) setTimeout(() => { flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); boost = 0.7; }, 700 + Math.random() * 600);
    }
    setTimeout(lightning, 6000 + Math.random() * 8000);
  }

  // ---------- rain sound (Web Audio, generated, no files) ----------
  const audio = {
    on: false, ctx: null, master: null, bed: null,
    // builds the graph once (needs a user gesture); the rain bed stays silent until start()
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = 1;
        this.master.connect(c.destination);
        this.bed = c.createGain(); this.bed.gain.value = 0;
        this.bed.connect(this.master);
        const len = c.sampleRate * 3;
        const buf = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = buf.getChannelData(ch);
          let b0 = 0, b1 = 0, b2 = 0;
          for (let i = 0; i < len; i++) {           // pinkish noise
            const w = Math.random() * 2 - 1;
            b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
            data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
          }
        }
        const hiss = c.createBufferSource(); hiss.buffer = buf; hiss.loop = true;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
        const g1 = c.createGain(); g1.gain.value = 0.55;
        hiss.connect(hp).connect(lp).connect(g1).connect(this.bed);
        const rumble = c.createBufferSource(); rumble.buffer = buf; rumble.loop = true; rumble.playbackRate.value = 0.5;
        const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 380;
        const g2 = c.createGain(); g2.gain.value = 0.7;
        rumble.connect(lp2).connect(g2).connect(this.bed);
        hiss.start(); rumble.start(c.currentTime + 0.37);
        this.buf = buf;
        this.drip();
      }
      this.ctx.resume();
      return true;
    },
    start() {
      if (!this.ensure()) return false;
      this.bed.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bed.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.6);
      this.on = true;
      return true;
    },
    stop() {
      if (!this.ctx) return;
      this.bed.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      this.on = false;
    },
    drip() {   // occasional close droplets on leaves
      const c = this.ctx;
      const t = c.currentTime + 0.05;
      const src = c.createBufferSource(); src.buffer = this.buf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2400; bp.Q.value = 8;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; src.connect(bp).connect(g).connect(pan).connect(this.bed); }
      else src.connect(bp).connect(g).connect(this.bed);
      src.start(t, Math.random() * 2, 0.12);
      setTimeout(() => this.drip(), 80 + Math.random() * 520);
    },
    thunder() {
      const c = this.ctx;
      if (!c || c.state !== 'running') return;
      const t = c.currentTime + 0.5 + Math.random() * 1.2;     // sound arrives after the flash
      const vol = 0.55;
      // crack
      const crack = c.createBufferSource(); crack.buffer = this.buf; crack.playbackRate.value = 0.8;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
      const cg = c.createGain(); cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.9 * vol, t + 0.02); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      crack.connect(bp).connect(cg).connect(this.master); crack.start(t, Math.random() * 2, 0.6);
      // rolling rumble
      const roll = c.createBufferSource(); roll.buffer = this.buf; roll.playbackRate.value = 0.22;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
      const rg = c.createGain();
      rg.gain.setValueAtTime(0, t);
      rg.gain.linearRampToValueAtTime(1.8 * vol, t + 0.35);
      rg.gain.linearRampToValueAtTime(1.0 * vol, t + 1.3);
      rg.gain.linearRampToValueAtTime(1.5 * vol, t + 2.0);           // a second swell as it rolls away
      rg.gain.exponentialRampToValueAtTime(0.001, t + 6.5);
      roll.connect(lp).connect(rg).connect(this.master); roll.start(t, Math.random(), 7);
    }
  };

  window.Sky = {
    set intensity(v) { opts.intensity = Math.max(0.15, Math.min(1, v)); },
    set wind(v) { opts.wind = Math.max(-0.12, Math.min(0.5, v)); },
    set calm(v) { opts.calm = !!v; },
    set scroll(v) { opts.scroll = v; },
    set fall(v) { opts.fall = Math.max(0, Math.min(1, v)); },
    // soft cloud textures for DOM layers (fall section, the knight's cloud bank)
    // a fluffy cumulus: a dome of overlapping soft lobes, lit from above, shaded underneath
    cloudTexture(shade, w, h, lobes) { return this.cloudCanvas(shade, w, h, lobes).toDataURL('image/png'); },
    cloudCanvas(shade = '150,162,162', w = 1200, h = 560, lobes = 48) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      const base = h * 0.78;
      for (let i = 0; i < lobes; i++) {
        const t = Math.random();
        const x = w * (0.1 + t * 0.8);
        const dome = Math.sin(t * Math.PI);                       // taller in the middle
        const r = h * (0.12 + Math.random() * 0.14 + dome * 0.12);
        const y = base - r * 0.5 - dome * h * (0.12 + Math.random() * 0.22);
        const grd = g.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.95)');
        grd.addColorStop(0.55, 'rgba(244,246,246,0.8)');
        grd.addColorStop(1, 'rgba(236,240,240,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // underside shading
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, h * 0.25, 0, base);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(1, `rgba(${shade},0.55)`);
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      return c;
    },
    audio
  };

  window.addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 150); });
  resize();
  requestAnimationFrame(frame);
  setTimeout(lightning, 3000);
})();
