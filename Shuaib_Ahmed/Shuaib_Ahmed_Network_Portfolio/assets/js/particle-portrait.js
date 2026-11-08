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
  const morphSeconds=2.65,changeSeconds=2.25;
  let beforeMode='crt',modeStart=-10,gesture=-1,heard=false,wasMoving=false,waveInk=[];
  const blend=(lo,hi,x)=>{x=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return x*x*(3-2*x);};
  let seed=7401;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  async function decode(source){
    const packed=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
    const values=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const W=source.width,H=source.height;if(values.length!==W*H)throw Error('Invalid channel');
    const photo=document.createElement('canvas');photo.width=W;photo.height=H;const px=photo.getContext('2d'),im=px.createImageData(W,H);
    for(let i=0;i<values.length;i++){im.data.set([values[i],values[i],values[i],255],i*4);}px.putImageData(im,0,0);
    const points=[],letters=[],bars=[];let x0=W,y0=H,x1=0,y1=0;
    for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){
      const l=values[y*W+x]/255;if(l<.023)continue;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      const k=random();
      const eye=((x/W-.487)/.038)**2+((y/H-.355)/.012)**2<1||((x/W-.573)/.031)**2+((y/H-.366)/.011)**2<1;
      const p={x,y,l,k,eye,z:(l-.35)*53+(k-.5)*9,
        shade:Math.min(15,Math.round(Math.pow(l,.44)*15)),bit:l>(bayer[((y>>1)&3)*4+((x>>1)&3)]+.5)/16};
      points.push(p);if(x%6===0&&y%6===0)letters.push(p);
      if(x%6===0&&y%4===0)bars.push(p);
    }
    const radius=Math.max(1,x1-x0,y1-y0)*.5;
    const cx=(x1+x0)/2,cy=(y1+y0)/2;for(const p of points){
      p.x-=cx;p.y-=cy;p.path=studio.grainPath(p.x/radius,p.y/radius,p.k);
      p.edge=p.l<.19||Math.abs(p.x)>.70*radius||p.y<-.8*radius;
    }
    points.sort((a,b)=>a.shade-b.shade);
    bars.sort((a,b)=>a.shade-b.shade);
    return {points,letters,bars,radius,photo,cx,cy,width:Math.max(1,x1-x0),height:Math.max(1,y1-y0)};
  }
  function palette(){
    const hex=window.PortfolioColor?.current.ink||'#004cff',rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    ink=Array.from({length:16},(_,i)=>{const v=i/15,hot=Math.max(0,(v-.26)/.74);return 'rgb('+rgb.map((c,j)=>Math.round(c*v+(255-c)*hot*hot*(j===1?.98:.85))).join(',')+')';});
    const selected=window.PortfolioColor?.current,heroHue=!selected||selected.name==='blue'?318:selected.hue;
    waveInk=[heroHue,heroHue-67,5].map((hue,band)=>Array.from({length:16},(_,i)=>
      'hsl('+hue+' 100% '+(band===2?59:8+i*(band===1?4.05:5.25))+'%)'));
    reset=true;draw();
  }
  function size(){
    w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));reset=true;draw();
  }
  // Draw the selected treatment from the same grain positions. During a change,
  // both treatments pass through the same intermediate shape before they dissolve.
  function render(g,idx,type,P,alpha,still){
    if(alpha<=.001)return;
    // The waveform channel frames the head and hand like a close-up. Pull the
    // virtual camera back as it turns to dust so the intermediate shapes fit.
    const close=type==='waveform'&&idx===0?1-Math.min(1,P.strength*2):0;
    const scale=Math.min(w*.83/g.width,h*.88/g.height)*(1+.78*close);
    const ox=w*.5-w*.055*close,oy=h*.5+h*.25*close;
    view.globalAlpha=alpha;
    if(type==='source'){
      const dust=still?0:Math.min(1,P.strength*5);
      if(dust<1){view.globalAlpha=alpha*(1-dust);view.imageSmoothingEnabled=true;
        view.drawImage(g.photo,w/2-g.cx*scale,h/2-g.cy*scale,g.photo.width*scale,g.photo.height*scale);}
      if(dust<.001)return;
      alpha*=dust;view.globalAlpha=alpha;
    }
    const sx=Math.sin(tiltX),ax=Math.cos(tiltX),sy=Math.sin(tiltY),ay=Math.cos(tiltY);
    const bar=type==='waveform',ascii=type==='ascii',bit=type==='dither';
    const points=bar?g.bars:ascii?g.letters:g.points,lastLinks=[];
    // Only the local luminance grid drives the bars, not a stock equalizer.
    const breath=still?0:Math.sin(clock*1.37),distance=g.radius*scale;
    let previous=-1;
    if(ascii){view.font='600 '+Math.max(4,scale*6.3)+'px monospace';view.textAlign='center';view.textBaseline='middle';}
    for(const p of points){
      if(p.k>density||(bit&&!p.bit))continue;
      let xx=p.x,yy=p.y;
      if(P.strength>0){const a=p.path,i=P.i;xx=(a[i]+(a[i+2]-a[i])*P.f)*g.radius;yy=(a[i+1]+(a[i+3]-a[i+1])*P.f)*g.radius;}
      const z=p.z*depth*2.6,zz=z*ay-xx*sy,zoom=1+Math.min(.18,Math.max(-.15,zz*.0015));
      const sway=waves&&!still?Math.sin(yy*.06-clock*2)*3.5:0;
      const px=(xx*ay+z*sy+sway)*scale*zoom,py=(yy*ax-zz*sx)*scale*zoom;
      const lens=1-.065*((px/w)**2+(py/h)**2);
      let x=ox+px*lens,y=oy+py*lens;
      const tone=Math.min(15,Math.max(0,p.shade+Math.round(zz*.018)));
      if(bar){
        const band=idx===0&&p.eye?2:p.edge?1:0,key=tone+band*16;
        if(key!==previous){view.fillStyle=waveInk[band][tone];previous=key;}
        // Sparse vertical tracks leave black gaps between lit columns. Local
        // luminance sets the pulse length so brows, eye sockets and hardware survive.
        const ripple=still?0:Math.sin(clock*1.28+p.x*.031+p.y*.013);
        x+=ripple*scale*1.25;y+=breath*.009*(y-h*.5)+ripple*scale;
        const bw=Math.max(1,scale*(1.25+p.l*1.12+(band===2?.65:0))),bh=Math.max(2,scale*(2.9+p.l*10)*(1+ripple*.105));
        if(tone>=11){view.globalAlpha=alpha*.14;view.fillRect(x-bw*.65,y-bh*.57,bw*2.3,bh*1.14);view.globalAlpha=alpha;}
        view.fillRect(x-bw*.5,y-bh*.5,bw,bh);
      }else{
        if(tone!==previous){view.fillStyle=bit?'#f7f8f1':type==='source'?'rgb('+tone*17+' '+tone*17+' '+tone*17+')':ink[tone];previous=tone;}
        if(ascii)view.fillText(' .:-=+*#%@'[Math.min(9,Math.floor(p.l*10))],x,y);
        else{const r=Math.max(.78,scale*(1.35+p.l*.73)*zoom);view.fillRect(x,y,r,r);}
      }
      if(links&&p.k<.0025&&lastLinks.length<18)lastLinks.push([x,y]);
    }
    if(links){view.strokeStyle='rgba(215,235,244,.23)';view.lineWidth=.65;view.beginPath();for(let i=1;i<lastLinks.length;i++){const [x,y]=lastLinks[i],[a,b]=lastLinks[i-1];if(Math.hypot(x-a,y-b)<distance*.53){view.moveTo(a,b);view.lineTo(x,y);}}view.stroke();}
    if(bit){view.fillStyle='#c5dab8';view.fillRect(w*.12,h*.78,8,2);view.fillStyle='#d8ad68';view.fillRect(w*.12+10,h*.78,8,2);}
  }
  function draw(){
    if(!grids.length||!w||!h)return;
    const still=studio.still(),idx=still?0:Math.floor(clock/7)%grids.length;
    if(idx!==current){current=idx;$('.crt-hud-bottom').textContent=String(idx+1).padStart(2,'0')+' // '+names[idx];canvas.dataset.channel=String(idx+1);}
    const ct=still||grids.length<2?0:Math.max(0,((clock%7)-(7-changeSeconds))/changeSeconds);
    const mt=still?1:Math.min(1,Math.max(0,(clock-modeStart)/changeSeconds)),changing=mt<1&&beforeMode!==mode;
    let t=still?0:gesture>=0?gesture:changing?mt:ct;
    // Channel and mode dissolves also work if the listener blows during a change.
    const P=studio.pose(t),channelMix=blend(.35,.74,ct),modeMix=changing?blend(.31,.74,mt):1;
    canvas.dataset.mode=mode;canvas.dataset.form=P.form;
    view.setTransform(dpr,0,0,dpr,0,0);view.globalAlpha=1;
    view.fillStyle=trails&&!reset&&!still&&mode!=='source'?'rgba(0,0,0,.28)':'#000';
    view.fillRect(0,0,w,h);reset=false;
    for(const [i,weight] of [[idx,1-channelMix],[(idx+1)%grids.length,channelMix]]){
      if(weight<=.001)continue;
      if(changing)render(grids[i],i,beforeMode,P,weight*(1-modeMix),still);
      render(grids[i],i,mode,P,weight*modeMix,still);
    }
    view.globalAlpha=1;
  }
  function updateHud(){const a=Math.round(tiltY*180/Math.PI);$('.studio-coords').textContent='X '+(a>=0?'+':'')+String(a)+'° / Z '+Math.round(depth*100)+(mic.live?' / IN '+Math.round(Math.min(1,spread)*100):'');}
  function run(){return visible&&!document.hidden&&!studio.still()&&!document.querySelector('main[inert]')&&grids.length;}
  function schedule(){if(run()){if(!raf)raf=requestAnimationFrame(tick);}else{cancelAnimationFrame(raf);raf=0;last=0;if(studio.still()){spread=kick=clock=tiltX=tiltY=0;gesture=-1;modeStart=-10;heard=false;reset=true;updateHud();}draw();}}
  function startMorph(){if(gesture<0){const mt=(clock-modeStart)/changeSeconds;gesture=mt>=0&&mt<1?mt:Math.max(0,((clock%7)-(7-changeSeconds))/changeSeconds);}}
  function tick(t){raf=0;if(!run())return;
    if(!last||t-last>=15){const dt=last?Math.min(.085,(t-last)/1000):0;last=t;clock+=dt;
      kick=Math.max(0,kick-dt*.8);const rms=mic.rms(),goal=Math.min(1.15,Math.max(kick,(rms-.025)*5));
      if(rms>.095&&!heard){heard=true;startMorph();}else if(rms<.035)heard=false;
      if(gesture>=0){const next=gesture+dt/morphSeconds;gesture=heard&&gesture<=.78?Math.min(.78,next):next;if(gesture>=1)gesture=-1;}
      spread+=(goal-spread)*(1-Math.exp(-dt*(goal>spread?12:5)));
      const moving=gesture>=0||clock-modeStart<=changeSeconds||clock%7>=7-changeSeconds||mode==='waveform'||waves||trails;
      if(moving||wasMoving||current!==Math.floor(clock/7)%grids.length)draw();wasMoving=moving;
      if(t-frameTime>220){frameTime=t;updateHud();}
    }raf=requestAnimationFrame(tick);
  }
  const modeButtons=[...controls.querySelectorAll('[data-mode]')];modeButtons.forEach(b=>b.addEventListener('click',()=>{
    if(mode===b.dataset.mode)return;
    const prior=(clock-modeStart)/changeSeconds;
    beforeMode=prior<.45?beforeMode:mode;mode=b.dataset.mode;modeStart=studio.still()?-10:clock;
    modeButtons.forEach(n=>n.setAttribute('aria-pressed',String(n===b)));reset=true;draw();schedule();
  }));
  for(const [sel,set] of [['[data-trails]',v=>trails=v],['[data-waves]',v=>waves=v],['[data-links]',v=>links=v]])$(sel).addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';set(on);e.currentTarget.setAttribute('aria-pressed',String(on));reset=true;draw();});
  $('[data-depth]').addEventListener('input',e=>{depth=Number(e.target.value)/100;updateHud();reset=true;draw();});
  $('[data-density]').addEventListener('input',e=>{density=Number(e.target.value)/100;reset=true;draw();});
  $('[data-scatter]').addEventListener('click',()=>{if(!studio.still()){kick=1.15;startMorph();schedule();}else status.textContent='Motion is off; the portrait stays still.';});
  $('[data-portrait-mic]').addEventListener('mic-unavailable',()=>{if(!studio.still()){kick=.55;startMorph();schedule();}});
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
