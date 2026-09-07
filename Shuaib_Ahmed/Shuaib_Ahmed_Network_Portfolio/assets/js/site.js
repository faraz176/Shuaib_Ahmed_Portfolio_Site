const photos = [
  {
    "src": "assets/photos/field-01.jpg",
    "thumb": "assets/photos/thumbs/field-01.jpg",
    "caption": "Data-center rack hardware and installed network infrastructure.",
    "category": "data-center"
  },
  {
    "src": "assets/photos/field-02.jpg",
    "thumb": "assets/photos/thumbs/field-02.jpg",
    "caption": "Rack-level cabling and physical infrastructure inspection.",
    "category": "data-center"
  },
  {
    "src": "assets/photos/field-03.jpg",
    "thumb": "assets/photos/thumbs/field-03.jpg",
    "caption": "On-site equipment-room infrastructure and deployment environment.",
    "category": "field-ops"
  },
  {
    "src": "assets/photos/field-04.jpg",
    "thumb": "assets/photos/thumbs/field-04.jpg",
    "caption": "Network equipment staging and rack-level connectivity work.",
    "category": "data-center"
  },
  {
    "src": "assets/photos/field-05.jpg",
    "thumb": "assets/photos/thumbs/field-05.jpg",
    "caption": "Physical-layer troubleshooting in an active infrastructure environment.",
    "category": "data-center"
  },
  {
    "src": "assets/photos/field-06.jpg",
    "thumb": "assets/photos/thumbs/field-06.jpg",
    "caption": "Endpoint deployment staging and hardware preparation.",
    "category": "deployment"
  },
  {
    "src": "assets/photos/field-07.jpg",
    "thumb": "assets/photos/thumbs/field-07.jpg",
    "caption": "Printer hardware inspection during field support work.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-08.jpg",
    "thumb": "assets/photos/thumbs/field-08.jpg",
    "caption": "Printer deployment and endpoint troubleshooting.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-09.jpg",
    "thumb": "assets/photos/thumbs/field-09.jpg",
    "caption": "Printer hardware service and validation.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-10.jpg",
    "thumb": "assets/photos/thumbs/field-10.jpg",
    "caption": "Printer hardware service and validation.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-11.jpg",
    "thumb": "assets/photos/thumbs/field-11.jpg",
    "caption": "Printer hardware inspection and component verification.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-12.jpg",
    "thumb": "assets/photos/thumbs/field-12.jpg",
    "caption": "Printer media-path inspection during troubleshooting.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-13.jpg",
    "thumb": "assets/photos/thumbs/field-13.jpg",
    "caption": "Printer component orientation and installation check.",
    "category": "endpoint"
  },
  {
    "src": "assets/photos/field-14.jpg",
    "thumb": "assets/photos/thumbs/field-14.jpg",
    "caption": "Ethernet cable preparation for physical-layer repair.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-15.jpg",
    "thumb": "assets/photos/thumbs/field-15.jpg",
    "caption": "Structured-cabling identification and cable inspection.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-16.jpg",
    "thumb": "assets/photos/thumbs/field-16.jpg",
    "caption": "Ethernet-pair separation before termination.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-17.jpg",
    "thumb": "assets/photos/thumbs/field-17.jpg",
    "caption": "RJ45 termination tooling used during field work.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-18.jpg",
    "thumb": "assets/photos/thumbs/field-18.jpg",
    "caption": "RJ45 crimping tool prepared for cable termination.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-19.jpg",
    "thumb": "assets/photos/thumbs/field-19.jpg",
    "caption": "Cable termination workflow and connector preparation.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-20.jpg",
    "thumb": "assets/photos/thumbs/field-20.jpg",
    "caption": "Cable repair workflow using field termination tools.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-21.jpg",
    "thumb": "assets/photos/thumbs/field-21.jpg",
    "caption": "Cable-pair preparation and physical-layer repair.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-22.jpg",
    "thumb": "assets/photos/thumbs/field-22.jpg",
    "caption": "Twisted-pair Ethernet conductors exposed for termination.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-23.jpg",
    "thumb": "assets/photos/thumbs/field-23.jpg",
    "caption": "Twisted-pair Ethernet cable repair and inspection.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-24.jpg",
    "thumb": "assets/photos/thumbs/field-24.jpg",
    "caption": "Ethernet cable-pair preparation for termination.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-25.jpg",
    "thumb": "assets/photos/thumbs/field-25.jpg",
    "caption": "Field termination tool used for network-cabling work.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-26.jpg",
    "thumb": "assets/photos/thumbs/field-26.jpg",
    "caption": "Ethernet conductors organized before connector installation.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-27.jpg",
    "thumb": "assets/photos/thumbs/field-27.jpg",
    "caption": "Cable inventory and field-deployment preparation.",
    "category": "cabling"
  },
  {
    "src": "assets/photos/field-28.jpg",
    "thumb": "assets/photos/thumbs/field-28.jpg",
    "caption": "Switch-port and cable-path inspection during troubleshooting.",
    "category": "switching"
  }
  ,{
    "src": "assets/photos/field-29.jpg",
    "thumb": "assets/photos/thumbs/field-29.jpg",
    "caption": "On-site network infrastructure work alongside active switching equipment and rack-level cabling.",
    "category": "switching"
  }
];

const rail = document.querySelector('[data-gallery-rail]');
const filters = [...document.querySelectorAll('[data-filter]')];
const lightbox = document.querySelector('[data-lightbox]');
const lightboxImage = document.querySelector('[data-lightbox-image]');
const lightboxCaption = document.querySelector('[data-lightbox-caption]');
const lightboxClose = document.querySelector('[data-lightbox-close]');
let lightboxTrigger = null;

function renderGallery(filter = 'all') {
  if (!rail) return;
  const selected = photos.filter(photo => filter === 'all' || photo.category === filter);
  rail.innerHTML = selected.map(photo => `
    <figure class="photo-card" tabindex="0" role="button" aria-label="Open field-work image: ${photo.caption}" data-src="${photo.src}" data-caption="${photo.caption}">
      <img src="${photo.thumb}" alt="${photo.caption}" loading="lazy" decoding="async">
      <figcaption><span class="photo-kicker">${photo.category.replace('-', ' ')}</span>${photo.caption}</figcaption>
    </figure>`).join('');
  [...rail.querySelectorAll('.photo-card')].forEach(card => {
    const open = () => openLightbox(card.dataset.src, card.dataset.caption, card);
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}
function openLightbox(src, caption, trigger) {
  lightboxTrigger = trigger;
  lightboxImage.src = src; lightboxImage.alt = caption; lightboxCaption.textContent = caption;
  lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  lightboxClose?.focus();
}
function closeLightbox() {
  if (!lightbox?.classList.contains('open')) return;
  lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; lightboxImage.src = '';
  lightboxTrigger?.focus(); lightboxTrigger = null;
}
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(item => item.classList.remove('active')); button.classList.add('active'); renderGallery(button.dataset.filter);
}));
document.querySelector('[data-gallery-left]')?.addEventListener('click', () => rail.scrollBy({left:-640, behavior:'smooth'}));
document.querySelector('[data-gallery-right]')?.addEventListener('click', () => rail.scrollBy({left:640, behavior:'smooth'}));
lightboxClose?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'Tab' && lightbox?.classList.contains('open')) {
    event.preventDefault();
    lightboxClose?.focus();
  }
});
if (rail) {
  let down=false, startX=0, initial=0;
  rail.addEventListener('wheel', event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); rail.scrollLeft += event.deltaY; } }, {passive:false});
  rail.addEventListener('pointerdown', event => { down=true; startX=event.clientX; initial=rail.scrollLeft; rail.classList.add('dragging'); rail.setPointerCapture(event.pointerId); });
  rail.addEventListener('pointermove', event => { if (!down) return; rail.scrollLeft = initial - (event.clientX-startX); });
  rail.addEventListener('pointerup', () => { down=false; rail.classList.remove('dragging'); });
  rail.addEventListener('pointercancel', () => { down=false; rail.classList.remove('dragging'); });
}
renderGallery();
