/* A photographic CRT/VCR housing around the hero portrait. The screen aperture remains interactive. */
(() => {
  if (document.body.classList.contains('dos-home')) return;
  const asset = new URL('../img/crt-tv-housing.png', document.currentScript.src).href;
  for (const element of document.querySelectorAll('.crt-portrait')) {
    element.classList.add('physical-tv');
    const image = document.createElement('img');
    image.src = asset; image.alt = ''; image.className = 'tv-housing'; image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    element.append(image);
  }
})();
