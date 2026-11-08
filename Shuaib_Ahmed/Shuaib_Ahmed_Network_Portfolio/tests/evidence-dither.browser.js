/* Run in a rendered lab report (labs/*.html) using Playwright evaluate or agent-browser eval.
   Hover and keyboard focus need real input, so the runner checks those separately (see README_DEPLOY.md). */
(() => {
  const checks = [];
  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const figures = [...document.querySelectorAll('figure.figure')];
  const images = figures.map(f => f.querySelector('img:not(.tv-housing)'));
  assert(figures.length > 0, `The report has evidence figures (${figures.length})`);
  assert(!document.documentElement.classList.contains('evidence-dither'), 'Report images retain their original colors');
  /* The homepage alone uses the optional dither filter. */
  const filter = document.getElementById('sa-transmitter');
  if (filter) {
  assert(filter instanceof SVGFilterElement && filter.closest('svg').getAttribute('aria-hidden') === 'true', 'One hidden SVG filter defines the dither');
  const tile = filter.querySelector('feImage').getAttribute('href');
  const levels = [...decodeURIComponent(tile).matchAll(/rgb\((\d+),/g)].map(m => +m[1]).sort((a, b) => a - b);
  assert(levels.length === 16 && new Set(levels).size === 16 && levels[0] < 16 && levels[15] > 239, 'The threshold tile holds all 16 Bayer levels');
  assert([...filter.querySelectorAll('feComponentTransfer > *')].every(f => f.getAttribute('type') === 'discrete' && f.getAttribute('tableValues').split(' ').length === 4), 'Tones are posterized to four levels');
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--crt-ink').trim();
  const tintValues = filter.querySelector('feColorMatrix:last-of-type').getAttribute('values').split(' ').map(Number);
  const expected = [1, 3, 5].map(i => parseInt(ink.slice(i, i + 2), 16) / 255 * .9);
  assert([tintValues[0], tintValues[6], tintValues[12]].every((v, i) => Math.abs(v - expected[i]) < .002), `The duotone ink follows the site palette (${ink})`);
  }
  assert(images.every(img => { const a = img.parentElement; return a.matches('a.evidence-link') && a.href === img.src && a.target === '_blank' && a.rel === 'noopener'; }), 'Every evidence image links to its own original');
  assert(images.every(img => img.alt.trim().length > 8), 'Each link is named by its image description');
  assert(images.every(img => getComputedStyle(img).filter === 'none'), 'Every report image is unfiltered');
  assert(figures.every(f => f.querySelector('figcaption') === null || f.querySelector('figcaption').parentElement === f), 'Captions stay outside the dither');
  return { passed: checks.length, checks, count: figures.length };
})();
