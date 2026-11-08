/* Run in the rendered local page using Playwright evaluate or agent-browser eval. */
(async () => {
  const gallery = document.querySelector('[data-memory-gallery]');
  const $ = selector => gallery.querySelector(selector);
  const canvas = $('[data-archive-canvas]'), stage = $('[data-gallery-stage]');
  const lightbox = document.querySelector('[data-lightbox]');
  const checks = [];
  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFor = async predicate => {
    for (let i = 0; i < 180; i++) { await frame(); if (predicate()) return; }
    throw new Error('Rendered scene did not reach the expected state');
  };
  const paint = async () => { await frame(); await frame(); await frame(); };
  const angle = () => Number($('[data-look-readout]').textContent.match(/·\s*(-?\d+)°/)[1]);
  const mode = () => gallery.dataset.mouse || '';
  const shown = selector => getComputedStyle($(selector)).display !== 'none';
  const pointerEvent = (type, x, y, extra = {}) => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y, ...extra
  }));
  const press = key => document.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
  const mouseClick = element => element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
  // Synthetic events carry no user activation, so the browser's real lock is replaced for this run.
  let locked = null, lockAvailable = true;
  const lockChanged = () => queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
  Object.defineProperty(document, 'pointerLockElement', {configurable: true, get: () => locked});
  document.exitPointerLock = () => { if (locked) { locked = null; lockChanged(); } };
  canvas.requestPointerLock = () => {
    if (!lockAvailable) return Promise.reject(new DOMException('Pointer lock unavailable', 'NotSupportedError'));
    locked = canvas; lockChanged(); return Promise.resolve();
  };
  try {
    if (lightbox.classList.contains('open')) lightbox.querySelector('[data-lightbox-close]').click();
    if (gallery.classList.contains('is-exploring')) $('[data-network-exit]').click();
    assert(!$('.archive-focus'), 'Selected-capture overlay removed');
    assert(!$('.network-summary'), 'Cluster-count strip removed');
    mouseClick($('[data-network-enter]')); await paint();
    assert(mode() === 'locked' && document.pointerLockElement === canvas, 'Entering with a mouse click captures the mouse');
    assert(shown('.network-crosshair') && getComputedStyle(canvas).cursor === 'none' && !shown('.network-aim-hint'),
      'While captured, the only aim marker is the centered ring');
    await waitFor(() => gallery.dataset.wheelBaseline === '240');
    if ($('[data-gallery-motion]').getAttribute('aria-pressed') === 'true') $('[data-gallery-motion]').click();
    $('[data-network-reset]').click(); await paint();
    const rect = canvas.getBoundingClientRect(), fixedX = rect.left + rect.width * .35, fixedY = rect.top + rect.height * .6;
    const dx = Math.min(120, rect.width * .2);
    const before = angle();
    pointerEvent('pointermove', fixedX, fixedY, {movementX: dx}); await paint();
    const turn = angle() - before;
    assert(Math.abs(turn - dx * .0086 * 180 / Math.PI) <= 1, 'Captured mouse movement turns the view while the cursor position stays fixed');
    assert(turn > dx / 350 * 180 / Math.PI * 2.5, 'Mouse look stays at least 2.5 times faster than the old drag look');
    pointerEvent('pointermove', fixedX, fixedY, {movementY: -60}); await paint();
    $('[data-network-reset]').click(); $('[data-gallery-right]').click();
    await waitFor(() => gallery.dataset.target !== undefined && gallery.dataset.target !== '');
    const target = gallery.dataset.target;
    const corner = [rect.left + 24, rect.bottom - 24];
    pointerEvent('pointerdown', ...corner, {buttons: 1}); pointerEvent('pointerup', ...corner);
    assert(lightbox.classList.contains('open'), 'Clicking while captured opens the ringed bubble');
    assert(lightbox.querySelector('[data-lightbox-caption]').textContent.startsWith(PORTFOLIO_ARCHIVE[Number(target)].title + ' ·'),
      'The click opens the capture under the center ring, not under the hidden cursor');
    await frame();
    assert(document.pointerLockElement === null, 'Opening the viewer frees the mouse');
    mouseClick(lightbox.querySelector('[data-lightbox-close]')); await paint();
    assert(!lightbox.classList.contains('open') && mode() === 'locked', 'Closing the viewer with a click recaptures the mouse');
    press('Escape'); await paint();
    assert(mode() === 'released' && gallery.classList.contains('is-exploring'), 'First Escape frees the mouse and keeps the network open');
    assert(/Mouse released/.test($('[data-archive-selection]').textContent), 'Releasing the mouse is announced');
    assert(getComputedStyle(canvas).cursor === 'pointer' && (!matchMedia('(hover: hover) and (pointer: fine)').matches || shown('.network-aim-hint')),
      'A freed mouse shows its cursor and a click-to-aim hint');
    const resting = angle();
    pointerEvent('pointermove', fixedX + 80, fixedY, {movementX: 80}); await paint();
    assert(angle() === resting, 'A freed mouse can reach the controls without turning the view');
    pointerEvent('pointerdown', ...corner, {buttons: 1}); pointerEvent('pointerup', ...corner); await paint();
    assert(mode() === 'locked' && !lightbox.classList.contains('open'), 'Clicking the view recaptures the mouse without opening a capture');
    press('Escape'); await paint(); press('Escape'); await paint();
    assert(!gallery.classList.contains('is-exploring'), 'Second Escape exits the network');
    $('[data-network-enter]').click(); await paint();
    assert(mode() === 'released' && document.pointerLockElement === null, 'Keyboard entry leaves the mouse free');
    stage.focus(); stage.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true})); await paint();
    assert(shown('.network-crosshair') && gallery.dataset.target !== undefined, 'Keyboard aiming uses the same centered ring');
    press('Escape'); await paint();
    assert(!gallery.classList.contains('is-exploring'), 'Escape exits directly when the mouse is not captured');
    lockAvailable = false;
    mouseClick($('[data-network-enter]')); await paint();
    assert(mode() === 'free' && getComputedStyle(canvas).cursor === 'none' && shown('.network-crosshair'),
      'Without pointer lock, the cursor hides and the center ring still aims');
    $('[data-network-reset]').click(); await paint();
    pointerEvent('pointermove', fixedX, fixedY); await paint();
    const free = angle();
    pointerEvent('pointermove', fixedX + dx, fixedY); await paint();
    assert(Math.abs(angle() - free - dx * .0086 * 180 / Math.PI) <= 1, 'Without pointer lock, mouse motion still turns the view');
    $('[data-network-travel]').dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse', clientX: 5, clientY: 5}));
    const paused = angle();
    pointerEvent('pointermove', rect.left + rect.width * .8, fixedY); await paint();
    assert(angle() === paused, 'Returning from controls does not jump the camera');
    $('[data-network-reset]').click(); $('[data-gallery-right]').click();
    await waitFor(() => gallery.dataset.target !== undefined && gallery.dataset.target !== '');
    const freeTarget = gallery.dataset.target;
    pointerEvent('pointerdown', ...corner, {buttons: 1}); pointerEvent('pointerup', ...corner);
    assert(lightbox.classList.contains('open') && lightbox.querySelector('[data-lightbox-caption]').textContent
      .startsWith(PORTFOLIO_ARCHIVE[Number(freeTarget)].title + ' ·'), 'Without pointer lock, a click still opens the ringed bubble');
    lightbox.querySelector('[data-lightbox-close]').click(); await paint();
    lockAvailable = true;
    const wheel = (delta, time, ctrlKey = false) => {
      const event = new WheelEvent('wheel', {deltaY: delta, deltaMode: 0, ctrlKey, bubbles: true, cancelable: true});
      Object.defineProperty(event, 'timeStamp', {value: time});
      canvas.dispatchEvent(event); return event;
    };
    $('[data-network-reset]').click();
    for (let i = 0; i < 8; i++) wheel(37.5, 1000 + i * 166);
    for (let i = 0; i < 12; i++) await frame();
    const soft = Number(gallery.dataset.impact);
    assert(soft < .05, 'Measured gentle wheel cadence stays soft');
    assert(Math.abs(Number(gallery.dataset.wheelSpeed) - 226) < 4, 'Wheel intensity uses cadence and normalized distance');
    $('[data-network-reset]').click();
    for (let i = 0; i < 8; i++) wheel(37.5, 5000 + i * 20);
    await waitFor(() => Number(gallery.dataset.impact) > .9);
    assert(Number(gallery.dataset.impact) > soft + .85, 'Same wheel ticks at fast cadence produce hard impacts');
    const forward = Number(gallery.dataset.travel);
    wheel(-40, 5500); await paint();
    assert(forward < 0 && Number(gallery.dataset.travel) > forward, 'Wheel down travels backward; wheel up immediately reverses queued travel forward');
    $('[data-network-reset]').click(); await paint();
    assert(!wheel(100, 7000, true).defaultPrevented, 'Control-wheel remains available to the browser');
    $('[data-network-group="time"]').click();
    assert(!$('[data-time-legend]').hidden && $('[data-time-start]').textContent && $('[data-time-end]').textContent,
      'Capture-date gradient has an oldest-to-newest legend');
    for (const [gap, expected] of [['6', 59], ['24', 39], ['72', 22], ['168', 14], ['336', 10], ['720', 7]]) {
      $('[data-date-gap]').value = gap;
      $('[data-date-gap]').dispatchEvent(new Event('input', {bubbles: true}));
      await paint();
      assert(Number(gallery.dataset.clusters) === expected, `Date gap ${gap} hours preserves ${expected} evidence-based groups`);
    }
    $('[data-date-gap]').value = '1';
    $('[data-date-gap]').dispatchEvent(new Event('input', {bubbles: true}));
    $('[data-network-group="activity"]').click();
    assert(Number(gallery.dataset.clusters) === 7, 'Activity grouping still contains all seven categories');
    $('[data-network-reset]').click();
    return {passed: checks.length, mousePixels: dx, yawDegrees: turn, checks};
  } finally {
    if (gallery.classList.contains('is-exploring')) $('[data-network-exit]').click();
    delete document.pointerLockElement; delete document.exitPointerLock; delete canvas.requestPointerLock;
  }
})()
