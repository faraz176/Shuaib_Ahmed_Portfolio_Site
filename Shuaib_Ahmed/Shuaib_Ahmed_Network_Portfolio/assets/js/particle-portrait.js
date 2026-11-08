/* A seeded point field from the existing three luminance grids; no source photo or mic data leaves this page. */
(() => {
  'use strict';
  const canvas=document.querySelector('[data-particle-canvas]'),studio=window.SignalStudio;
  if(!canvas||!studio)return;
  const view=canvas.getContext('2d',{alpha:false});if(!view||typeof DecompressionStream==='undefined')return;
  const rig=canvas.closest('.hero-instrument'),figure=canvas.closest('figure'),glass=canvas.parentElement,controls=rig.querySelector('[data-studio-controls]');
  const $=s=>rig.querySelector(s),status=$('[data-portrait-status]'),mic=studio.microphone($('[data-portrait-mic]'),status,'Use SCATTER instead.');
  const names=['SHUAIB AHMED','ROUTER // L3','SWITCH // L2'],bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  let grids=[],mode='crt',depth=.35,density=.82,trails=false,waves=false,links=false,visible=false,raf=0,last=0,clock=0,frameTime=0,current=-1,spread=0,kick=0,tiltX=0,tiltY=0,drag=null,w=0,h=0,dpr=1,ink=[],reset=true;
  let seed=7401;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  async function decode(source){
    const packed=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
    const values=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const W=source.width,H=source.height;if(values.length!==W*H)throw Error('Invalid channel');
    const photo=document.createElement('canvas');photo.width=W;photo.height=H;const px=photo.getContext('2d'),im=px.createImageData(W,H);
    for(let i=0;i<values.length;i++){im.data.set([values[i],values[i],values[i],255],i*4);}px.putImageData(im,0,0);
    const points=[],letters=[],columns=new Float32Array(52);let x0=W,y0=H,x1=0,y1=0;
    for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){
      const l=values[y*W+x]/255;if(l<.023)continue;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      const k=random(),a=random()*Math.PI*2,dist=25+random()*85;
      const p={x,y,l,k,z:(l-.35)*53+(k-.5)*9,dx:Math.cos(a)*dist,dy:Math.sin(a)*dist,
        shade:Math.min(15,Math.round(Math.pow(l,.44)*15)),bit:l>(bayer[((y>>1)&3)*4+((x>>1)&3)]+.5)/16};
      points.push(p);if(x%6===0&&y%6===0)letters.push(p);
      columns[Math.min(51,Math.floor(x/W*52))]+=l;
    }
    const max=Math.max(1,...columns);for(let i=0;i<52;i++)columns[i]/=max;
    const cx=(x1+x0)/2,cy=(y1+y0)/2;for(const p of points){p.x-=cx;p.y-=cy;}
    points.sort((a,b)=>a.shade-b.shade);
    return {points,letters,columns,photo,cx,cy,width:Math.max(1,x1-x0),height:Math.max(1,y1-y0)};
  }
  function palette(){
    const hex=window.PortfolioColor?.current.ink||'#004cff',rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    ink=Array.from({length:16},(_,i)=>{const v=i/15,hot=Math.max(0,(v-.26)/.74);return 'rgb('+rgb.map((c,j)=>Math.round(c*v+(255-c)*hot*hot*(j===1?.98:.85))).join(',')+')';});
    reset=true;draw();
  }
  function size(){
    w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));reset=true;draw();
  }
  function draw(){
    if(!grids.length||!w||!h)return;
    const still=studio.still(),idx=still?0:Math.floor(clock/7)%grids.length,g=grids[idx];
    if(idx!==current){current=idx;reset=true;$('.crt-hud-bottom').textContent=String(idx+1).padStart(2,'0')+' // '+names[idx];canvas.dataset.channel=String(idx+1);}
    canvas.dataset.mode=mode;
    view.setTransform(dpr,0,0,dpr,0,0);view.fillStyle=trails&&!reset&&!still&&mode!=='source'?'rgba(0,0,0,.28)':'#000';view.fillRect(0,0,w,h);reset=false;
    const scale=Math.min(w*.83/g.width,h*.88/g.height);
    if(mode==='source'){view.imageSmoothingEnabled=true;view.drawImage(g.photo,w/2-g.cx*scale,h/2-g.cy*scale,g.photo.width*scale,g.photo.height*scale);return;}
    const scatter=still?0:spread,angX=tiltX,angY=tiltY,sx=Math.sin(angX),cx=Math.cos(angX),sy=Math.sin(angY),cy=Math.cos(angY);
    const phase=clock%7,transition=still?0:Math.max(0,(phase-6.62)/.38,clock>=7?1-phase/.38:0)*.20;
    const points=mode==='ascii'?g.letters:g.points,lastLinks=[];let previous=-1;
    if(mode==='ascii'){view.font='600 '+Math.max(4,scale*6.3)+'px monospace';view.textAlign='center';view.textBaseline='middle';}
    for(const p of points){
      if(p.k>density||(mode==='dither'&&!p.bit))continue;
      const z=p.z*(depth*2.6),zz=z*cy-p.x*sy,zoom=1+Math.min(.18,Math.max(-.15,zz*.0015));
      const rx=p.x*cy+z*sy,ry=p.y*cx-zz*sx,force=scatter+transition;
      const offset=waves&&!still?Math.sin(p.y*.06-clock*2)*3.5:0;
      const px=(rx+p.dx*force+offset)*scale*zoom,py=(ry+p.dy*force)*scale*zoom;
      const lens=1-.065*((px/w)**2+(py/h)**2);
      const x=w*.5+px*lens,y=h*.5+py*lens;
      const tone=Math.min(15,Math.max(0,p.shade+Math.round(zz*.018)));
      if(tone!==previous){view.fillStyle=mode==='dither'?'#f7f8f1':ink[tone];previous=tone;}
      if(mode==='ascii'){view.fillText(' .:-=+*#%@'[Math.min(9,Math.floor(p.l*10))],x,y);}
      else{const r=Math.max(.78,scale*(1.35+p.l*.73)*zoom);view.fillRect(x,y,r,r);}
      if(links&&p.k<.0025&&lastLinks.length<18)lastLinks.push([x,y]);
    }
    if(links){view.strokeStyle='rgba(215,235,244,.23)';view.lineWidth=.65;view.beginPath();for(let i=1;i<lastLinks.length;i++){const [x,y]=lastLinks[i],[a,b]=lastLinks[i-1];if(Math.hypot(x-a,y-b)<w*.25){view.moveTo(a,b);view.lineTo(x,y);}}view.stroke();}
    if(mode==='waveform'){const left=w*.15,base=h*.85,step=w*.7/52;view.fillStyle='#010408c9';view.fillRect(left,h*.67,w*.7,h*.19);view.fillStyle=ink[14];g.columns.forEach((v,i)=>{const tall=2+v*h*.16;view.fillRect(left+i*step,base-tall,Math.max(1,step*.43),tall);});}
    if(mode==='dither'){view.fillStyle='#c5dab8';view.fillRect(w*.12,h*.78,8,2);view.fillStyle='#d8ad68';view.fillRect(w*.12+10,h*.78,8,2);}
  }
  function updateHud(){const a=Math.round(tiltY*180/Math.PI);$('.studio-coords').textContent='X '+(a>=0?'+':'')+String(a)+'° / Z '+Math.round(depth*100)+(mic.live?' / IN '+Math.round(Math.min(1,spread)*100):'');}
  function run(){return visible&&!document.hidden&&!studio.still()&&!document.querySelector('main[inert]')&&grids.length;}
  function schedule(){if(run()){if(!raf)raf=requestAnimationFrame(tick);}else{cancelAnimationFrame(raf);raf=0;last=0;if(studio.still()){spread=kick=clock=tiltX=tiltY=0;reset=true;updateHud();}draw();}}
  function tick(t){raf=0;if(!run())return;
    if(!last||t-last>=15){const dt=last?Math.min(.085,(t-last)/1000):0;last=t;clock+=dt;
      kick=Math.max(0,kick-dt*.8);const goal=Math.min(1.15,Math.max(kick,(mic.rms()-.025)*5));
      spread+=(goal-spread)*(1-Math.exp(-dt*(goal>spread?12:5)));draw();if(t-frameTime>220){frameTime=t;updateHud();}
    }raf=requestAnimationFrame(tick);
  }
  const modeButtons=[...controls.querySelectorAll('[data-mode]')];modeButtons.forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;modeButtons.forEach(n=>n.setAttribute('aria-pressed',String(n===b)));reset=true;draw();}));
  for(const [sel,set] of [['[data-trails]',v=>trails=v],['[data-waves]',v=>waves=v],['[data-links]',v=>links=v]])$(sel).addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';set(on);e.currentTarget.setAttribute('aria-pressed',String(on));reset=true;draw();});
  $('[data-depth]').addEventListener('input',e=>{depth=Number(e.target.value)/100;updateHud();reset=true;draw();});
  $('[data-density]').addEventListener('input',e=>{density=Number(e.target.value)/100;reset=true;draw();});
  $('[data-scatter]').addEventListener('click',()=>{if(!studio.still()){kick=1.15;schedule();}else status.textContent='Motion is off; the portrait stays still.';});
  $('[data-portrait-mic]').addEventListener('mic-unavailable',()=>{if(!studio.still()){kick=.55;schedule();}});
  glass.addEventListener('pointerdown',e=>{if(studio.still())return;drag=[e.clientX,e.clientY,tiltX,tiltY];glass.setPointerCapture(e.pointerId);});
  glass.addEventListener('pointermove',e=>{if(!drag||studio.still())return;tiltY=Math.max(-.44,Math.min(.44,drag[3]+(e.clientX-drag[0])*.006));tiltX=Math.max(-.32,Math.min(.32,drag[2]-(e.clientY-drag[1])*.005));updateHud();draw();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])glass.addEventListener(type,()=>{drag=null;});
  const signal=$('[data-crt-signal]');signal.addEventListener('click',()=>{const value=document.documentElement.classList.contains('crt-motion-off')?'on':'off';try{localStorage.setItem('sa-wave-signal',value);}catch{}document.dispatchEvent(new CustomEvent('crt-signal-change',{detail:value}));});
  function sync(){signal.setAttribute('aria-pressed',String(!studio.still()));schedule();}
  document.addEventListener('crt-signal-change',()=>queueMicrotask(sync));studio.reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',schedule);
  document.addEventListener('crt-color-change',palette);
  new MutationObserver(schedule).observe(document.querySelector('main'),{attributes:true,attributeFilter:['inert']});
  new ResizeObserver(size).observe(canvas);new IntersectionObserver(es=>{visible=es[0].isIntersecting;schedule();}).observe(figure);
  palette();Promise.all([window.PORTFOLIO_PORTRAIT,...(window.PORTFOLIO_CHANNELS||[])].map(decode)).then(data=>{
    grids=data;figure.classList.add('is-live');controls.hidden=false;signal.hidden=false;size();sync();
  }).catch(()=>{canvas.hidden=true;}); // Existing descriptive WebP remains visible.
})();
