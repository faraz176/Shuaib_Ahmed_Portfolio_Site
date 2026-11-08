/* Run in the rendered local page using Playwright evaluate or agent-browser eval. */
(async () => {
  const gallery = document.querySelector('[data-memory-gallery]');
  const $ = selector => gallery.querySelector(selector), checks = [];
  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const paint = async () => { await frame(); await frame(); await frame(); };
  const input = $('[data-date-gap]');
  assert(input.tagName === 'INPUT' && input.type === 'range', 'Date proximity uses an hourly range slider');
  const photos = window.PORTFOLIO_ARCHIVE;
  const precise = photos.filter(p => p.captured?.length > 7).map(p =>
    Date.parse(p.captured.length === 10 ? `${p.captured}T12:00:00Z` : `${p.captured}Z`)).sort((a, b) => a - b);
  const months = new Set(photos.filter(p => p.captured?.length === 7).map(p => p.captured));
  const unknown = photos.filter(p => !p.captured).length;
  const bounds = photos.flatMap(p => {
    if (!p.captured) return [];
    if (p.captured.length !== 7) return [Date.parse(p.captured.length === 10
      ? `${p.captured}T12:00:00Z` : `${p.captured}Z`)];
    const [year, month] = p.captured.split('-').map(Number);
    return [Date.UTC(year, month - 1, 1), Date.UTC(year, month, 1) - 1];
  });
  const maxHours = Math.max(1, Math.ceil((Math.max(...bounds) - Math.min(...bounds)) / 3600000));
  const expected = hours => precise.reduce((n, time, i) =>
    n + (!i || time - precise[i - 1] > hours * 3600000 ? 1 : 0), months.size + (unknown ? 1 : 0));
  assert(input.min === '1' && input.step === '1', 'Minimum and resolution are both exactly one hour');
  assert(Number(input.max) === maxHours, 'Maximum covers the real archive through its latest captured date');
  assert(getComputedStyle($('[data-date-gap-track]')).backgroundImage.includes('linear-gradient'),
    'The slider track displays the date-color gradient');
  const lightbox = document.querySelector('[data-lightbox]');
  if (lightbox.classList.contains('open')) lightbox.querySelector('[data-lightbox-close]').click();
  if (!gallery.classList.contains('is-exploring')) $('[data-network-enter]').click();
  if ($('[data-gallery-motion]').getAttribute('aria-pressed') === 'true') $('[data-gallery-motion]').click();
  $('[data-network-group="time"]').click();
  assert(!$('[data-date-gap-control]').hidden, 'Date mode reveals the slider');
  const original = NetworkArchive.prototype.setGrouping, layouts = [];
  NetworkArchive.prototype.setGrouping = function (...args) {
    const result = original.apply(this, args);
    layouts.push({ hours: this.gapDays * 24, immediate: args[2],
      settled: this.nodes.every(n => n.position.every((v, k) => Math.abs(v - n.anchor[k]) < .001)) });
    return result;
  };
  const change = async hours => {
    input.value = String(hours);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await paint();
    assert(Number(gallery.dataset.gapHours) === hours, `${hours} hours updates on input, without waiting for release`);
    assert(Number(gallery.dataset.clusters) === expected(hours), `${hours} hours preserves consecutive-gap grouping`);
    const counts = [...$('[data-archive-taxonomy]').querySelectorAll('b')].map(el => Number(el.textContent));
    assert(counts.reduce((a, b) => a + b, 0) === photos.length, `${hours} hours keeps every capture`);
  };
  try {
    for (const hours of [1, 2, 3, 6, 24, 72, 168, 336, 720, maxHours]) await change(hours);
    assert(Number(gallery.dataset.clusters) === 1 + months.size + (unknown ? 1 : 0),
      'Full-span endpoint joins all precisely dated captures, without inventing month-only or unknown times');
    assert(input.getAttribute('aria-valuetext').includes('Full archive'), 'The maximum has an accessible full-archive description');
    assert(layouts.length > 0 && layouts.every(l => l.immediate && l.settled),
      'Live slider changes apply settled bubble layouts immediately, not the old slow morph');
    await change(1);
    assert(Number.parseFloat($('[data-date-gap-control]').style.getPropertyValue('--gap-position')) === 0,
      'One hour places the thumb at the start of the gradient');
    await change(3);
    const position = Number.parseFloat($('[data-date-gap-control]').style.getPropertyValue('--gap-position'));
    assert(position > 5 && position < 40, 'The lower end gives one-to-three-hour gaps useful pointer travel');
    const before = layouts.length;
    for (const value of [2, 3, 2, 3]) {
      input.value = String(value); input.dispatchEvent(new Event('input', {bubbles: true}));
    }
    await paint();
    assert(layouts.length <= before + 1 && Number(gallery.dataset.gapHours) === 3,
      'Rapid input is coalesced to one regroup per frame and keeps the latest value');
    $('[data-network-group="activity"]').click();
    assert($('[data-date-gap-control]').hidden && Number(gallery.dataset.clusters) === 7,
      'Activity mode hides the date slider and retains all seven categories');
    $('[data-network-group="time"]').click();
    assert(Number(input.value) === 3 && Number(gallery.dataset.gapHours) === 3,
      'Returning to date mode preserves the selected hourly gap');
    return {passed: checks.length, maxHours, firstHourGroups: expected(1), secondHourGroups: expected(2),
      thirdHourGroups: expected(3), checks};
  } finally {
    NetworkArchive.prototype.setGrouping = original;
  }
})()
