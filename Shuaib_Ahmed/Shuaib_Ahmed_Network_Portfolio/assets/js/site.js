/* DOM controls and perspective rendering for the photo-bubble network. */
(() => {
  'use strict';
  const photos = window.PORTFOLIO_ARCHIVE || [];
  const gallery = document.querySelector('[data-memory-gallery]');
  if (!gallery || !photos.length || !window.NetworkArchive) return;
  const $ = selector => gallery.querySelector(selector);
  const stage = $('[data-gallery-stage]'), canvas = $('[data-archive-canvas]');
  const ctx = canvas.getContext('2d', { alpha: false });
  const lightbox = document.querySelector('[data-lightbox]');
  const lightboxImage = lightbox.querySelector('[data-lightbox-image]');
  const caption = lightbox.querySelector('[data-lightbox-caption]');
  const closeButton = lightbox.querySelector('[data-lightbox-close]');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  // The light pass follows the site's Signal switch, like the CRT artwork, rather than the system motion setting.
  // The class changes after this listener runs, hence the timeout.
  const signalOff = {
    get matches() { return document.documentElement.classList.contains('crt-motion-off'); },
    addEventListener: (type, listener) => document.addEventListener('crt-signal-change', () => setTimeout(listener))
  };
  const photoShine = window.PhotoShine
    ? new PhotoShine(lightboxImage, lightbox.querySelector('[data-photo-shine]'), signalOff, window.PORTFOLIO_SHINE || {}) : null;
  const space = new NetworkArchive(photos);
  space.reducedMotion = media.matches;
  space.ambient = !media.matches;
  const mod = (n, size) => (n % size + size) % size;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const TAU = Math.PI * 2, STEP = 1 / 120;
  let active = 0, width = 1, height = 1, ratio = 1;
  let exploring = false, inView = false, dirty = true, raf = 0, lastTime = 0, accumulator = 0;
  let pointer = null, hoverIndex = -1, visible = [], loaded = 0, failed = 0;
  const MOUSE_YAW = .0086, MOUSE_PITCH = .006;
  // Exploring mouse modes: pending/locked (pointer lock), released (cursor shown), free (pointer lock unavailable).
  let mouseMode = '', lockWorked = false, relockAfterViewer = false, ownRelease = false, lastMouse = null;
  let placeholder = null, entryTrigger = null, imageTrigger = null, pageState = null, viewerState = null;
  const thumbnails = new Map(), details = new Map(), failedDetails = new Set();
  const textureJobs = [];
  let textureFrame = 0;
  let pendingDetail = null, detailFocus = new Set();
  const palette = [[109,187,255], [169,149,255], [241,152,187], [248,209,133]];
  const dateColor = value => {
    const x = clamp(value, 0, 1) * (palette.length - 1), i = Math.min(palette.length - 2, Math.floor(x)), f = x - i;
    return `rgb(${palette[i].map((v, k) => Math.round(v + (palette[i + 1][k] - v) * f)).join(',')})`;
  };
  const dateColors = space.nodes.map(n => n.dateRange?.map(dateColor) || ['#a6afb9', '#a6afb9']);
  let lastHud = -Infinity;
  const positionReadout = $('[data-camera-readout]'), lookReadout = $('[data-look-readout]');
  const contactReadout = $('[data-contact-readout]'), impactReadout = $('[data-impact-readout]');
  const travelReadout = $('[data-travel-value]'), travelControl = $('[data-network-travel]');
  const dateGap = $('[data-date-gap]'), gapControl = $('[data-date-gap-control]');
  const maxGapHours = Math.max(1, Math.ceil((space.dateExtent[1] - space.dateExtent[0]) / 3600000));
  dateGap.max = String(maxGapHours);
  let gapFrame = 0, gapPointer = null;
  let starSeed = 4871;
  const random = () => { starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0; return starSeed / 4294967296; };
  const stars = Array.from({ length: 760 }, () => {
    const y = random() * 2 - 1, angle = random() * TAU, shell = 4500 + random() * 22000;
    const ring = Math.sqrt(1 - y * y);
    return { position: [Math.cos(angle) * ring * shell, y * shell, Math.sin(angle) * ring * shell], light: random() };
  });
  const isOpen = () => lightbox.classList.contains('open');
  const formatIndex = i => `${String(i + 1).padStart(3, '0')} / ${photos.length}`;
  function prepareTextures() {
    textureFrame = 0;
    if (document.hidden || isOpen()) return;
    const deadline = performance.now() + 3;
    while (textureJobs.length && performance.now() < deadline) {
      if (textureJobs[0](deadline)) textureJobs.shift();
      else break;
    }
    if (textureJobs.length) textureFrame = requestAnimationFrame(prepareTextures);
  }
  function queueTexture(job, priority) {
    if (priority) textureJobs.unshift(job); else textureJobs.push(job);
    if (!textureFrame) textureFrame = requestAnimationFrame(prepareTextures);
  }
  function glassTexture(image, size, ready, priority = false, relevant = () => true) {
    const bandHeight = 128;
    const texture = {
      size, closed: false,
      tiles: Array.from({ length: Math.ceil(size / bandHeight) }, (_, i) =>
        ({ y: i * bandHeight, height: Math.min(bandHeight, size - i * bandHeight), image: null })),
      close() {
        this.closed = true;
        this.tiles.forEach(tile => {
          tile.image?.close?.();
          if (tile.image instanceof HTMLCanvasElement) tile.image.width = tile.image.height = 0;
          tile.image = null;
        });
      }
    };
    let g, nextTile = 0, completed = 0, cancelled = false;
    const r = size / 2 - 2, middle = size / 2;
    const rows = size > 300 ? 48 : 24, columns = size > 300 ? 32 : 20;
    function triangle(a, b, c, sx, sy, sw, sh, second = false) {
      const center = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
      g.save(); g.beginPath();
      [a, b, c].forEach((p, i) => {
        const dx = p[0] - center[0], dy = p[1] - center[1], length = Math.hypot(dx, dy) || 1;
        const x = p[0] + dx / length * .35, y = p[1] + dy / length * .35;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath(); g.clip();
      if (second) g.transform((b[0] - c[0]) / sw, (b[1] - c[1]) / sw,
        (b[0] - a[0]) / sh, (b[1] - a[1]) / sh, a[0] - b[0] + c[0], a[1] - b[1] + c[1]);
      else g.transform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw,
        (c[0] - a[0]) / sh, (c[1] - a[1]) / sh, a[0], a[1]);
      const pad = Math.max(image.naturalWidth, image.naturalHeight) / size * 2;
      g.drawImage(image, sx - pad, sy - pad, sw + pad * 2, sh + pad * 2,
        -pad, -pad, sw + pad * 2, sh + pad * 2); g.restore();
    }
    const point = (u, v) => [middle + Math.sin((u - .5) * Math.PI) * Math.cos((v - .5) * Math.PI) * r,
      middle + Math.sin((v - .5) * Math.PI) * r];
    function cancel() {
      if (!cancelled) { cancelled = true; texture.close(); ready(null, true); }
      return true;
    }
    // Small independent surfaces bound rasterization, snapshots, and uploads, not just JS submission.
    queueTexture(deadline => {
      if (texture.closed || !relevant()) return cancel();
      while (nextTile < texture.tiles.length && performance.now() < deadline) {
        const tile = texture.tiles[nextTile++];
        const photograph = document.createElement('canvas'), surface = document.createElement('canvas');
        photograph.width = surface.width = size;
        photograph.height = surface.height = tile.height;
        g = photograph.getContext('2d', { willReadFrequently: true });
        g.translate(0, -tile.y); g.beginPath(); g.arc(middle, middle, r, 0, TAU); g.clip();
        for (let row = 0; row < rows; row++) {
          const v0 = row / rows, v1 = (row + 1) / rows;
          if (point(0, v1)[1] < tile.y || point(0, v0)[1] > tile.y + tile.height) continue;
          for (let col = 0; col < columns; col++) {
            const u0 = col / columns, u1 = (col + 1) / columns;
            const a = point(u0, v0), b = point(u1, v0), c = point(u0, v1), d = point(u1, v1);
            const sx = u0 * image.naturalWidth, sy = v0 * image.naturalHeight;
            const sw = image.naturalWidth / columns, sh = image.naturalHeight / rows;
            triangle(a, b, c, sx, sy, sw, sh); triangle(b, d, c, sx, sy, sw, sh, true);
          }
        }
        const material = surface.getContext('2d', { willReadFrequently: true });
        material.translate(0, -tile.y);
        material.beginPath(); material.arc(middle, middle, r, 0, TAU); material.clip();
        material.drawImage(photograph, 0, tile.y);
        const transmission = material.createRadialGradient(middle, middle, 0, middle, middle, r);
        transmission.addColorStop(0, 'rgba(255,255,255,.62)');
        transmission.addColorStop(.62, 'rgba(255,255,255,.49)');
        transmission.addColorStop(1, 'rgba(255,255,255,.68)');
        material.globalCompositeOperation = 'destination-in';
        material.fillStyle = transmission; material.fillRect(0, tile.y, size, tile.height);
        material.globalCompositeOperation = 'source-over';
        const fresnel = material.createRadialGradient(middle, middle, 0, middle, middle, r);
        fresnel.addColorStop(0, 'rgba(68,148,232,.04)');
        fresnel.addColorStop(.7, 'rgba(47,140,235,.06)');
        fresnel.addColorStop(.91, 'rgba(123,214,255,.15)');
        fresnel.addColorStop(1, 'rgba(160,234,255,.48)');
        material.fillStyle = fresnel; material.fillRect(0, tile.y, size, tile.height);
        const reflection = material.createRadialGradient(middle - r * .35, middle - r * .46, r * .02,
          middle - r * .22, middle - r * .32, r * .82);
        reflection.addColorStop(0, 'rgba(232,252,255,.24)');
        reflection.addColorStop(.3, 'rgba(170,225,255,.08)');
        reflection.addColorStop(1, 'rgba(140,210,255,0)');
        material.fillStyle = reflection; material.fillRect(0, tile.y, size, tile.height);
        material.strokeStyle = 'rgba(222,252,255,.84)'; material.lineWidth = Math.max(1, r * .012);
        material.beginPath(); material.arc(middle - r * .015, middle - r * .015, r * .92, Math.PI * 1.08, Math.PI * 1.49); material.stroke();
        material.strokeStyle = 'rgba(75,159,255,.62)'; material.lineWidth = Math.max(1, r * .014);
        material.beginPath(); material.arc(middle, middle, r * .96, .12, 1.25); material.stroke();
        const complete = bitmap => {
          photograph.width = photograph.height = 0;
          if (texture.closed || !relevant()) {
            bitmap.close?.();
            if (bitmap instanceof HTMLCanvasElement) bitmap.width = bitmap.height = 0;
            cancel(); return;
          }
          tile.image = bitmap; completed++;
          ready(texture, completed === texture.tiles.length);
        };
        if (typeof createImageBitmap === 'function') {
          createImageBitmap(surface).then(bitmap => {
            surface.width = surface.height = 0; complete(bitmap);
          }, () => complete(surface));
        } else complete(surface);
      }
      return nextTile === texture.tiles.length;
    }, priority);
  }
  function dateLabel(value, month = false) {
    if (!value) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-US', month || value.length === 7
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    ).format(new Date(value.length === 7 ? `${value}-01T12:00:00Z` : value.length === 10 ? `${value}T12:00:00Z` : `${value}Z`));
  }
  function announce(text) { $('[data-archive-selection]').textContent = text; }
  function updateMotion() {
    const button = $('[data-gallery-motion]');
    button.disabled = media.matches || !ctx;
    button.setAttribute('aria-pressed', String(space.ambient));
    button.setAttribute('aria-label', media.matches ? 'Reduced: ambient floating disabled by reduced-motion preference'
      : space.ambient ? 'Float: pause ambient bubble floating' : 'Still: enable ambient bubble floating');
    $('[data-motion-icon]').textContent = media.matches ? '—' : space.ambient ? '‖' : '▶';
    $('[data-motion-label]').textContent = media.matches ? 'Reduced' : space.ambient ? 'Float' : 'Still';
  }
  function setActive(index, speak = true) {
    active = mod(index, photos.length);
    const photo = photos[active];
    gallery.querySelectorAll('[data-month]').forEach(button => {
      if (button.dataset.month === (photo.captured?.slice(0, 7) || 'unknown')) button.setAttribute('aria-current', 'date');
      else button.removeAttribute('aria-current');
    });
    if (speak) announce(`${photo.title}, ${dateLabel(photo.captured)}, capture ${active + 1} of ${photos.length}`);
    dirty = true; requestDraw();
  }
  function locate(index) {
    hoverIndex = -1;
    setActive(index);
    space.aimAt(space.nodes[active].position);
    dirty = true; requestDraw();
  }
  function buildClusters() {
    const target = $('[data-archive-taxonomy]');
    target.replaceChildren();
    space.groups.forEach(group => {
      const button = document.createElement('button'); button.type = 'button';
      const text = document.createElement('span'); text.textContent = group.label;
      const count = document.createElement('b'); count.textContent = group.indices.length;
      button.append(text, ' ', count);
      const n = group.indices.length;
      button.setAttribute('aria-label', `${group.label} ${n} ${n === 1 ? 'capture' : 'captures'}, look toward cluster`);
      button.addEventListener('click', () => { hoverIndex = -1; space.aimAt(group.center); dirty = true; requestDraw(); });
      target.append(button);
    });
    const legendDate = time => new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(time);
    $('[data-time-start]').textContent = legendDate(space.dateExtent[0]);
    $('[data-time-end]').textContent = legendDate(space.dateExtent[1]);
    $('[data-date-gap-control]').hidden = space.grouping !== 'time';
    $('[data-date-note]').hidden = space.grouping !== 'time';
    $('[data-scene-mode]').textContent = `NETWORK / ${space.grouping === 'time' ? 'DATE PROXIMITY' : 'ACTIVITY'}`;
    gallery.dataset.grouping = space.grouping;
    gallery.dataset.clusters = space.groups.length;
    gallery.dataset.gapHours = Math.round(space.gapDays * 24);
    gallery.querySelectorAll('[data-network-group]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.networkGroup === space.grouping)));
  }
  function setGrouping(mode, immediate = false, speak = true) {
    if (gapFrame) { cancelAnimationFrame(gapFrame); gapFrame = 0; }
    hoverIndex = -1;
    space.setGrouping(mode, Number(dateGap.value) / 24, immediate);
    buildClusters();
    $('[data-network-travel]').value = '0';
    if (speak) announce(`${space.groups.length} clusters, grouped by ${mode === 'time' ? 'date proximity' : 'activity'}. Camera reset to overview.`);
    dirty = true; requestDraw();
  }
  function updateDateGap() {
    const hours = Math.round(clamp(Number(dateGap.value), 1, maxGapHours));
    dateGap.value = String(hours);
    $('[data-date-gap-value]').textContent = `${hours.toLocaleString('en-US')} hr`;
    dateGap.setAttribute('aria-valuetext', `${hours.toLocaleString('en-US')} ${hours === 1 ? 'hour' : 'hours'}${hours === maxGapHours ? ', Full archive' : ''}`);
    gapControl.style.setProperty('--gap-position', `${maxGapHours > 1 ? Math.log(hours) / Math.log(maxGapHours) * 100 : 0}%`);
  }
  function queueDateGap() {
    updateDateGap();
    if (space.grouping !== 'time' || gapFrame || Number(dateGap.value) === Math.round(space.gapDays * 24)) return;
    gapFrame = requestAnimationFrame(() => {
      gapFrame = 0;
      if (space.grouping === 'time' && Number(dateGap.value) !== Math.round(space.gapDays * 24)) setGrouping('time', true, false);
    });
  }
  function pointDateGap(event) {
    const rect = dateGap.getBoundingClientRect();
    // Logarithmic pointer travel keeps 1, 2, and 3 hours usable across the full archive.
    const position = clamp((event.clientX - rect.left - 9) / Math.max(1, rect.width - 18), 0, 1);
    dateGap.value = String(Math.round(Math.exp(position * Math.log(maxGapHours))));
    dateGap.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function resize() {
    if (!ctx) return;
    width = canvas.clientWidth; height = canvas.clientHeight;
    ratio = Math.min(devicePixelRatio || 1, width < 700 ? 1.75 : 2);
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    space.setViewport(width, height);
    if (!exploring) space.resetCamera();
    dirty = true; requestDraw();
  }
  function setSiblingsInert(except) {
    const state = [...document.body.children].filter(el => !except.includes(el) && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName))
      .map(el => [el, el.inert]);
    state.forEach(([el]) => { el.inert = true; });
    return state;
  }
  function restoreInert(state) { state?.forEach(([el, value]) => { el.inert = value; }); }
  function enterNetwork(source = stage, viaMouse = false) {
    if (exploring || !ctx) return;
    entryTrigger = source;
    placeholder = document.createElement('div');
    placeholder.style.height = `${gallery.getBoundingClientRect().height}px`;
    placeholder.setAttribute('aria-hidden', 'true');
    gallery.before(placeholder);
    pageState = { y: scrollY, body: document.body.style.overflow, html: document.documentElement.style.overflow };
    document.body.append(gallery);
    pageState.inert = setSiblingsInert([gallery, lightbox]);
    exploring = true;
    lockWorked = false; setMouseMode('released');
    gallery.classList.add('is-exploring');
    gallery.setAttribute('role', 'dialog');
    gallery.setAttribute('aria-modal', 'true');
    gallery.setAttribute('aria-label', 'Network exploration. Escape returns to the page.');
    gallery.setAttribute('aria-describedby', 'gallery-instructions');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    $('[data-network-enter]').hidden = true; $('[data-network-exit]').hidden = false;
    $('[data-network-travel]').disabled = false;
    $('[data-network-hint]').hidden = true;
    $('[data-network-instruction]').textContent = 'Flight controls';
    stage.setAttribute('aria-label', 'Network flight controls. Move the mouse to look; the center ring aims. Scroll or Up and Down to travel. Escape exits.');
    stage.focus({ preventScroll: true });
    announce('Network entered. Page scrolling is locked. Scroll up to fly forward, down to move backward. Escape returns to the page.');
    lastTime = 0; dirty = true; resize();
    if (viaMouse) captureMouse();
  }
  function releasePointer() {
    if (pointer && stage.hasPointerCapture(pointer.id)) stage.releasePointerCapture(pointer.id);
    pointer = null; stage.classList.remove('dragging');
  }
  function setMouseMode(mode) {
    mouseMode = mode; lastMouse = null; hoverIndex = -1;
    if (mode) gallery.dataset.mouse = mode; else delete gallery.dataset.mouse;
    canvas.style.cursor = !exploring ? 'zoom-in' : mode === 'released' ? 'pointer' : 'none';
    dirty = true; requestDraw();
  }
  function captureMouse() {
    if (!exploring || isOpen() || mouseMode === 'free' || document.pointerLockElement === canvas) return;
    if (!canvas.requestPointerLock) { setMouseMode('free'); return; }
    setMouseMode('pending');
    try { canvas.requestPointerLock()?.catch?.(mouseLockFailed); } catch { mouseLockFailed(); }
  }
  function mouseLockFailed() {
    // Once a lock has worked, a refusal is transient (such as the cooldown after Escape), so keep click-to-aim.
    if (exploring && mouseMode === 'pending' && document.pointerLockElement !== canvas) setMouseMode(lockWorked ? 'released' : 'free');
  }
  function releaseMouse() {
    if (document.pointerLockElement !== canvas) return;
    ownRelease = true; document.exitPointerLock();
  }
  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height];
  }
  function exitNetwork() {
    if (!exploring) return;
    space.stopTravel(); releasePointer(); releaseMouse();
    exploring = false;
    setMouseMode('');
    gallery.classList.remove('is-exploring');
    ['role', 'aria-modal', 'aria-label', 'aria-describedby'].forEach(name => gallery.removeAttribute(name));
    $('[data-network-enter]').hidden = false; $('[data-network-exit]').hidden = true;
    $('[data-network-travel]').disabled = true; $('[data-network-hint]').hidden = false;
    $('[data-network-instruction]').textContent = 'Enter network';
    stage.setAttribute('aria-label', 'Three-dimensional photo-bubble network. Enter to explore.');
    restoreInert(pageState.inert);
    placeholder.replaceWith(gallery); placeholder = null;
    document.body.style.overflow = pageState.body;
    document.documentElement.style.overflow = pageState.html;
    window.scrollTo({ top: pageState.y, behavior: 'instant' });
    entryTrigger?.focus({ preventScroll: true });
    pageState = null; lastTime = 0; accumulator = 0;
    announce('Network exited. Normal page scrolling restored.');
    dirty = true; resize();
  }
  function updateLightbox() {
    const photo = photos[active];
    lightboxImage.src = photo.src; lightboxImage.alt = photo.title;
    caption.textContent = `${photo.title} · ${photo.category} · ${dateLabel(photo.captured)} · ${formatIndex(active)}`;
    photoShine?.play(photo.id);
  }
  function openLightbox(index, source = stage) {
    if (isOpen()) return;
    space.stopTravel(); releasePointer();
    relockAfterViewer = mouseMode === 'locked' || mouseMode === 'pending';
    releaseMouse();
    if (relockAfterViewer) setMouseMode('released');
    setActive(index);
    imageTrigger = source;
    viewerState = { overflow: document.body.style.overflow, inert: setSiblingsInert([lightbox]) };
    updateLightbox();
    lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; closeButton.focus();
  }
  function closeLightbox(viaPointer = false) {
    if (!isOpen()) return;
    photoShine?.stop();
    lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = viewerState.overflow;
    restoreInert(viewerState.inert); viewerState = null;
    lightboxImage.removeAttribute('src');
    imageTrigger?.focus({ preventScroll: true });
    if (textureJobs.length && !textureFrame) textureFrame = requestAnimationFrame(prepareTextures);
    lastTime = 0; dirty = true; requestDraw();
    if (relockAfterViewer && viaPointer) captureMouse();
    relockAfterViewer = false;
  }
  function stepImage(amount) { locate(active + amount); if (isOpen()) updateLightbox(); }
  function project(point, basis) {
    const d = point.map((n, i) => n - space.camera.position[i]);
    const dot = v => d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    const depth = dot(basis.forward);
    return { x: width / 2 + dot(basis.right) * space.focal / depth,
      y: height / 2 - dot(basis.up) * space.focal / depth, depth, scale: space.focal / depth };
  }
  function line(a, b) {
    if (a.depth <= 20 || b.depth <= 20) return;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  function paintSpace(basis) {
    // World-space stars retain parallax against an otherwise pitch-black sky.
    stars.forEach(star => {
      const p = project(star.position, basis);
      if (p.depth < 120 || p.x < -3 || p.x > width + 3 || p.y < -3 || p.y > height + 3) return;
      const r = clamp(18 * p.scale, .4, 1.6);
      ctx.globalAlpha = .24 + star.light * .6;
      ctx.fillStyle = star.light > .85 ? '#e1f4ff' : '#729fdc';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      if (star.light > .97) {
        ctx.globalAlpha *= .28;
        ctx.fillRect(p.x - 3, p.y - .3, 6, .6); ctx.fillRect(p.x - .3, p.y - 3, .6, 6);
      }
    });
    ctx.globalAlpha = 1;
  }
  function requestDetail(node) {
    if (details.has(node.index) || failedDetails.has(node.index) || pendingDetail !== null) return;
    pendingDetail = node.index;
    const image = new Image(); image.decoding = 'async';
    image.onload = () => {
      glassTexture(image, width < 700 ? 1024 : 1536, (texture, complete) => {
        if (texture) details.set(node.index, texture);
        else details.delete(node.index);
        while (details.size > 6) {
          const oldest = [...details.keys()].find(index => !detailFocus.has(index)) ?? details.keys().next().value;
          details.get(oldest).close?.(); details.delete(oldest);
        }
        if (complete) pendingDetail = null;
        dirty = true; requestDraw();
      }, true, () => detailFocus.has(node.index));
    };
    image.onerror = () => { failedDetails.add(node.index); pendingDetail = null; };
    image.src = node.photo.src;
  }
  function paint() {
    if (!ctx || !width || !height) return;
    const basis = space.basis();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    paintSpace(basis);
    const hubs = space.groups.map(g => project(g.center, basis));
    ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(83,174,196,.25)';
    // Connect neighboring cluster hubs, then each bubble to its own hub.
    space.groups.forEach((group, index) => {
      if (!index) return;
      let nearest = 0, distance = Infinity;
      for (let j = 0; j < index; j++) {
        const d = group.center.reduce((s, n, k) => s + (n - space.groups[j].center[k]) ** 2, 0);
        if (d < distance) { nearest = j; distance = d; }
      }
      line(hubs[index], hubs[nearest]);
    });
    visible = [];
    space.nodes.forEach(node => {
      const p = project(node.position, basis), radius = node.radius * p.scale;
      if (p.depth <= 20 || p.x + radius < 0 || p.x - radius > width || p.y + radius < 0 || p.y - radius > height) return;
      visible.push({ node, ...p, radius });
      ctx.strokeStyle = `rgba(80,167,188,${clamp(500 / p.depth, .07, .25)})`;
      line(hubs[node.cluster], p);
    });
    visible.sort((a, b) => b.depth - a.depth);
    if (exploring && (!pointer || pointer.type === 'mouse')) {
      hoverIndex = pick(width / 2, height / 2);
      const target = hoverIndex < 0 ? '' : String(hoverIndex);
      if (gallery.dataset.target !== target) gallery.dataset.target = target;
      if (hoverIndex >= 0 && hoverIndex !== active) setActive(hoverIndex, false);
    }
    const area = p => Math.max(0, Math.min(width, p.x + p.radius) - Math.max(0, p.x - p.radius))
      * Math.max(0, Math.min(height, p.y + p.radius) - Math.max(0, p.y - p.radius));
    const close = visible.filter(p => p.radius > 64).sort((a, b) => area(b) - area(a)).slice(0, 4);
    detailFocus = new Set(close.map(p => p.node.index));
    visible.forEach(p => {
      const { node, x, y, radius: r } = p, selected = node.index === (exploring ? hoverIndex : active);
      const squeeze = 1 + node.hit * .12;
      const glow = selected ? '#e4f4ff' : dateColors[node.index][1];
      ctx.save(); ctx.translate(x, y); ctx.scale(squeeze, 1 / squeeze);
      ctx.globalAlpha = clamp(1.1 - p.depth / 7000, .3, 1);
      const detail = r > 64 ? details.get(node.index) : null, thumbnail = thumbnails.get(node.index);
      const image = detail || thumbnail;
      if (detail) { details.delete(node.index); details.set(node.index, detail); }
      if (image) image.tiles.forEach(tile => {
        const y = -r + tile.y / image.size * r * 2, h = tile.height / image.size * r * 2;
        if (tile.image) ctx.drawImage(tile.image, -r, y, r * 2, h);
        else if (thumbnail) thumbnail.tiles.forEach(low => {
          const start = Math.max(tile.y / image.size * thumbnail.size, low.y);
          const end = Math.min((tile.y + tile.height) / image.size * thumbnail.size, low.y + low.height);
          if (!low.image || end <= start) return;
          ctx.drawImage(low.image, 0, start - low.y, thumbnail.size, end - start,
            -r, -r + start / thumbnail.size * r * 2, r * 2, (end - start) / thumbnail.size * r * 2);
        });
      });
      else { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = 'rgba(82,167,255,.12)'; ctx.fill(); }
      const colors = dateColors[node.index];
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = selected ? 1.6 : 1.1;
      if (!node.dateRange || node.dateRange[0] !== node.dateRange[1]) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      if (node.dateRange && node.dateRange[0] !== node.dateRange[1]) {
        ctx.strokeStyle = colors[1]; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (selected || node.hit > .1) {
        ctx.globalAlpha = selected ? .65 : node.hit;
        ctx.strokeStyle = glow; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.arc(0, 0, r + 4 + node.hit * 6, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    });
    const nextDetail = close.find(p => !details.has(p.node.index) && !failedDetails.has(p.node.index));
    if (nextDetail) requestDetail(nextDetail.node);
    ctx.globalAlpha = 1;
    if (width > 700) {
      ctx.font = '10px Consolas, monospace';
      space.groups.forEach((g, i) => {
        const p = hubs[i];
        if (p.depth <= 100 || p.x < 20 || p.x > width - 20 || p.y < 75 || p.y > height - 40) return;
        const text = `${g.label.toUpperCase()} / ${g.indices.length}`, w = ctx.measureText(text).width;
        const x = clamp(p.x - w / 2, 12, width - w - 12), y = p.y - 35;
        ctx.fillStyle = 'rgba(3,7,14,.94)'; ctx.fillRect(x - 5, y - 11, w + 10, 17);
        ctx.fillStyle = '#b7dce8'; ctx.fillText(text, x, y);
      });
    }
    const c = space.camera;
    const f = basis.forward;
    const heading = Math.abs(f[0]) > Math.abs(f[2]) ? f[0] > 0 ? '+X' : '−X' : f[2] > 0 ? '+Z' : '−Z';
    const now = performance.now();
    if (now - lastHud > 32 || !space.moving) {
      positionReadout.textContent = `POS / ${c.position.map(n => Math.round(n)).join(' · ')}`;
      lookReadout.textContent = `LOOK / ${heading} · ${Math.round(c.yaw * 180 / Math.PI)}°`;
      contactReadout.textContent = `CONTACTS / ${space.contacts}`;
      travelReadout.textContent = String(Math.round(c.travel));
      travelControl.value = String(c.targetTravel);
      impactReadout.textContent = `${c.hardness < .33 ? 'Soft' : c.hardness < .67 ? 'Firm' : 'Hard'} ${Math.round(c.hardness * 100)}%`;
      impactReadout.style.setProperty('--impact-color', `hsl(${190 - c.hardness * 170} 85% 75%)`);
      lastHud = now;
    }
    gallery.dataset.contacts = String(space.contacts);
    gallery.dataset.travel = String(Math.round(c.travel));
    gallery.dataset.impact = c.hardness.toFixed(3);
    gallery.dataset.wheelSpeed = String(Math.round(space.wheel.speed));
    gallery.dataset.wheelBaseline = String(space.wheel.baseline);
    dirty = false;
  }
  function pick(x, y) {
    for (let i = visible.length - 1; i >= 0; i--) {
      const p = visible[i], squeeze = 1 + p.node.hit * .12;
      if (((x - p.x) / (p.radius * squeeze)) ** 2 + ((y - p.y) / (p.radius / squeeze)) ** 2 <= 1) return p.node.index;
    }
    return -1;
  }
  function shouldRun() { return !!ctx && inView && !document.hidden && !isOpen() && (dirty || space.moving); }
  function requestDraw() { if (!raf && shouldRun()) raf = requestAnimationFrame(frame); }
  function frame(time) {
    raf = 0;
    if (!shouldRun()) { lastTime = 0; accumulator = 0; return; }
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time; accumulator += delta;
    while (accumulator >= STEP) { space.step(STEP); accumulator -= STEP; dirty = true; }
    if (dirty) paint();
    requestDraw();
  }
  const mouseClick = event => event.detail > 0 && (event.pointerType || 'mouse') === 'mouse';
  $('[data-network-enter]').addEventListener('click', event => enterNetwork(event.currentTarget, mouseClick(event)));
  $('[data-network-exit]').addEventListener('click', exitNetwork);
  $('[data-network-reset]').addEventListener('click', () => { hoverIndex = -1; space.resetCamera(); dirty = true; requestDraw(); });
  $('[data-gallery-motion]').addEventListener('click', () => { space.ambient = !space.ambient && !media.matches; updateMotion(); dirty = true; requestDraw(); });
  $('[data-network-travel]').addEventListener('input', event => { if (exploring) { hoverIndex = -1; space.setTravel(Number(event.target.value)); requestDraw(); } });
  gallery.addEventListener('wheel', event => {
    if (!exploring || isOpen() || event.ctrlKey || event.target.closest('[data-archive-taxonomy], [data-date-gap-control]')) return;
    event.preventDefault();
    hoverIndex = -1;
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? height : 1;
    space.scroll(-event.deltaY * unit, event.timeStamp);
    requestDraw();
  }, { passive: false });
  gallery.querySelectorAll('[data-network-group]').forEach(button => button.addEventListener('click',
    () => setGrouping(button.dataset.networkGroup, button.dataset.networkGroup === 'time')));
  dateGap.addEventListener('input', queueDateGap);
  dateGap.addEventListener('change', () => {
    if (space.grouping !== 'time') return;
    if (Number(dateGap.value) !== Math.round(space.gapDays * 24)) setGrouping('time', true, false);
    announce(`Maximum gap ${dateGap.getAttribute('aria-valuetext')}. ${space.groups.length} date clusters.`);
  });
  dateGap.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    dateGap.focus({ preventScroll: true });
    gapPointer = event.pointerId;
    dateGap.setPointerCapture(event.pointerId);
    pointDateGap(event);
  });
  dateGap.addEventListener('pointermove', event => { if (gapPointer === event.pointerId) pointDateGap(event); });
  dateGap.addEventListener('pointerup', event => {
    if (gapPointer !== event.pointerId) return;
    pointDateGap(event);
    gapPointer = null;
    dateGap.releasePointerCapture(event.pointerId);
    dateGap.dispatchEvent(new Event('change', { bubbles: true }));
  });
  dateGap.addEventListener('lostpointercapture', () => { gapPointer = null; });
  $('[data-gallery-left]').addEventListener('click', () => stepImage(-1));
  $('[data-gallery-right]').addEventListener('click', () => stepImage(1));

  const months = [...new Set(photos.map(p => p.captured?.slice(0, 7) || 'unknown'))];
  months.forEach(month => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'timeline-btn';
    button.dataset.month = month; button.textContent = month === 'unknown' ? 'Undated' : dateLabel(month, true);
    button.addEventListener('click', () => locate(photos.findIndex(p => (p.captured?.slice(0, 7) || 'unknown') === month)));
    $('[data-gallery-timeline]').append(button);
  });
  photos.forEach((photo, index) => {
    const button = document.createElement('button'); button.type = 'button';
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(3, '0');
    const text = document.createElement('span'), title = document.createElement('strong'), meta = document.createElement('small');
    title.textContent = photo.title; meta.textContent = `${photo.category} · ${dateLabel(photo.captured)}`;
    text.append(title, meta); button.append(number, text);
    button.addEventListener('click', () => openLightbox(index, button));
    $('[data-archive-list]').append(button);
  });
  function trapTab(event, root) {
    const controls = [...root.querySelectorAll('button, input, select, summary, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length && !el.closest('[hidden]'));
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
  gallery.addEventListener('keydown', event => { if (exploring && event.key === 'Tab') trapTab(event, gallery); });
  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', ' ', 'w', 's'].includes(event.key)) event.preventDefault();
    if (!exploring) {
      if (event.key === 'Enter') enterNetwork(stage);
      if (event.key === 'ArrowLeft') locate(active - 1);
      if (event.key === 'ArrowRight') locate(active + 1);
      if (event.key === 'Home') locate(0);
      if (event.key === 'End') locate(photos.length - 1);
      return;
    }
    hoverIndex = -1;
    if (event.key === 'ArrowLeft') space.camera.yaw -= .08;
    if (event.key === 'ArrowRight') space.camera.yaw += .08;
    if (event.key === 'ArrowUp' && event.shiftKey) space.camera.pitch = clamp(space.camera.pitch + .08, -1.4, 1.4);
    else if (event.key === 'ArrowDown' && event.shiftKey) space.camera.pitch = clamp(space.camera.pitch - .08, -1.4, 1.4);
    else if (['ArrowUp', 'w', 'PageUp'].includes(event.key)) space.advance(event.key === 'PageUp' ? 240 : 80);
    else if (['ArrowDown', 's', 'PageDown'].includes(event.key)) space.advance(event.key === 'PageDown' ? -240 : -80);
    if (event.key === 'Home') space.resetCamera();
    if (event.key === 'Enter') openLightbox(active, stage);
    if (event.key === ' ' && !media.matches) { space.ambient = !space.ambient; updateMotion(); }
    dirty = true; requestDraw();
  });
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary) { releasePointer(); return; }
    if (event.button !== 0 || event.target !== canvas) return;
    if (exploring && event.pointerType === 'mouse' && mouseMode === 'released') { captureMouse(); return; }
    pointer = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, lastY: event.clientY,
      yaw: space.camera.yaw, pitch: space.camera.pitch, gesture: '', moved: false, travel: 0 };
  });
  stage.addEventListener('pointermove', event => {
    if (exploring && event.pointerType === 'mouse') {
      let dx = 0, dy = 0;
      if (mouseMode === 'locked') { dx = event.movementX; dy = event.movementY; }
      else if (mouseMode === 'free' && event.target === canvas) {
        if (lastMouse) { dx = event.clientX - lastMouse[0]; dy = event.clientY - lastMouse[1]; }
        lastMouse = [event.clientX, event.clientY];
      } else lastMouse = null;
      if (pointer && pointer.id === event.pointerId && (pointer.travel += Math.abs(dx) + Math.abs(dy)) > 6) pointer.moved = true;
      if (dx || dy) {
        space.camera.yaw += dx * MOUSE_YAW;
        space.camera.pitch = clamp(space.camera.pitch - dy * MOUSE_PITCH, -1.4, 1.4);
        hoverIndex = -1; dirty = true; requestDraw();
      }
      return;
    }
    if (pointer && pointer.id === event.pointerId) {
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (Math.hypot(dx, dy) > 6) pointer.moved = true;
      if (exploring && pointer.moved) {
        hoverIndex = -1;
        if (!pointer.gesture) {
          pointer.gesture = pointer.type === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.25 ? 'travel' : 'look';
          stage.setPointerCapture(event.pointerId); stage.classList.add('dragging');
        }
        if (pointer.gesture === 'travel') space.advance((pointer.lastY - event.clientY) * 3);
        else {
          space.camera.yaw = pointer.yaw + dx / 350;
          space.camera.pitch = clamp(pointer.pitch - dy / 500, -1.4, 1.4);
        }
        pointer.lastY = event.clientY; dirty = true; requestDraw();
      }
    } else if (!exploring && event.target === canvas && event.pointerType !== 'touch') {
      const found = pick(...pointerPoint(event));
      hoverIndex = found;
      canvas.style.cursor = found >= 0 ? 'pointer' : 'zoom-in';
      if (found >= 0 && found !== active) setActive(found, false);
    }
  });
  stage.addEventListener('pointerleave', () => {
    lastMouse = null;
    if (!exploring) { hoverIndex = -1; canvas.style.cursor = 'zoom-in'; }
    dirty = true; requestDraw();
  });
  function endPointer(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (event.type === 'pointerup' && !pointer.moved) {
      if (!exploring && stage.contains(event.target)) enterNetwork(stage, pointer.type === 'mouse');
      else if (exploring && event.target === canvas) {
        // A mouse aims with the center ring; touch and pen open what they tap.
        const found = pointer.type === 'mouse' ? pick(width / 2, height / 2) : pick(...pointerPoint(event));
        if (found >= 0) openLightbox(found, stage);
      }
    }
    releasePointer();
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', () => { releasePointer(); lastMouse = null; });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      lockWorked = true;
      if (exploring && !isOpen()) setMouseMode('locked'); else releaseMouse();
    } else {
      if (exploring && (mouseMode === 'locked' || mouseMode === 'pending')) {
        setMouseMode('released');
        if (!ownRelease) announce('Mouse released. Click the view to aim again, or press Escape to exit.');
      }
      ownRelease = false;
    }
  });
  document.addEventListener('pointerlockerror', mouseLockFailed);
  closeButton.addEventListener('click', event => closeLightbox(event.detail > 0));
  lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => stepImage(-1));
  lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => stepImage(1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(event.detail > 0); });
  document.addEventListener('keydown', event => {
    if (isOpen()) {
      if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); stepImage(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); stepImage(1); }
      if (event.key === 'Tab') trapTab(event, lightbox);
    } else if (exploring && event.key === 'Escape') {
      event.preventDefault();
      // Browsers usually consume Escape to end pointer lock; when it reaches the page, it frees the mouse first.
      if (document.pointerLockElement === canvas) document.exitPointerLock(); else exitNetwork();
    }
  });
  media.addEventListener('change', () => {
    space.reducedMotion = media.matches;
    if (media.matches) {
      space.ambient = false;
      if (!exploring) space.setGrouping(space.grouping, space.gapDays, true);
    }
    updateMotion(); dirty = true; requestDraw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { space.stopTravel(); releasePointer(); lastMouse = null; }
    else if (textureJobs.length && !textureFrame) textureFrame = requestAnimationFrame(prepareTextures);
    lastTime = 0; accumulator = 0; requestDraw();
  });
  new ResizeObserver(resize).observe(canvas);
  let loadingStarted = false;
  function loadImages() {
    if (loadingStarted || !ctx) return;
    loadingStarted = true;
    let next = 0;
    function loadNext() {
      if (next >= photos.length) return;
      const index = next++, image = new Image(); image.decoding = 'async';
      image.onload = () => glassTexture(image, 256, (texture, complete) => {
        if (!complete) return;
        if (texture) thumbnails.set(index, texture);
        finish(!texture);
      });
      image.onerror = () => finish(true);
      image.src = photos[index].thumb;
    }
    function finish(error) {
      loaded++; if (error) failed++;
      $('[data-archive-load]').textContent = loaded === photos.length
        ? failed ? `${failed} thumbnails unavailable. Use the list for originals.` : `${photos.length} photo bubbles / network ready`
        : `Loading captures / ${loaded} of ${photos.length}`;
      gallery.dataset.loaded = String(loaded); dirty = true; requestDraw(); loadNext();
    }
    for (let i = 0; i < 6; i++) loadNext();
  }
  new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadImages(); }, { rootMargin: '300px' }).observe(gallery);
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; lastTime = 0; accumulator = 0;
    if (inView) { dirty = true; requestDraw(); }
  }, { threshold: .01 }).observe(stage);
  if (!ctx) {
    $('[data-archive-browser]').open = true;
    $('[data-archive-load]').textContent = 'Canvas unavailable. Browse the capture list below.';
    gallery.querySelectorAll('[data-network-group], [data-network-enter], [data-network-reset], [data-date-gap]')
      .forEach(button => { button.disabled = true; });
  }
  updateDateGap();
  $('[data-date-gap-end]').textContent = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(space.dateExtent[1]);
  buildClusters(); setActive(0); updateMotion(); resize();
})();
