/* The mic feeds a local analyser only. One listener at a time; leaving the page closes its tracks. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const still=()=>reduced.matches||document.documentElement.classList.contains('crt-motion-off');
  let context=null,activeMic=null;
  function audio(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    if(!context||context.state==='closed')context=new AC();
    return context;
  }
  function microphone(button,status,instructions){
    let generation=0,stream=null,node=null,analysis=null,samples=null,pending=false;
    const label=button.textContent;
    const mic={
      get live(){return !!analysis;},
      rms(){
        if(!analysis||still()||document.hidden)return 0;
        analysis.getFloatTimeDomainData(samples);
        let sum=0;for(let i=0;i<samples.length;i++)sum+=samples[i]*samples[i];
        return Math.sqrt(sum/samples.length);
      },
      stop(message=''){
        generation++;pending=false;node?.disconnect();analysis?.disconnect();node=analysis=null;
        if(stream){for(const t of stream.getTracks())t.stop();stream=null;}
        if(activeMic===mic)activeMic=null;
        button.textContent=label;button.setAttribute('aria-pressed','false');
        if(message)status.textContent=message;
      }
    };
    button.addEventListener('click',async()=>{
      if(pending||mic.live){mic.stop('Mic off.');return;}
      if(still()){status.textContent='Motion is off. The still view is available.';return;}
      if(!navigator.mediaDevices?.getUserMedia){status.textContent='Mic unavailable here. '+instructions;button.dispatchEvent(new Event('mic-unavailable'));return;}
      activeMic?.stop('Mic off.');activeMic=mic;pending=true;const ticket=++generation;
      button.textContent='CANCEL MIC';status.textContent='Waiting for microphone permission…';
      try{
        const ctx=audio();if(!ctx)throw Error('no audio');
        const resumed=ctx.resume().catch(()=>{});
        const granted=await navigator.mediaDevices.getUserMedia({audio:true});
        if(ticket!==generation||document.hidden||still()){granted.getTracks().forEach(t=>t.stop());return;}
        stream=granted;await resumed;
        if(ticket!==generation)return;
        if(ctx.state!=='running')throw Error('audio suspended');
        node=ctx.createMediaStreamSource(stream);analysis=ctx.createAnalyser();analysis.fftSize=1024;
        samples=new Float32Array(analysis.fftSize);node.connect(analysis);pending=false;
        stream.getAudioTracks()[0]?.addEventListener('ended',()=>mic.stop('Mic disconnected. '+instructions),{once:true});
        button.textContent='MIC OFF';button.setAttribute('aria-pressed','true');status.textContent='Listening locally. Blow or talk; nothing is recorded.';
        button.dispatchEvent(new Event('mic-ready'));
      }catch(e){if(ticket===generation){mic.stop((e.name==='NotAllowedError'?'Mic denied. ':'Mic unavailable. ')+instructions);button.dispatchEvent(new Event('mic-unavailable'));}}
    });
    new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&(mic.live||pending))mic.stop('Mic off outside this view.');}).observe(button.closest('.hero-instrument,.lemon-lab')||button);
    return mic;
  }
  const stopForQuiet=()=>{if(document.hidden||still())activeMic?.stop('Mic off.');};
  reduced.addEventListener('change',stopForQuiet);document.addEventListener('crt-signal-change',e=>{if(e.detail==='off')activeMic?.stop('Mic off.');});
  document.addEventListener('visibilitychange',stopForQuiet);addEventListener('pagehide',()=>{activeMic?.stop();if(context)context.suspend().catch(()=>{});});
  // Each grain owns one continuous path. The two displays share the choreography,
  // but keep their own source points, palettes, scale and playback clocks.
  const forms=['SOLID','STARBURST','BLOB','DIAMOND','WISP','REFORMED'];
  const stops=[0,.19,.40,.60,.78,1];
  function grainPath(x,y,k){
    const a=Math.atan2(y,x)+(k-.5)*.36,U=Math.cos(a),V=Math.sin(a);
    const j=k*437.17%1,r=.12+.88*Math.sqrt(j),ray=Math.pow(.5+.5*Math.cos(7*a+.35),3);
    const star=r*(.55+.75*ray),blob=r*(.79+.09*Math.sin(3*a+.9)+.05*Math.sin(5*a));
    const d=r*1.10/(Math.abs(U)+Math.abs(V)),u=k*2-1;
    return Float32Array.of(x,y, U*star,V*star*.84,
      Math.cos(a+.45)*blob+.08,Math.sin(a+.45)*blob*.85-.08,
      d*(U*.98-V*.18),d*(V*.98+U*.18),
      u*1.18,.25*Math.sin(u*3)-.26*u+.10*(j-.5)*(1-u*u),x,y);
  }
  function pose(t){
    t=Math.min(1,Math.max(0,t));let i=0;
    while(i<4&&t>=stops[i+1])i++;
    let f=(t-stops[i])/(stops[i+1]-stops[i]);f=f*f*(3-2*f);
    const n=f<.5?i:i+1;
    return {i:i*2,f,form:forms[n],strength:t<=0||t>=1?0:Math.sin(Math.PI*t)};
  }
  window.SignalStudio={microphone,still,reduced,grainPath,pose};

  const root=document.querySelector('.lemon-lab');if(!root)return;
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
  const cut=root.querySelector('[data-cut]'),micKey=root.querySelector('[data-lemon-mic]'),status=root.querySelector('[data-lemon-status]'),result=root.querySelector('[data-cut-result]'),state=root.querySelector('[data-fruit-state]');
  const mic=microphone(micKey,status,'Tap CUT THE LEMON instead.');
  let visible=false,raf=0,burst=-1,pendingCut=false,armed=true,viewW=0,viewH=0,zoom=1,buffer=null,bufferContext=null;
  const fruit=[],drops=[];let seed=91267;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  // Seed points on the rind of a tapered ellipsoid. The dim far edge and peel grain give it volume without a photo.
  for(let i=0;i<11100;i++){
    const u=random()*2-1,angle=random()*Math.PI,ring=Math.sqrt(1-u*u),tip=Math.exp(-Math.pow((1-Math.abs(u))/.14,2));
    const x=u*(1+.14*tip),y=ring*Math.cos(angle)*.64*(1-.24*tip),z=ring*Math.sin(angle),light=Math.max(.10,Math.min(1,.28+z*.66-y*.36-u*.16+(random()-.5)*.27));
    fruit.push({x:x*.95+y*.28,y:y*.95-x*.28,side:x>0?1:-1,light,k:random()});
  }
  // A small folded leaf at the stem, in the same ink at lower exposure.
  for(let i=0;i<530;i++){
    const t=random(),v=(random()-.5)*Math.sin(Math.PI*t);
    fruit.push({x:.99+t*.25+v*.26,y:-.32-t*.51+v*.12,side:1,light:.33+t*.32,k:random()});
  }
  fruit.forEach(p=>p.path=grainPath(p.x,p.y,p.k));fruit.sort((a,b)=>a.light-b.light);
  for(let i=0;i<240;i++){const a=(random()-.55)*4.8;drops.push({x:(random()-.5)*.18,y:(random()-.5)*.18,dx:Math.sin(a)*(.4+random()*.92),dy:-Math.cos(a)*(.3+random()),r:.005+random()*.01,life:.45+random()*.55});}
  let inks=[];
  function palette(){
    const selected=window.PortfolioColor?.current;
    const ink=!selected||selected.name==='blue'?'#f2ff00':selected.ink;
    root.style.setProperty('--fruit',ink);
    root.style.setProperty('--fruit-label',!selected||selected.name==='blue'?ink:'var(--accent-pale)');
    const rgb=[1,3,5].map(i=>parseInt(ink.slice(i,i+2),16));inks=Array.from({length:20},(_,i)=>{
      const l=(i+1)/20;return 'rgb('+rgb.map(c=>Math.round(c*l*(1-.15*l)+255*.15*l*l)).join(',')+')';
    });draw(performance.now());
  }
  function size(){
    if(!ctx)return;
    viewW=canvas.clientWidth;viewH=canvas.clientHeight;zoom=Math.min(2,devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(viewW*zoom));canvas.height=Math.max(1,Math.round(viewH*zoom));
    draw(performance.now());
  }
  function draw(now){
    if(!ctx||!viewW||!inks.length)return;
    ctx.setTransform(zoom,0,0,zoom,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,viewW,viewH);
    const active=burst>=0,t=active?Math.min(1,Math.max(0,(now-burst)/2980)):0,P=pose(t);
    if(active){canvas.dataset.form=P.form;if(state.textContent!==P.form)state.textContent=P.form;}
    else canvas.dataset.form='SOLID';
    const quietMic=mic.live&&!still()&&burst<0?1:0;
    const scale=Math.min(viewW*.34,viewH*.49),cx=viewW*.5+quietMic*Math.sin(now/750)*1.2,cy=viewH*.52+quietMic*Math.cos(now/910)*.7;
    let last=-1;for(const p of fruit){
      const shade=Math.min(19,Math.floor(p.light*20));if(shade!==last){ctx.fillStyle=inks[shade];last=shade;}
      const path=p.path,i=P.i,x=path[i]+(path[i+2]-path[i])*P.f,y=path[i+1]+(path[i+3]-path[i+1])*P.f;
      const dot=Math.max(.75,scale*.009)*(p.k*.55+.72);ctx.fillRect(cx+x*scale,cy+y*scale,dot,dot);
    }
    if(active&&t<.29)for(const p of drops){
      const q=t/(.29*p.life);if(q>=1)continue;
      const travel=.07+.93*Math.sin(q*1.48),d=p.r*scale*(1-q*q);
      ctx.fillStyle=inks[Math.min(19,Math.floor((14+p.life*5)*(1-q*q)))];ctx.fillRect(cx+(p.x+p.dx*travel)*scale,cy+(p.y+p.dy*travel+q*q*.22)*scale,d,d);
    }
    if(burst>=0&&t>=1){burst=-1;state.textContent='REFORMED';canvas.dataset.phase='rest';}
  }
  function spray(ac){
    if(!ac||ac.state!=='running')return;
    if(!buffer||bufferContext!==ac){buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*.4),ac.sampleRate);bufferContext=ac;const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=random()*2-1;}
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain(),now=ac.currentTime;
    source.buffer=buffer;filter.type='bandpass';filter.Q.value=.85;filter.frequency.setValueAtTime(3500,now);filter.frequency.exponentialRampToValueAtTime(620,now+.37);
    gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.24,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+.4);
    source.connect(filter);filter.connect(gain);gain.connect(ac.destination);source.start(now);source.stop(now+.4);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  async function trigger(){
    if(pendingCut||burst>=0||document.hidden)return;
    pendingCut=true;
    try{
      let ac=null;
      if(!still())try{ac=audio();if(ac?.state==='suspended')await Promise.race([ac.resume(),new Promise(r=>setTimeout(r,180))]);}catch{}
      if(document.hidden||!visible)return;
      const quiet=still(),now=performance.now();
      burst=quiet?-1:now;canvas.dataset.phase=quiet?'still':'burst';state.textContent=quiet?'STILL':'CUT / SPRAY';
      draw(now);
      if(!quiet){spray(ac);try{navigator.vibrate?.(30);}catch{}}
      result.textContent="Did you almost smell it? That's your brain, not your phone.";cut.textContent='CUT AGAIN';
      schedule();
    }finally{pendingCut=false;}
  }
  function frame(now){
    raf=0;if(!visible||document.hidden||still())return;
    if(mic.live){const level=mic.rms();if(level<.035)armed=true;if(armed&&level>.095&&burst<0){armed=false;trigger();}}
    draw(now);if(burst>=0||mic.live)schedule();
  }
  function schedule(){if(!raf&&visible&&!document.hidden&&!still()&&(burst>=0||mic.live))raf=requestAnimationFrame(frame);}
  function quietChange(){
    if(still()||document.hidden||!visible){cancelAnimationFrame(raf);raf=0;burst=-1;canvas.dataset.phase='rest';state.textContent=still()?'STILL':'INTACT';draw(performance.now());}
    else schedule();
  }
  cut.addEventListener('click',trigger);micKey.addEventListener('mic-ready',()=>{armed=true;schedule();});
  document.addEventListener('crt-color-change',palette);document.addEventListener('visibilitychange',quietChange);document.addEventListener('crt-signal-change',()=>queueMicrotask(quietChange));reduced.addEventListener('change',quietChange);
  new ResizeObserver(size).observe(canvas);new IntersectionObserver(es=>{visible=es[0].isIntersecting;quietChange();}).observe(root);
  palette();size();
})();
