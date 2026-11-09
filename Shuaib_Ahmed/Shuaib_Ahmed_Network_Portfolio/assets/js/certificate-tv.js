/* One certificate TV. Each certificate is a channel, digitized into the site ink on the tube. The guide beside it
   is a shelf of tapes: drag one into the VCR slot to play it, or select it. The original cards remain for print
   and for browsers without JavaScript. */
(() => {
  if (document.body.classList.contains('dos-home')) return;
  'use strict';
  const section = document.querySelector('#certifications'), grid = section?.querySelector('.cert-grid');
  const certificates = window.PORTFOLIO_CERTIFICATES || [];
  if (!grid || !certificates.length || !window.TVFrame) return;
  const { make } = window.TVFrame;
  const root = document.documentElement;
  const still = () => root.classList.contains('crt-motion-off');
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const channels = [...grid.querySelectorAll(':scope > .cert-card')].slice(0, certificates.length)
    .map((card, i) => ({ card, ...certificates[i], number: String(i + 1).padStart(2, '0') }));
  if (!channels.length) return;
  let index = 0, job = 0, osdTimer = 0;

  const station = make('div', 'ctv-station');
  const tv = window.TVFrame.build({ className: 'ctv-tv', label: 'Certificate TV', keys: [
    { key: 'down', text: 'PREV', name: 'Prev channel: previous certificate', action: () => tune(index - 1) },
    { key: 'up', text: 'NEXT', name: 'Next channel: next certificate', action: () => tune(index + 1) }
  ] });
  // The tube is the tab panel. Its picture is labelled with what the card says: issuer, dates and ID.
  const screen = tv.screen;
  screen.classList.add('ctv-screen');
  screen.id = 'ctv-panel';
  screen.setAttribute('role', 'tabpanel');
  screen.tabIndex = 0;
  const picture = make('div', 'ctv-picture'), canvas = make('canvas', 'ctv-canvas'), noise = make('canvas', 'ctv-noise'), osd = make('p', 'ctv-osd');
  picture.setAttribute('role', 'img');
  canvas.setAttribute('aria-hidden', 'true');
  noise.setAttribute('aria-hidden', 'true');
  osd.setAttribute('aria-hidden', 'true');
  picture.append(canvas);
  tv.show(picture, noise, osd);
  const spoken = channels.map(({ card, title }) => [title + ' certificate awarded to Shuaib Ahmed',
    ...[...card.querySelectorAll(':scope > p')].map(p => p.textContent.replace(/\s+/g, ' ').trim())].join('. ') + '.');

  const guide = make('div', 'ctv-guide'), list = make('div', 'ctv-channels');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', 'Certificate channels');
  const tabs = channels.map((channel, i) => {
    const tab = make('button');
    tab.type = 'button';
    tab.id = 'ctv-tab-' + i;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', screen.id);
    tab.append(make('span', 'ctv-ch', 'CH ' + channel.number), make('span', 'ctv-name', channel.title));
    tab.addEventListener('click', () => tune(i));
    list.append(tab);
    return tab;
  });
  list.addEventListener('keydown', event => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -index, End: channels.length - 1 - index };
    if (!(event.key in moves)) return;
    event.preventDefault();
    tune(index + moves[event.key]);
    tabs[index].focus();
  });
  guide.append(make('p', 'ctv-hint', 'Drag a tape into the VCR slot to play it, or select it.'), list);
  station.append(tv.root, guide);
  grid.before(station);
  grid.hidden = true;

  // ---- Digitizing: inverted luminance, four-level Bayer dither, tinted in the site accent --------------------------
  const images = new Map(), masks = new Map();
  const load = src => images.get(src) || images.set(src, new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  })).get(src);
  const area = () => [Math.max(1, Math.round(picture.clientWidth)), Math.max(1, Math.round(picture.clientHeight))];
  function digitize(image, width, height) {
    const scale = Math.min(width * .9 / image.naturalWidth, height * .86 / image.naturalHeight);
    const w = Math.max(1, Math.round(image.naturalWidth * scale)), h = Math.max(1, Math.round(image.naturalHeight * scale));
    const mask = make('canvas');
    mask.width = w; mask.height = h;
    const g = mask.getContext('2d', { willReadFrequently: true });
    g.drawImage(image, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h), px = data.data, n = w * h, lum = new Float32Array(n), hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) {
      const v = 255 - (.2126 * px[i * 4] + .7152 * px[i * 4 + 1] + .0722 * px[i * 4 + 2]);
      lum[i] = v;
      hist[v | 0]++;
    }
    const level = q => { let sum = 0; for (let v = 0; v < 256; v++) if ((sum += hist[v]) >= n * q) return v; return 255; };
    const lo = level(.5), hi = Math.max(lo + 1, level(.995));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, tone = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)));
      const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
      const step = Math.min(4, Math.floor(Math.pow(tone, .8) * 4 + threshold)) / 4;
      const o = i * 4;
      px[o] = px[o + 1] = px[o + 2] = 255;
      px[o + 3] = Math.round((.07 + .93 * step) * 255);
    }
    g.putImageData(data, 0, 0);
    return { mask, x: Math.round((width - w) / 2), y: Math.round((height - h) / 2) };
  }
  function maskFor(i) {
    const [w, h] = area(), key = `${i}:${w}x${h}`;
    if (!masks.has(key)) masks.set(key, load(channels[i].preview).then(image => image && digitize(image, w, h)));
    return masks.get(key);
  }
  const tint = make('canvas');
  let shown = null;
  function paint(result = shown) {
    shown = result;
    const [w, h] = area();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (!result) return;
    const { mask, x, y } = result, t = tint.getContext('2d');
    tint.width = mask.width; tint.height = mask.height;
    t.drawImage(mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = getComputedStyle(root).getPropertyValue('--accent').trim() || '#8fafff';
    t.fillRect(0, 0, tint.width, tint.height);
    g.globalAlpha = .55;
    g.filter = 'blur(2.5px)';
    g.drawImage(tint, x, y);
    g.filter = 'none';
    g.globalAlpha = 1;
    g.drawImage(tint, x, y);
  }

  const slotLabel = i => `CH ${channels[i].number} · ${channels[i].title}`;

  // A short burst of snow covers the change of channel.
  function snow(until) {
    const w = noise.width = Math.max(1, Math.round(picture.clientWidth / 3)), h = noise.height = Math.max(1, Math.round(picture.clientHeight / 3));
    const g = noise.getContext('2d'), frame = g.createImageData(w, h), start = performance.now();
    let settled = false;
    until.then(() => { settled = true; });
    tv.root.classList.add('is-tuning');
    return new Promise(resolve => {
      const draw = now => {
        const px = frame.data;
        for (let i = 0; i < px.length; i += 4) { const v = Math.random() * 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
        g.putImageData(frame, 0, 0);
        if (settled && now - start > 240) { tv.root.classList.remove('is-tuning'); resolve(); } else requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
  }
  function select(i) {
    tabs.forEach((tab, n) => {
      tab.setAttribute('aria-selected', String(n === i));
      tab.tabIndex = n === i ? 0 : -1;
    });
    screen.setAttribute('aria-labelledby', tabs[i].id);
    picture.setAttribute('aria-label', spoken[i]);
    osd.textContent = 'CH ' + channels[i].number;
    tv.slot.textContent = slotLabel(i);
    osd.classList.add('is-on');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove('is-on'), 2600);
  }
  async function tune(i, first = false) {
    index = (i + channels.length) % channels.length;
    const id = ++job, ready = maskFor(index);
    select(index);
    if (!first && !still()) await snow(ready);
    const result = await ready;
    if (id === job) paint(result);
  }

  document.addEventListener('crt-color-change', () => paint());
  new MutationObserver(() => paint()).observe(root, { attributes: true, attributeFilter: ['data-palette'] });
  let resizeTimer = 0, booted = false;
  new ResizeObserver(() => {
    if (!booted) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { masks.clear(); const id = job; maskFor(index).then(result => { if (id === job) paint(result); }); }, 120);
  }).observe(picture);
  select(0);
  new IntersectionObserver((entries, observer) => {
    if (!entries.some(e => e.isIntersecting)) return;
    observer.disconnect();
    booted = true;
    tune(0, true).then(() => {
      const warm = i => { if (i < channels.length) maskFor(i).then(() => (window.requestIdleCallback || setTimeout)(() => warm(i + 1))); };
      warm(1);
    });
  }, { rootMargin: '300px 0px' }).observe(tv.root);

  // ---- Tapes: drag a channel into the VCR slot to play it ------------------------------------------------------
  // Pointer events rather than native drag and drop, so mouse, pen and touch (press and hold) behave the same and
  // the tape can be animated into the slot.
  const dock = make('div', 'ctv-dock');
  dock.setAttribute('aria-hidden', 'true');
  tv.frame.append(dock);
  function cassette(channel) {
    const tape = make('div', 'ctv-tape'), label = make('div', 'ctv-tape-label'), glass = make('div', 'ctv-tape-window');
    label.append(make('b', null, 'CH ' + channel.number), make('span', null, channel.title));
    glass.append(make('i', 'ctv-reel'), make('i', 'ctv-reel'));
    tape.append(label, glass, make('small', 'ctv-tape-mark', 'VHS'));
    tape.setAttribute('aria-hidden', 'true');
    // Close to the slot's width, so the tape barely changes size on the way in.
    tape.style.width = Math.round(Math.max(170, Math.min(240, dock.getBoundingClientRect().width * .84))) + 'px';
    return tape;
  }
  // Every pose uses the same transform list, so animations interpolate each part instead of a matrix.
  const pose = ({ x, y, tilt = 0, scale = 1, flat = 0, depth = 600 }) =>
    `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) perspective(${depth}px) rotateX(${flat}deg) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  let drag = null, swallowUntil = 0, cancelledPointer = null;
  const overSlot = (x, y) => {
    const r = dock.getBoundingClientRect();
    return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 36 && y <= r.bottom + 36;
  };
  function lift(x, y) {
    const tape = drag.tape = cassette(channels[drag.i]);
    document.body.append(tape);
    Object.assign(drag, { live: true, gx: tape.offsetWidth / 2, gy: tape.offsetHeight * .4, depth: Math.round(tape.offsetHeight * 4.5), x, y, lx: x, vx: 0, armed: false });
    drag.tab.classList.add('is-lifted');
    station.classList.add('is-dragging');
    root.classList.add('ctv-grabbing');
    try { drag.tab.setPointerCapture(drag.id); } catch { /* released already */ }
    tv.slot.textContent = '▼ INSERT TAPE';
    follow();
  }
  function place(x, y) {
    drag.x = x; drag.y = y;
    if (!drag.raf) drag.raf = requestAnimationFrame(follow);
  }
  function follow() {
    const d = drag;
    if (!d) return;
    d.raf = 0;
    const armed = overSlot(d.x, d.y);
    d.vx = d.vx * .65 + (d.x - d.lx) * .35;
    d.lx = d.x;
    d.pose = { x: d.x - d.gx, y: d.y - d.gy, tilt: armed ? 0 : Math.max(-14, Math.min(14, d.vx * .8)), scale: armed ? .94 : 1, depth: d.depth };
    d.tape.style.transform = pose(d.pose);
    if (armed !== d.armed) {
      d.armed = armed;
      tv.root.classList.toggle('is-armed', armed);
      tv.slot.textContent = armed ? '▶ RELEASE TO PLAY' : '▼ INSERT TAPE';
    }
    // Holding the tape near the top or bottom of the window scrolls the page, so the slot is always reachable.
    const zone = Math.min(90, innerHeight * .14);
    const speed = d.y < zone ? (d.y - zone) / zone : d.y > innerHeight - zone ? (d.y - innerHeight + zone) / zone : 0;
    let again = Math.abs(d.vx) > .05;
    if (speed) {
      const before = scrollY;
      scrollBy({ top: Math.round(speed * 16), behavior: 'instant' });
      again ||= scrollY !== before;
    }
    if (again) d.raf = requestAnimationFrame(follow);
  }
  // The tape lines up over the slot, tips back flat and slides in.
  function insert(d) {
    if (still()) return Promise.resolve();
    const tape = d.tape, r = dock.getBoundingClientRect(), w = tape.offsetWidth, h = tape.offsetHeight, s = r.width * .84 / w;
    const x = r.left + r.width / 2 - w / 2, y = r.top + r.height / 2 - h / 2, depth = d.depth;
    tv.root.classList.add('is-loading');
    return tape.animate([
      { transform: pose(d.pose) },
      { transform: pose({ x, y: y - h * s * .5, scale: s, depth }), offset: .42 },
      { transform: pose({ x, y, scale: s, flat: 74, depth }), offset: .76 },
      { transform: pose({ x, y: y + r.height * .2, scale: s * .97, flat: 90, depth }), opacity: 0 }
    ], { duration: 680, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).finished.catch(() => {})
      .finally(() => tv.root.classList.remove('is-loading'));
  }
  function shelve(d) {
    if (still()) return Promise.resolve();
    const tape = d.tape, r = d.tab.getBoundingClientRect(), w = tape.offsetWidth, h = tape.offsetHeight;
    return tape.animate([{ transform: pose(d.pose), opacity: 1 },
      { transform: pose({ x: r.right - 26 - w / 2, y: r.top + r.height / 2 - h / 2, scale: .15, depth: d.depth }), opacity: .2 }],
      { duration: 300, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished.catch(() => {});
  }
  async function release(x, y) {
    const d = drag;
    drag = null;
    clearTimeout(d.hold);
    if (!d.live) return;
    cancelAnimationFrame(d.raf);
    swallowUntil = performance.now() + 450;
    station.classList.remove('is-dragging');
    tv.root.classList.remove('is-armed');
    root.classList.remove('ctv-grabbing');
    if (x != null && overSlot(x, y)) {
      tv.slot.textContent = '▶ LOADING';
      await insert(d);
      d.tab.classList.remove('is-lifted');
      d.tape.remove();
      tune(d.i);
    } else {
      tv.slot.textContent = slotLabel(index);
      await shelve(d);
      d.tab.classList.remove('is-lifted');
      d.tape.remove();
    }
  }
  list.addEventListener('pointerdown', event => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || drag || event.button !== 0 || !event.isPrimary) return;
    drag = { i: tabs.indexOf(tab), tab, id: event.pointerId, x0: event.clientX, y0: event.clientY, touch: event.pointerType === 'touch', live: false };
    if (drag.touch) {
      const d = drag;
      d.hold = setTimeout(() => { if (drag === d) lift(d.x0, d.y0); }, 280);
    }
  });
  addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.live) {
      const moved = Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0);
      // A finger that moves before the hold completes is scrolling the page.
      if (drag.touch) { if (moved > 10) { clearTimeout(drag.hold); drag = null; } return; }
      if (moved < 6) return;
      lift(event.clientX, event.clientY);
      return;
    }
    place(event.clientX, event.clientY);
  });
  addEventListener('pointerup', event => {
    // A drag cancelled with Escape still ends in a click on the tab; it should not tune.
    if (event.pointerId === cancelledPointer) { cancelledPointer = null; swallowUntil = performance.now() + 450; return; }
    if (drag && event.pointerId === drag.id) release(event.clientX, event.clientY);
  });
  addEventListener('pointercancel', event => { if (drag && event.pointerId === drag.id) release(null, null); });
  addEventListener('blur', () => { if (drag) release(null, null); });
  addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !drag?.live) return;
    cancelledPointer = drag.touch ? null : drag.id;
    release(null, null);
  });
  // Only touches that start on the shelf wait for this listener; the rest of the page scrolls freely.
  list.addEventListener('touchmove', event => { if (drag?.live) event.preventDefault(); }, { passive: false });
  addEventListener('scroll', () => { if (drag?.live) place(drag.x, drag.y); }, { passive: true });
  list.addEventListener('click', event => {
    if (performance.now() < swallowUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  list.addEventListener('contextmenu', event => { if (drag) event.preventDefault(); });
  list.addEventListener('dragstart', event => event.preventDefault());

  station.certificateTv = { tune, get index() { return index; }, channels, dock };
})();
