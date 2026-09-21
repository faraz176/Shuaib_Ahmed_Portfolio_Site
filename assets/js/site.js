const photos = Array.from({ length: 29 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    src: `assets/photos/field-${number}.jpg`,
    thumb: `assets/photos/thumbs/field-${number}.jpg`,
    label: `Field work photo ${index + 1} of 29`
  };
});

const rail = document.querySelector('[data-gallery-rail]');
const lightbox = document.querySelector('[data-lightbox]');
const lightboxImage = document.querySelector('[data-lightbox-image]');
const lightboxClose = document.querySelector('[data-lightbox-close]');
let lightboxTrigger = null;

function openLightbox(photo, trigger) {
  lightboxTrigger = trigger;
  lightboxImage.src = photo.src;
  lightboxImage.alt = photo.label;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function closeLightbox() {
  if (!lightbox?.classList.contains('open')) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  lightboxImage.removeAttribute('src');
  lightboxTrigger?.focus();
  lightboxTrigger = null;
}

if (rail) {
  photos.forEach(photo => {
    const button = document.createElement('button');
    button.className = 'photo-card';
    button.type = 'button';
    button.setAttribute('aria-label', `Open ${photo.label}`);
    const image = document.createElement('img');
    image.src = photo.thumb;
    image.alt = photo.label;
    image.loading = 'lazy';
    image.decoding = 'async';
    button.append(image);
    button.addEventListener('click', () => openLightbox(photo, button));
    rail.append(button);
  });

  document.querySelector('[data-gallery-left]')?.addEventListener('click', () => rail.scrollBy({ left: -640, behavior: 'smooth' }));
  document.querySelector('[data-gallery-right]')?.addEventListener('click', () => rail.scrollBy({ left: 640, behavior: 'smooth' }));
  rail.addEventListener('wheel', event => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      rail.scrollLeft += event.deltaY;
    }
  }, { passive: false });
}

lightboxClose?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', event => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'Tab' && lightbox?.classList.contains('open')) {
    event.preventDefault();
    lightboxClose.focus();
  }
});
