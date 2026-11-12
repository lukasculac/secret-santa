/* Secret Santa — client. No dependencies, no build step. */
(() => {
  'use strict';

  const DRAW = window.SANTA_DRAW;
  const STORE_KEY = 'secret-santa:picked';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const screens = {
    pick:   $('screen-pick'),
    box:    $('screen-box'),
    reveal: $('screen-reveal'),
    error:  $('screen-error'),
  };

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.classList.toggle('is-active', key === name);
  }

  function fail(msg) {
    $('error-msg').textContent = msg;
    show('error');
  }

  // ------------------------------------------------------------- crypto
  // Must stay byte-for-byte in step with generate.mjs.

  const normalize = (s) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function personId(name) {
    const data = new TextEncoder().encode(`${DRAW.pepper}:${normalize(name)}`);
    return hex(await crypto.subtle.digest('SHA-256', data)).slice(0, 32);
  }

  async function revealFor(name) {
    const entry = DRAW.gifts[await personId(name)];
    if (!entry) throw new Error('no-entry');

    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(`${DRAW.pepper}:${normalize(name)}`),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(entry.s), iterations: DRAW.iter, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(entry.n) },
      key,
      fromB64(entry.c),
    );
    return new TextDecoder().decode(plain);
  }

  // ------------------------------------------------------------- snowfall
  function startSnow() {
    const canvas = $('snow');
    const ctx = canvas.getContext('2d');
    let flakes = [];
    let w = 0, h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale flake count to screen area so phones stay smooth.
      const target = Math.round(Math.min(170, Math.max(45, (w * h) / 11000)));
      flakes = Array.from({ length: target }, () => spawn(true));
    }

    const spawn = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -12,
      r: Math.random() * 1.6 + 0.6,
      vy: Math.random() * 0.5 + 0.22,
      drift: Math.random() * 0.5 - 0.25,
      phase: Math.random() * Math.PI * 2,
      sway: Math.random() * 0.012 + 0.004,
      alpha: Math.random() * 0.5 + 0.45,
    });

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.phase += f.sway;
        f.y += f.vy * f.r;
        f.x += f.drift + Math.sin(f.phase) * 0.5;

        if (f.y - f.r > h) flakes[i] = spawn(false);
        else if (f.x < -16) f.x = w + 16;
        else if (f.x > w + 16) f.x = -16;

        ctx.globalAlpha = f.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduced) {
      // Draw one static field, no motion.
      ctx.fillStyle = '#ffffff';
      for (const f of flakes) {
        ctx.globalAlpha = f.alpha * 0.7;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------- confetti
  function burstConfetti() {
    if (reduced) return;

    const canvas = $('confetti');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Erupt from the present, wherever it happens to sit on screen.
    const giftRect = $('gift').getBoundingClientRect();
    const ox = giftRect.left + giftRect.width / 2;
    const oy = giftRect.top + giftRect.height * 0.55;

    const colors = ['#f6cd68', '#e0384c', '#35a06a', '#ffffff', '#fff0c4', '#f2607a'];
    const bits = Array.from({ length: 150 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
      const speed = Math.random() * 15 + 7;
      return {
        x: ox, y: oy,
        vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.75),
        vy: Math.sin(angle) * speed,
        w: Math.random() * 7 + 4,
        h: Math.random() * 4 + 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
        life: 0,
        ttl: Math.random() * 60 + 95,
      };
    });

    function frame() {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;

      for (const b of bits) {
        if (b.life > b.ttl) continue;
        alive++;
        b.life++;
        b.vy += 0.33;         // gravity
        b.vx *= 0.985;        // drag
        b.vy *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - b.life / b.ttl);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        // Flip the width over time so each bit looks like it is tumbling.
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w * Math.abs(Math.cos(b.life * 0.09)), b.h);
        ctx.restore();
      }

      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ the flow
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let pendingName = null;   // giftee, decrypted and held until they tap

  function goToBox(me) {
    $('box-greeting').textContent = `Hi ${me}`;
    const gift = $('gift');
    gift.classList.remove('is-shaking', 'is-open');
    screens.box.classList.remove('is-opening');
    gift.disabled = false;
    show('box');
  }

  function goToReveal(giftee) {
    $('giftee').textContent = giftee;
    show('reveal');
  }

  async function unwrap() {
    const gift = $('gift');
    if (gift.disabled) return;
    gift.disabled = true;

    if (reduced) {
      goToReveal(pendingName);
      return;
    }

    gift.classList.add('is-shaking');
    await wait(500);
    gift.classList.remove('is-shaking');
    screens.box.classList.add('is-opening');
    gift.classList.add('is-open');
    burstConfetti();
    await wait(760);
    goToReveal(pendingName);
  }

  function buildRoster() {
    const box = $('roster');
    box.replaceChildren();

    for (const name of DRAW.roster) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'name-btn';
      btn.textContent = name;

      btn.addEventListener('click', async () => {
        const siblings = [...box.querySelectorAll('button')];
        siblings.forEach((b) => (b.disabled = true));
        btn.textContent = 'Opening…';
        try {
          pendingName = await revealFor(name);
          try { localStorage.setItem(STORE_KEY, name); } catch { /* private mode */ }
          goToBox(name);
        } catch (err) {
          console.error(err);
          fail(`Could not open ${name}'s present. The draw file may be out of date — ask Luka to resend the link.`);
        } finally {
          siblings.forEach((b) => (b.disabled = false));
          btn.textContent = name;
        }
      });

      box.appendChild(btn);
    }
  }

  function clearAndRestart() {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    pendingName = null;
    show('pick');
  }

  async function init() {
    // Guard rails, so a half-finished setup says what is wrong.
    if (!DRAW || !DRAW.gifts || !Array.isArray(DRAW.roster) || !DRAW.roster.length) {
      return fail('No draw has been generated yet. Run `node generate.mjs`, then commit draw.js.');
    }
    if (!window.crypto || !crypto.subtle) {
      return fail('This browser cannot decrypt the draw. It needs to be opened over https (or localhost).');
    }

    startSnow();
    buildRoster();

    $('gift').addEventListener('click', unwrap);
    $('reset').addEventListener('click', clearAndRestart);
    $('error-reset').addEventListener('click', clearAndRestart);
    $('replay').addEventListener('click', () => {
      const me = (() => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } })();
      goToBox(me || '');
    });

    // Already drew on this device? Go straight to the name.
    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* ignore */ }

    if (saved && DRAW.roster.includes(saved)) {
      try {
        pendingName = await revealFor(saved);
        $('box-greeting').textContent = `Hi ${saved}`;
        return goToReveal(pendingName);
      } catch {
        clearAndRestart();   // draw was regenerated since; pick again
        return;
      }
    }
    show('pick');
  }

  init();
})();
