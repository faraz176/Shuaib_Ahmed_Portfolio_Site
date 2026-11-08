/* Run in the rendered local page (index.html) using Playwright evaluate or agent-browser eval.
   Leaves the saved palette and Signal choices as it found them. */
(async () => {
  const checks = [];
  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const settle = async () => { await frame(); await frame(); await wait(60); };
  const until = async (test, ms = 2500) => { const end = performance.now() + ms; while (!test() && performance.now() < end) await wait(25); return test(); };
  const saved = { palette: localStorage.getItem('sa-palette'), signal: localStorage.getItem('sa-wave-signal') };
  const figure = document.querySelector('[data-crt-portrait]');
  const canvas = figure.querySelector('[data-crt-canvas]'), poster = figure.querySelector('img');
  const crt = window.crtPortrait, Crt = window.CrtPortrait, DEG = Math.PI / 180;
  const box = (w, h, top = 0) => {
    const holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:0;top:${top}px;width:${w}px;height:${h}px;opacity:0;pointer-events:none`;
    const c = document.createElement('canvas');
    c.style.cssText = 'width:100%;height:100%;display:block';
    holder.append(c); document.body.append(holder);
    return { holder, canvas: c };
  };
  const lit = px => { let n = 0; for (let i = 0; i < px.length; i += 4) n += px[i] + px[i + 1] + px[i + 2] > 150; return n / (px.length / 4); };
  const tint = px => { const sum = [0, 0, 0]; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 240) for (let k = 0; k < 3; k++) sum[k] += px[i + k]; return sum; };
  const difference = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) n += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30; return n / (a.length / 4); };

  assert(crt instanceof Crt, 'The hero portrait starts on page load');
  await crt.ready;
  scrollTo(0, 0);
  assert(await until(() => !!crt.gpu && crt.drawn), 'The visible hero portrait compiles its WebGL screen and draws');
  assert(figure.classList.contains('is-live'), 'The canvas fades in over the poster once drawn');
  assert(/Shuaib Ahmed/.test(poster.alt) && poster.complete && poster.naturalWidth === 720, 'The poster image carries the accessible name and loads');
  assert(canvas.getAttribute('aria-hidden') === 'true', 'The animated canvas is hidden from assistive technology');
  assert(crt.grid.width === 240 && crt.grid.height === 300 && crt.grid.values.length === 72000, 'The portrait grid decodes to 240 x 300');
  const inside = crt.grid.values.reduce((n, v) => n + (v > 0), 0) / crt.grid.values.length;
  assert(inside > .3 && inside < .6, 'The subject covers a portrait-sized share of the screen');
  scrollTo(0, 0); await settle();
  const rect = canvas.getBoundingClientRect(), ratio = Math.min(2, devicePixelRatio || 1);
  assert(Math.abs(canvas.width - Math.round(rect.width * ratio)) <= 1 && Math.abs(canvas.height - Math.round(rect.height * ratio)) <= 1, 'The canvas backing store matches its displayed size');

  const hud = figure.querySelector('.crt-hud');
  assert(hud.getAttribute('aria-hidden') === 'true' && hud.querySelectorAll('svg').length === 4, 'The HUD frame has four SVG corner brackets and is hidden from assistive technology');
  assert(hud.querySelector('.crt-hud-top').textContent === 'SA-01 // NYC' && /^(0[1-3] \/\/ (SHUAIB AHMED|ROUTER \/\/ L3|SWITCH \/\/ L2))$/.test(hud.querySelector('.crt-hud-bottom').textContent), 'HUD microcopy identifies the portrait location and current TV channel');

  // Palette: five swatches in the frame corner; the choice recolors the portrait and the whole site, and is saved.
  const group = figure.querySelector('[data-crt-palette]'), swatches = [...group.querySelectorAll('button')];
  const signal = figure.querySelector('[data-crt-signal]');
  assert(!group.hidden && !signal.hidden, 'The palette switcher and Signal toggle appear once the renderer is live');
  assert(swatches.map(b => b.dataset.palette).join() === 'yellow,orange,cyan,lime,blue' && swatches.every(b => b.getAttribute('aria-label') && b.hasAttribute('aria-pressed')), 'Swatches are yellow, orange, cyan, lime, and blue toggle buttons with names');
  assert([signal, document.querySelector('.crt-color-control input')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 24 && r.height >= 24; }), 'Visible portrait and gradient controls are at least 24 x 24 px');
  const startPalette = crt.palette;
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase();
  swatches[0].click(); await settle();
  let [r, g, b] = tint(crt.pixels());
  assert(document.documentElement.dataset.palette === 'yellow' && accent() === '#ffd400' && localStorage.getItem('sa-palette') === 'yellow' && swatches[0].getAttribute('aria-pressed') === 'true', 'Yellow recolors the site accent and is saved');
  assert(r > b * 2 && g > b * 2, 'Yellow tints the portrait warm');
  assert(getComputedStyle(hud).color === 'rgb(255, 212, 0)', 'The HUD follows the palette');
  swatches[3].click(); await settle();
  [r, g, b] = tint(crt.pixels());
  assert(g > r * 1.5 && g > b * 1.5 && accent() === '#5cff3d', 'Lime tints the portrait green and recolors the site accent');
  swatches[2].click(); await settle();
  [r, g, b] = tint(crt.pixels());
  assert(b > r * 2 && g > r * 2 && accent() === '#74dcff', 'Cyan restores the original site accent and a cyan portrait');
  assert(swatches.filter(b => b.getAttribute('aria-pressed') === 'true').length === 1, 'Exactly one swatch is pressed');
  swatches[4].click(); await settle();
  [r, g, b] = tint(crt.pixels());
  assert(b > r * 1.5 && g > r * 1.2 && accent() === '#8fafff' && localStorage.getItem('sa-palette') === 'blue', 'Electric blue has cyan cores, recolors the site, and is saved');
  crt.setPalette(startPalette);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let draws = 0;
  const original = Crt.prototype.draw;
  Crt.prototype.draw = function (...args) { draws++; return original.apply(this, args); };
  const probes = [];
  try {
    crt.setMotion(null); await settle();
    {
      assert(!crt.still(), `No saved Signal choice animates with reduced-motion ${reduced ? 'on' : 'off'}`);
      assert(canvas.dataset.crt === 'running' && signal.getAttribute('aria-pressed') === 'true', 'The visible portrait animates and the Signal LED is lit');
      draws = 0; const c0 = crt.clock; await wait(1000);
      assert(draws >= 40 && draws <= 70, `Animation runs near 60 frames per second (${draws})`);
      assert(crt.clock - c0 > .6 && crt.clock - c0 < 1.2, 'The signal clock follows real time while running');
      scrollTo(0, document.documentElement.scrollHeight); await wait(250);
      assert(canvas.dataset.crt === 'paused', 'Scrolling the hero away pauses the portrait');
      draws = 0; await wait(400);
      assert(draws === 0, 'No frames are drawn while offscreen');
      scrollTo(0, 0); await wait(250);
      assert(canvas.dataset.crt === 'running', 'Scrolling back resumes the portrait');
      const main = document.querySelector('main');
      main.inert = true; await settle();
      assert(canvas.dataset.crt === 'paused', 'An open viewer or network view (inert page) pauses the portrait');
      main.inert = false; await settle();
      assert(canvas.dataset.crt === 'running', 'Closing the overlay resumes the portrait');
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange')); await settle();
      const frozen = crt.clock; draws = 0; await wait(300);
      assert(canvas.dataset.crt === 'paused' && draws === 0 && crt.clock === frozen, 'A hidden tab pauses the warp and freezes its clock');
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange')); await settle();
      assert(canvas.dataset.crt === 'running', 'Returning to the tab resumes the portrait');
      signal.click(); await settle();
      draws = 0; await wait(300);
      assert(canvas.dataset.crt === 'still' && draws === 0 && signal.getAttribute('aria-pressed') === 'false' && localStorage.getItem('sa-wave-signal') === 'off', 'Signal off stops the motion and is saved');
      signal.click(); await settle();
      assert(canvas.dataset.crt === 'running' && localStorage.getItem('sa-wave-signal') === 'on', 'Signal on resumes the motion and is saved');
    }
    crt.setMotion(null);

    // A still instance (explicit Signal off) at the poster's size.
    const a = box(360, 450); probes.push(a.holder);
    const media = { matches: true, addEventListener: (type, fn) => { media.onChange = fn; } };
    const still = new Crt(a.canvas, window.PORTFOLIO_PORTRAIT, media, { motion: 'off' });
    await still.ready;
    assert(await until(() => a.canvas.dataset.crt === 'still'), 'Signal off renders a still frame in a new instance');
    const s1 = still.pixels(); still.clock = 37.5; const s2 = still.pixels();
    assert(difference(s1, s2) === 0, 'The still frame never changes: no warp, roll, tears, or grain motion');
    assert(lit(s1) > .06, 'The still frame shows the dithered portrait');
    if (location.protocol === 'file:') checks.push('Poster comparison skipped: file:// images cannot be read back; serve over http');
    else if (a.canvas.width === 720 && a.canvas.height === 900) {
      const ref = document.createElement('canvas'); ref.width = 720; ref.height = 900;
      const ctx = ref.getContext('2d'); ctx.drawImage(poster, 0, 0);
      const p = ctx.getImageData(0, 0, 720, 900).data;
      let error = 0; for (let i = 0; i < p.length; i += 4) error += Math.abs(p[i] - s1[i]) + Math.abs(p[i + 1] - s1[i + 1]) + Math.abs(p[i + 2] - s1[i + 2]);
      error /= (p.length / 4) * 3;
      assert(error < 8, `The poster matches the renderer's still frame (mean error ${error.toFixed(2)})`);
    } else checks.push('Poster comparison skipped: needs a 2x display');

    // A moving instance: the signal changes the picture, and the push-in settles.
    const m = box(360, 450); probes.push(m.holder);
    const live = new Crt(m.canvas, window.PORTFOLIO_PORTRAIT, { matches: false, addEventListener() {} });
    await live.ready;
    assert(await until(() => !!live.gpu), 'A motion instance builds');
    live.clock = 0; const push = live.pixels(); live.clock = 7.2; const rest = live.pixels();
    live.clock = 7.45; const rest2 = live.pixels();
    assert(difference(push, rest) > .03, 'The first-view push-in starts zoomed out and moves in');
    assert(difference(rest, rest2) > .03 && difference(rest, rest2) < .35, 'Between surges the picture keeps flowing strongly');
    live.timeline.plan(30);
    const surge = live.timeline.surges[0];
    live.clock = surge.start + surge.attack + .2; const peak = live.pixels();
    assert(difference(rest, peak) > .08, 'A surge visibly tears and stretches the picture');

    // Signal timeline: two minutes at 60 fps.
    const timeline = new Crt.Signal(20261107);
    const starts = []; let inSurge = false, maxStretch = 1, maxRot = 0, maxSkew = 0, minCa = 9, maxCa = 0, last = null;
    const step = { amp: 0, stretch: 0, dissolve: 0 };
    let dissolves = 0, inDissolve = false, settledStretch = true;
    for (let t = 0; t <= 120; t += 1 / 60) {
      const s = timeline.at(t);
      if (s.surge > 0 && !inSurge) { starts.push(t); inSurge = true; } else if (s.surge === 0) inSurge = false;
      if (s.dissolve > .5 && !inDissolve) { dissolves++; inDissolve = true; } else if (s.dissolve === 0) inDissolve = false;
      if (s.surge === 0 && s.stretch !== 1 && starts.length && t - starts[starts.length - 1] > 6) settledStretch = false;
      maxStretch = Math.max(maxStretch, s.stretch);
      maxRot = Math.max(maxRot, Math.abs(s.rot) / DEG); maxSkew = Math.max(maxSkew, Math.abs(Math.atan(s.skew)) / DEG);
      minCa = Math.min(minCa, s.ca); maxCa = Math.max(maxCa, s.ca);
      if (last) for (const key in step) step[key] = Math.max(step[key], Math.abs(s[key] - last[key]));
      last = s;
    }
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    assert(starts.length >= 11 && gaps.every(gap => gap >= 6 - .05 && gap <= 10 + .05), `Surges arrive every 6-10 s (${gaps.map(g => g.toFixed(1)).join(', ')})`);
    assert(maxStretch >= 1.5 && maxStretch <= 2 && settledStretch, `Vertical stretch reaches ${maxStretch.toFixed(2)}x, then relaxes to 1x`);
    assert(maxRot >= 1 && maxRot <= 3 && maxSkew >= 1 && maxSkew <= 3, `Rotation (${maxRot.toFixed(1)}°) and skew (${maxSkew.toFixed(1)}°) stay within 1-3°`);
    assert(dissolves >= 3 && dissolves < starts.length, `Some surges dissolve into diagonal streaks, then reform (${dissolves} of ${starts.length})`);
    assert(minCa === 2 && maxCa <= 4 && maxCa > 3.5, 'Chromatic offset runs 2-4 px');
    assert(step.amp < .5 && step.stretch < .03 && step.dissolve < .04, `Changes are slow, never a strobe (per 60 fps frame: drift ${step.amp.toFixed(2)} px, stretch ${step.stretch.toFixed(3)}, dissolve ${step.dissolve.toFixed(3)})`);
    const c0 = Crt.camera(0), c9 = Crt.camera(9), c20 = Crt.camera(20);
    let monotonic = true; for (let t = .1; t <= 9; t += .1) monotonic &&= Crt.camera(t).zoom >= Crt.camera(t - .1).zoom;
    assert(c0.zoom < .9 && monotonic && c9.zoom === 1 && c20.zoom === 1 && Math.abs(c9.x) + Math.abs(c9.y) + Math.abs(c9.rot) < 1e-9, 'The push-in moves in slowly with handheld drift and settles by 9 s');

    // Offscreen portraits (for example a #field-work load) skip the WebGL build until visible.
    const away = box(200, 250, -3000); probes.push(away.holder);
    const late = new Crt(away.canvas, window.PORTFOLIO_PORTRAIT, { matches: true, addEventListener() {} }, { motion: 'off' });
    await late.ready; await settle(); await wait(800);
    assert(!late.gpu && !late.gl, 'An offscreen portrait decodes but creates no WebGL context');
    away.holder.style.top = '0px';
    assert(await until(() => !!late.gpu && away.canvas.dataset.crt === 'still'), 'Scrolling the portrait into view builds and draws it');

    media.matches = false; media.onChange();
    await settle();
    assert(a.canvas.dataset.crt === 'still', 'Signal off remains still when the system motion preference changes');
    still.setMotion(null); await settle();
    assert(a.canvas.dataset.crt === 'paused' || a.canvas.dataset.crt === 'running', 'Clearing Signal off restores the animated default');

    const blocked = box(100, 125); probes.push(blocked.holder);
    blocked.canvas.getContext = () => null;
    new Crt(blocked.canvas, window.PORTFOLIO_PORTRAIT, { matches: false, addEventListener() {} });
    assert(await until(() => blocked.canvas.dataset.crt === 'unavailable'), 'Without WebGL the portrait reports unavailable and the poster stays');

    // Context loss: a built portrait relinks after restore, and a loss while the shader links does not stick.
    const lose = live.gl.getExtension('WEBGL_lose_context');
    lose.loseContext();
    assert(await until(() => !live.gpu && m.canvas.dataset.crt === 'loading'), 'A lost WebGL context drops the renderer');
    lose.restoreContext();
    assert(await until(() => !!live.gpu && live.drawn && m.canvas.dataset.crt === 'running'), 'A restored context relinks the shader and draws again');
    // Frames are held so the context is lost and restored before the pending link's next poll.
    const n = box(200, 250); probes.push(n.holder);
    const midway = new Crt(n.canvas, window.PORTFOLIO_PORTRAIT, { matches: true, addEventListener() {} }, { motion: 'off' });
    const raf = window.requestAnimationFrame, held = [];
    const release = () => { window.requestAnimationFrame = raf; held.splice(0).forEach(fn => raf(fn)); };
    let pending = null;
    midway.link = function () {
      if (pending !== null) return Crt.prototype.link.call(this);
      window.requestAnimationFrame = fn => held.push(fn);
      Crt.prototype.link.call(this);
      pending = this.linking;
      if (!pending) { release(); return; }
      const x = this.gl.getExtension('WEBGL_lose_context');
      n.canvas.addEventListener('webglcontextlost', () => setTimeout(() => x.restoreContext()), { once: true });
      n.canvas.addEventListener('webglcontextrestored', () => setTimeout(release), { once: true });
      x.loseContext();
    };
    try {
      await midway.ready;
      assert(await until(() => pending !== null), 'A new portrait starts linking its shader');
      if (pending) {
        checks.push('The shader links in the background (KHR_parallel_shader_compile) instead of blocking the page');
        assert(await until(() => !!midway.gpu && n.canvas.dataset.crt === 'still'), 'A context lost and restored mid-link recovers: the restored context links and draws');
      } else checks.push('Background shader linking skipped: KHR_parallel_shader_compile is unavailable');
    } finally {
      release();
    }
    for (const p of [still, live, late, midway]) p.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } finally {
    Crt.prototype.draw = original;
    probes.forEach(p => p.remove());
    for (const [key, value] of [['sa-palette', saved.palette], ['sa-wave-signal', saved.signal]]) value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  }

  const unavailable = new Crt(document.createElement('canvas'), null, { matches: false });
  assert(unavailable.canvas.dataset.crt === 'unavailable', 'Missing data leaves the poster in place');
  return { passed: checks.length, checks };
})();
