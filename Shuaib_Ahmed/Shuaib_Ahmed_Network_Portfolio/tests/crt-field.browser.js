/* Run on index.html with Playwright page.evaluate. Restores saved palette and Signal choices. */
(async () => {
  const checks = [], assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async f => { for (let i=0; i<100 && !f(); i++) await wait(30); return f(); };
  const field = window.crtField, crt = window.crtPortrait;
  const saved = { signal: localStorage.getItem('sa-wave-signal'), palette: localStorage.getItem('sa-palette'), color: crt.palette };
  assert(field && await until(() => !!field.gpu), 'The shared phosphor field builds and draws');
  assert(field.canvas.getAttribute('aria-hidden') === 'true' && getComputedStyle(field.canvas).pointerEvents === 'none', 'The field is decorative and cannot intercept links or selection');
  assert(field.canvas.width === Math.ceil(innerWidth/3) && field.canvas.height === Math.ceil(innerHeight/3), 'The field uses one backing pixel per 3 CSS px');
  assert(getComputedStyle(document.querySelector('main')).filter === 'none', 'The readable HTML has no distortion filter');
  const shape = () => [...document.querySelectorAll('h1,.hero-subtitle,.lab-card')].slice(0,5).map(e => {
    const r=e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];
  });
  const pixels = t => {
    field.clock=t; field.draw();
    const p=new Uint8Array(field.canvas.width*field.canvas.height*4);
    field.gl.readPixels(0,0,field.canvas.width,field.canvas.height,field.gl.RGBA,field.gl.UNSIGNED_BYTE,p);
    return p;
  };
  try {
    field.setMotion('off');
    const before=shape(), a=pixels(0), b=pixels(2);
    let changed=0, blue=0;
    for(let i=0;i<a.length;i+=4) { changed += Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>20; blue+=a[i+2]>a[i]+20; }
    assert(changed/(a.length/4)>.08, 'Broad signal waves visibly move throughout the page background');
    assert(blue/(a.length/4)>.15, 'The field contains a visible electric-blue phosphor pattern');
    assert(JSON.stringify(before) === JSON.stringify(shape()), 'Moving the field leaves text and card positions unchanged');
    field.button.click(); await wait(100);
    assert(field.canvas.dataset.signal === 'running' && !crt.still(), 'The global Signal control starts both the field and portrait');
    field.button.click(); await wait(100);
    const stopped=field.clock;
    await wait(150);
    assert(field.canvas.dataset.signal === 'still' && crt.still() && field.clock === stopped, 'Signal off freezes both effects');
    assert(localStorage.getItem('sa-wave-signal') === 'off' && document.documentElement.classList.contains('crt-motion-off'), 'Signal off is saved and also stops the CSS refresh band');
    assert(field.button.getAttribute('aria-label').toLowerCase().includes(field.button.textContent.trim().toLowerCase()), 'The global control accessible name contains its visible label');
    document.querySelector('[data-crt-signal]').click(); await wait(100);
    assert(field.canvas.dataset.signal === 'running' && field.button.getAttribute('aria-pressed') === 'true', 'The portrait Signal control also starts the shared field');
    crt.setPalette('yellow'); await wait(50);
    assert(field.ink[0] === 1 && field.ink[2] === 0, 'Palette selection recolors the background field');
    const matrix=document.querySelector('#sa-transmitter feColorMatrix:last-of-type').getAttribute('values').split(' ').map(Number);
    assert(matrix[0] === .9 && matrix[12] === 0, 'Palette selection also recolors the dithered lab thumbnails');
    assert([...document.querySelectorAll('.lab-card > img')].every(e=>getComputedStyle(e).filter.includes('#sa-transmitter')), 'All lab image previews share the phosphor texture');
    const main=document.querySelector('main');
    main.inert=true; await wait(50);
    assert(field.canvas.dataset.signal === 'paused' && field.button.hidden, 'Opening an immersive overlay pauses the field and removes its control');
    main.inert=false; await wait(50);
    assert(field.canvas.dataset.signal === 'running' && !field.button.hidden, 'Closing the overlay resumes the field');
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'));
    await wait(50); const hidden=field.clock; await wait(100);
    assert(field.canvas.dataset.signal === 'paused' && field.clock === hidden, 'A hidden tab draws no background animation');
    delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); await wait(50);
    assert(field.canvas.dataset.signal === 'running', 'Returning to the tab resumes the background');
  } finally {
    delete document.hidden; document.querySelector('main').inert=false;
    crt.setPalette(saved.color); crt.setMotion(saved.signal);
    for (const [key,value] of [['sa-wave-signal',saved.signal],['sa-palette',saved.palette]]) value===null ? localStorage.removeItem(key) : localStorage.setItem(key,value);
  }
  return {passed:checks.length,checks};
})();
