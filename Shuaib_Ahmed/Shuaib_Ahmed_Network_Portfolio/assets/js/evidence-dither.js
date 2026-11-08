/* Lab report evidence as dithered phosphor captures: a four-level duotone with a 4x4 Bayer threshold, in the
   site palette, under fixed scanlines. Each image links to its original; hover, keyboard focus, or opening it
   shows the source colors. Without this script the images stay untouched. */
(() => {
  'use strict';
  const images = [...document.querySelectorAll('figure.figure > img')];
  const previews = [...document.querySelectorAll('.lab-card > img')];
  if (!images.length && !previews.length) return;
  // Report evidence keeps its original colors; only homepage previews use phosphor dither.
  for (const img of images) {
    if (img.parentElement.matches('a.evidence-link')) continue;
    const link = document.createElement('a');
    link.className = 'evidence-link'; link.href = img.src; link.target = '_blank'; link.rel = 'noopener';
    img.replaceWith(link); link.append(img);
  }
  if (!previews.length) return;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const cells = BAYER.map((v, i) => {
    const level = Math.round((v + .5) / 16 * 255);
    return `<rect x="${i % 4 * 2}" y="${(i >> 2) * 2}" width="2" height="2" fill="rgb(${level},${level},${level})"/>`;
  }).join('');
  const tile = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" shape-rendering="crispEdges">${cells}</svg>`);
  const inkMatrix = () => {
    const hex = (getComputedStyle(document.documentElement).getPropertyValue('--crt-ink').trim().match(/^#([0-9a-f]{6})$/i) || [, '004cff'])[1];
    const [r, g, b] = [0, 2, 4].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255 * .9).toFixed(3));
    return `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`;
  };
  const steps = '0 .3333 .6667 1';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  // Luminance at 85% (so white pages dither into dots instead of a solid field), plus a quarter-step Bayer bias,
  // posterized to four levels, then tinted with the palette ink at 90%.
  svg.innerHTML = `<filter id="sa-transmitter" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values=".1807 .6079 .0614 0 0 .1807 .6079 .0614 0 0 .1807 .6079 .0614 0 0 0 0 0 1 0" result="tone"/>
    <feImage href="${tile}" x="0" y="0" width="8" height="8" result="cell"/>
    <feTile in="cell" result="bayer"/>
    <feComposite in="tone" in2="bayer" operator="arithmetic" k2=".75" k3=".25" result="biased"/>
    <feComponentTransfer in="biased"><feFuncR type="discrete" tableValues="${steps}"/><feFuncG type="discrete" tableValues="${steps}"/><feFuncB type="discrete" tableValues="${steps}"/></feComponentTransfer>
    <feColorMatrix type="matrix" values="${inkMatrix()}"/>
  </filter>`;
  document.body.append(svg);
  document.addEventListener('crt-color-change',()=>svg.querySelector('feColorMatrix:last-of-type').setAttribute('values',inkMatrix()));
  new MutationObserver(() => svg.querySelector('feColorMatrix:last-of-type').setAttribute('values', inkMatrix()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette'] });
  document.documentElement.classList.add('evidence-dither');
})();
