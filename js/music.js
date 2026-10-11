// Playlist player for YouTube and Spotify links.
// Uses each service's official iframe API so our own play / next / previous buttons drive them.
(function () {
  const $ = (s) => document.querySelector(s);

  function parseLink(raw) {
    const s = (raw || '').trim();
    if (!s) return null;
    const sp = s.match(/^spotify:(track|playlist|album|episode|show|artist):([A-Za-z0-9]+)/);
    if (sp) return { kind: 'spotify', type: sp[1], id: sp[2] };
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|playlist|album|episode|show|artist)\/([A-Za-z0-9]+)/);
      return m ? { kind: 'spotify', type: m[1], id: m[2] } : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
      let videoId = null;
      const listId = u.searchParams.get('list');
      if (host === 'youtu.be') videoId = u.pathname.slice(1).split('/')[0];
      else if (u.searchParams.get('v')) videoId = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
        if (m) videoId = m[1];
      }
      if (videoId && !/^[\w-]{6,}$/.test(videoId)) videoId = null;
      if (!videoId && !listId) return null;
      return { kind: 'youtube', videoId, listId };
    }
    return null;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.async = true; el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });
  }
  let ytReady, spReady;
  function youtubeApi() {
    if (!ytReady) ytReady = new Promise((res) => {
      if (window.YT && window.YT.Player) return res(window.YT);
      window.onYouTubeIframeAPIReady = () => res(window.YT);
      loadScript('https://www.youtube.com/iframe_api');
    });
    return ytReady;
  }
  function spotifyApi() {
    if (!spReady) spReady = new Promise((res) => {
      window.onSpotifyIframeApiReady = (api) => res(api);
      loadScript('https://open.spotify.com/embed/iframe-api/v1');
    });
    return spReady;
  }

  async function fetchTitle(entry) {
    const target = entry.kind === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(entry.url)}`
      : `https://open.spotify.com/oembed?url=${encodeURIComponent(entry.url)}`;
    try {
      const r = await fetch(target);
      if (!r.ok) return null;
      const j = await r.json();
      return j.title || null;
    } catch { return null; }
  }

  // The site's theme: the clip this whole idea started from.
  const THEME = { id: 'theme', theme: true, url: 'https://youtu.be/wz1NXlGvTEA', kind: 'youtube', videoId: 'wz1NXlGvTEA', listId: null, title: null };

  // ---------------- player state ----------------
  let t = () => '';
  let player = null;      // { kind, api }
  let playing = false;
  let loadedId = null;
  let onChange = () => {};

  const S = () => window.Store.state;
  const list = () => S().playlist;

  function labelFor(e) {
    if (e.title) return e.title;
    if (e.kind === 'youtube') return e.listId ? t('ytPlaylist') : t('ytVideo');
    return { playlist: t('spPlaylist'), track: t('spTrack'), album: t('spAlbum') }[e.type] || t('spOther');
  }

  function destroy() {
    try {
      if (player && player.kind === 'youtube') player.api.destroy();
      if (player && player.kind === 'spotify') player.api.destroy();
    } catch {}
    player = null; playing = false; loadedId = null;
    $('#embedHost').innerHTML = '';
  }

  async function load(index, autoplay = true) {
    const items = list();
    if (!items.length) { destroy(); emit(); return; }
    const i = ((index % items.length) + items.length) % items.length;
    S().current = i; window.Store.save();
    const e = items[i];
    destroy();
    loadedId = e.id;
    const host = $('#embedHost');
    const mount = document.createElement('div');
    host.appendChild(mount);
    host.dataset.kind = e.kind;
    host.dataset.type = e.type || '';
    emit();

    if (e.kind === 'youtube') {
      const YT = await youtubeApi();
      if (loadedId !== e.id) return;
      const vars = { autoplay: autoplay ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1 };
      if (location.protocol.startsWith('http')) vars.origin = location.origin;
      if (e.listId) { vars.listType = 'playlist'; vars.list = e.listId; }
      const api = new YT.Player(mount, {
        width: '100%', height: '100%',
        videoId: e.videoId || undefined,
        playerVars: vars,
        events: {
          onReady: (ev) => { if (autoplay) ev.target.playVideo(); },
          onStateChange: (ev) => {
            playing = ev.data === 1;
            if (ev.data === 1) {
              const d = ev.target.getVideoData && ev.target.getVideoData();
              if (d && d.title) { player.nowTitle = d.title; }
            }
            if (ev.data === 0) {
              const pl = ev.target.getPlaylist && ev.target.getPlaylist();
              const atEnd = !pl || ev.target.getPlaylistIndex() >= pl.length - 1;
              if (atEnd) return next();
            }
            emit();
          }
        }
      });
      player = { kind: 'youtube', api };
    } else {
      const IFrameAPI = await spotifyApi();
      if (loadedId !== e.id) return;
      const height = e.type === 'track' || e.type === 'episode' ? 152 : 232;
      IFrameAPI.createController(mount, { uri: `spotify:${e.type}:${e.id}`, width: '100%', height }, (ctrl) => {
        if (loadedId !== e.id) { ctrl.destroy(); return; }
        player = { kind: 'spotify', api: ctrl };
        ctrl.addListener('ready', () => { if (autoplay) ctrl.play(); });
        ctrl.addListener('playback_update', (ev) => {
          const d = ev.data || {};
          playing = !d.isPaused;
          if ((e.type === 'track' || e.type === 'episode') && d.duration > 0 && d.position >= d.duration - 400 && !d.isBuffering) {
            next(); return;
          }
          emit();
        });
      });
    }
  }

  function toggle() {
    if (!list().length) return;
    if (!player || loadedId !== (list()[S().current] || {}).id) return load(S().current || 0, true);
    if (player.kind === 'youtube') {
      const st = player.api.getPlayerState ? player.api.getPlayerState() : -1;
      st === 1 ? player.api.pauseVideo() : player.api.playVideo();
    } else {
      player.api.togglePlay();
    }
  }
  function next() { if (list().length) load(S().current + 1, true); }
  function prev() {
    if (!list().length) return;
    if (player && player.kind === 'youtube' && list()[S().current].listId && player.api.previousVideo) {
      if (player.api.getPlaylistIndex() > 0) return player.api.previousVideo();
    }
    load(S().current - 1, true);
  }

  function add(url, name) {
    const p = parseLink(url);
    if (!url.trim()) return { ok: false, msg: t('noLink') };
    if (!p) return { ok: false, msg: t('badLink') };
    const entry = { id: window.Store.uid(), url: url.trim(), title: (name || '').trim() || null, ...p };
    list().push(entry);
    window.Store.save();
    if (!entry.title) fetchTitle(entry).then((title) => {
      if (title && !entry.title) { entry.title = title; window.Store.save(); emit(); }
    });

    emit();
    return { ok: true, msg: t('added') + (p.kind === 'spotify' ? ' ' + t('spotifyNote') : '') };
  }

  function remove(id) {
    const items = list();
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    const wasLoaded = loadedId === id;
    items.splice(i, 1);
    if (S().current >= items.length) S().current = Math.max(0, items.length - 1);
    else if (i < S().current) S().current--;
    window.Store.save();
    if (wasLoaded) destroy();
    emit();
  }

  function emit() {
    const items = list();
    const cur = items[S().current];
    const title = cur ? (player && player.nowTitle) || labelFor(cur) : '';
    onChange({ playing, title, items, current: S().current, labelFor, isTheme: !!(cur && cur.theme) });
  }

  window.Music = {
    init(translate, cb) {
      t = translate; onChange = cb;
      if (!S().themeSeeded) {
        if (!list().some((e) => e.theme)) list().unshift({ ...THEME });
        S().themeSeeded = true; window.Store.save();
      }
      const th = list().find((e) => e.theme);
      if (th && th.videoId !== THEME.videoId) { Object.assign(th, THEME); window.Store.save(); }   // theme track was changed
      if (th && !th.title) fetchTitle(th).then((title) => { if (title) { th.title = title; window.Store.save(); emit(); } });
      emit();   // the player iframe is created only when play is pressed
    },
    startTheme() {
      const cur = list()[S().current];
      if (playing && cur && cur.theme) return;
      const i = list().findIndex((e) => e.theme);
      if (i >= 0 && i === S().current && player && loadedId === list()[i].id) { toggle(); return; }
      this.playTheme();
    },
    pause() {
      if (!player || !playing) return;
      if (player.kind === 'youtube') player.api.pauseVideo(); else player.api.pause();
    },
    playTheme() {
      let i = list().findIndex((e) => e.theme);
      if (i < 0) { list().unshift({ ...THEME }); i = 0; S().current = Math.min(list().length - 1, S().current + 1); window.Store.save(); }
      if (i === S().current && player && loadedId === list()[i].id) toggle(); else load(i, true);
    },
    add, remove, toggle, next, prev, play: (i) => load(i, true), parseLink,
    get playing() { return playing; },
    refresh: emit
  };
})();
