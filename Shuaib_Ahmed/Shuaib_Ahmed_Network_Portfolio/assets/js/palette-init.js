/* Shared preset and continuous color state, restored before CSS paints. */
(() => {
  'use strict';
  const inks={yellow:'#ffd400',orange:'#ff5a00',cyan:'#00e5ff',lime:'#39ff14',blue:'#004cff'};
  const hues={yellow:50,orange:21,cyan:186,lime:111,blue:222}, root=document.documentElement;
  const variables=['--crt-ink','--accent','--accent-rgb','--glow-rgb','--accent-soft','--accent-pale','--accent-strong','--crt-poster-hue'];
  let state={name:'blue',hue:222,ink:inks.blue};
  const channels=(h,l)=>[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l-Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1))));});
  const hex=rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
  const notify=()=>document.dispatchEvent(new CustomEvent('crt-color-change',{detail:{...state}}));
  function preset(name,save=true){
    if(!Object.hasOwn(inks,name))return;
    variables.forEach(v=>root.style.removeProperty(v));root.dataset.palette=name;state={name,hue:hues[name],ink:inks[name]};
    if(save)try{localStorage.setItem('sa-palette',name);localStorage.removeItem('sa-hue');}catch{}
    notify();
  }
  function hue(value,save=true){
    const h=Number(value);if(!Number.isFinite(h)||h<0||h>360)return;
    const ink=channels(h,.5),accent=channels(h,.78);
    const values=[hex(ink),hex(accent),accent.join(', '),ink.join(', '),hex(channels(h,.84)),hex(channels(h,.9)),hex(channels(h,.64)),`${h-222}deg`];
    variables.forEach((v,i)=>root.style.setProperty(v,values[i]));root.dataset.palette='custom';state={name:'custom',hue:h,ink:hex(ink)};
    if(save)try{localStorage.setItem('sa-palette','custom');localStorage.setItem('sa-hue',String(h));}catch{}
    notify();
  }
  window.PortfolioColor={inks,preset,hue,get current(){return {...state};}};
  try{const saved=localStorage.getItem('sa-palette'),h=localStorage.getItem('sa-hue');
    if(saved==='custom'&&h!==null&&Number.isFinite(Number(h))&&Number(h)>=0&&Number(h)<=360)hue(h,false);
    else preset(Object.hasOwn(inks,saved)?saved:'blue',false);
  }catch{preset('blue',false);}
})();
