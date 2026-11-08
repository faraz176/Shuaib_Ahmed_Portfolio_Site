/* Run on a rendered report containing a terminal. Does not run any lab commands. */
(async()=>{
  const checks=[],assert=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name);};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const tv=document.querySelector('.terminal-tv'),terminal=tv?.terminal;
  assert(!!terminal,'A live terminal is mounted');
  tv.scrollIntoView({block:'center'});await wait(200);terminal.finish();terminal.paused=false;terminal.update();
  const housing=tv.querySelector('.tv-housing');await housing.decode();
  assert(housing.naturalWidth>1000&&housing.getAttribute('aria-hidden')==='true','The photographic TV housing is decorative');
  assert(tv.classList.contains('terminal-signal-live'),'Only visible running terminals enable the signal effect');
  assert(getComputedStyle(terminal.screen).filter.includes('terminal-tracking'),'The bounded tube screen uses horizontal tracking distortion');
  const displacement=document.querySelector('#terminal-tracking feDisplacementMap'),before=displacement.scale.animVal;
  let moved=false;for(let i=0;i<8&&!moved;i++){await wait(150);moved=Math.abs(displacement.scale.animVal-before)>.01;}
  assert(moved,'Tracking bends animate over time');
  assert(document.querySelector('#terminal-tracking feColorMatrix').getAttribute('values').includes('0 0 0 0 .5'),'Vertical displacement stays centered so rows remain readable');
  assert(terminal.accessible.textContent===terminal.lines.join('\n'),'Assistive technology receives the complete undistorted transcript');
  terminal.pause.click();assert(!tv.classList.contains('terminal-signal-live')&&getComputedStyle(terminal.screen).filter==='none','Pause provides a stable clear command view');
  terminal.pause.click();assert(tv.classList.contains('terminal-signal-live'),'Play restores the distorted signal');
  assert(!!document.querySelector('.detail-hero>.container')&&parseFloat(getComputedStyle(document.querySelector('.detail-hero>.container')).borderTopLeftRadius)>20,'The report heading has curved glass framing');
  return {passed:checks.length,checks};
})();
