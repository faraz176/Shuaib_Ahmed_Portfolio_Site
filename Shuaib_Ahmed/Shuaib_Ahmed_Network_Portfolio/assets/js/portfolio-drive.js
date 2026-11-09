/* The root drive is built from the published portfolio, so titles, links and captions
   stay in sync with the plain HTML. Only one directory or file is shown at a time. */
(() => {
  'use strict';
  if (!window.TVFrame || new URLSearchParams(location.search).has('plain')) return;
  const {make,build}=TVFrame, main=document.querySelector('#main');
  const root={name:'',title:'Portfolio drive',kids:[]}, paths=new Map([['',root]]);
  const path=n=>n.parent?[path(n.parent),n.name].filter(Boolean).join('\\'):'';
  function entry(parent,name,title,read){
    const n={parent,name,title,read,kids:read?null:[]};parent.kids.push(n);paths.set(path(n),n);return n;
  }
  const short=(s)=>s.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,8);
  const el=(tag,cls,txt)=>make(tag,cls,txt), words=n=>n.textContent.trim();
  const link=(label,href)=>{const a=el('a','dos-link',label);a.href=href;return a;};
  const aliases={certifications:'CERTS',labs:'LABS',projects:'TOPO','field-work':'PHOTOS',contact:'CONTACT',main:''};
  const profile=entry(root,'PROFILE','Biography and résumé'), certs=entry(root,'CERTS','Certificates and verification'),
    labs=entry(root,'LABS','Network labs and field reports'),projects=entry(root,'TOPO','TopoDrawer and its walkthrough'),
    archive=entry(root,'PHOTOS','Knowledge Network and capture library'),contact=entry(root,'CONTACT','Email and professional profiles');
  const portrait=document.querySelector('[data-crt-portrait]'), intro=document.querySelector('.portfolio-intro .card'),
    gallery=document.querySelector('.memory-gallery'), project=document.querySelector('#projects .project'),info=document.querySelector('#contact .container');
  entry(profile,'ABOUT.TXT','Network engineering · New York',()=>[intro]);
  entry(profile,'RESUME.PDF','Shuaib Ahmed · résumé',()=>documentFile(intro.querySelector('a[href$=".pdf"]').href,'Résumé'));
  function documentFile(url,title){
    const a=link('Open original ↗',url);a.target='_blank';a.rel='noopener';
    const frame=el('iframe','dos-viewer');frame.src=url;frame.title=title;
    return [a,frame];
  }
  [...document.querySelectorAll('.cert-card')].forEach((c,i)=>{
    const key=['ENCOR','CCNA','FORTINET','SECPLUS','AZURE'][i]||('CERT'+i);
    entry(certs,'CERT_'+key+'.TXT',words(c.querySelector('h3')),()=>[c]);
  });
  const labGroups=new Map();
  for(const c of document.querySelectorAll('.lab-card')){
    const a=c.querySelector('.card-actions a'), title=words(c.querySelector('h3'));
    const slug=new URL(a.href).pathname.split('/').pop().split('.')[0];
    const group=/^(enterprise-campus|gre|multi-area-ospf|arp|stp|snmp)$/.test(slug)?'NETWORK':/^(ssh|security-verification|ad-troubleshooting)$/.test(slug)?'SECURITY':'SYSTEMS';
    if(!labGroups.has(group))labGroups.set(group,entry(labs,group,{NETWORK:'Routing and switching',SECURITY:'Security and identity',SYSTEMS:'Systems and field work'}[group]));
    const d=labGroups.get(group),name='LAB_'+slug.replace(/-/g,'_').toUpperCase()+'.RPT';
    const report=entry(d,name,title,()=>{
      const frame=el('iframe','dos-report');frame.title=title;frame.src=a.href;
      frame.addEventListener('load',()=>{try{
        const doc=frame.contentDocument,css=doc.createElement('style');
        css.textContent='body{background:black}.nav,.footer,.crt-field,.crt-field-toggle,.crt-color-control{display:none!important}.detail-hero{padding:12px 0!important}.detail-hero>.container{padding:12px!important}.detail-grid{display:block!important}.section{padding:12px 0}.sa-tv-frame::after,.sa-tv-slot{display:none!important}.rtv-tv .sa-tv-frame{height:68vh!important}.rtv-tv .sa-tv-screen{inset:0!important;border-radius:8px}.rtv-tv .sa-tv-deck{position:static;display:flex}.rtv-tv .sa-key{position:static;width:auto;height:auto;color:inherit;background:#333}.rtv-tv .sa-key-text{position:static;transform:none}.container{width:96%}';doc.head.append(css);
      }catch{}});
      const full=link('Open report in its own tab ↗',a.href);full.target='_blank';full.rel='noopener';return [el('p','dos-summary',words(c.querySelector('.lab-body>p:not(.eyebrow)'))),full,frame];
    });
    a.dataset.route=path(report);
  }
  entry(projects,'TOPODRAW.EXE','TopoDrawer · description and video',()=>[project]);
  entry(archive,'NETWORK.EXE','Explore the interactive Knowledge Network',()=>[gallery]);
  const portraitDir=entry(archive,'PORTRAIT','Portrait channel');
  entry(portraitDir,'SHUAIB.PIC','Portrait / router / switch',()=>[portrait]);
  const photosDir=entry(archive,'LABS','Photo albums · field work and labs'),photos=window.PORTFOLIO_ARCHIVE||[];
  for(const category of new Set(photos.map(p=>p.category))){
    const group=photos.filter(p=>p.category===category);
    entry(photosDir,short(category)+'.ALB',category+' · '+group.length+' captures',()=>{
      const album=el('div','dos-album');
      for(const p of group){const a=link('',p.src);a.target='_blank';a.rel='noopener';const img=el('img');img.src=p.thumb;img.loading='lazy';img.alt=p.title;a.append(img,el('span','',p.title),el('small','',p.captured||'Date unavailable'));album.append(a);}
      return [album];
    });
  }
  entry(contact,'CONTACT.TXT','Contact Shuaib',()=>[info]);
  entry(root,'CONTACT.TXT','Email, LinkedIn and GitHub',()=>[info]);
  entry(root,'README.TXT','How to browse this drive',()=>[el('p','','Select a folder or type CD LABS. Select a file to read it. CD .. goes up one level; ROOT returns here. TYPE followed by a filename opens it. INDEX.TXT lists every file. The color slider tunes the phosphor; Signal pauses the motion.')]);
  entry(root,'INDEX.TXT','Index of every file',()=>[...paths.values()].filter(n=>!n.kids).map(n=>link(path(n)+' — '+n.title,route(n))));
  const station=el('section','dos-station'),tv=build({label:'Portfolio drive',className:'dos-tv',keys:[
    {key:'stop',text:'ROOT',name:'Root directory',action:()=>go(root)},
    {key:'up',text:'UP',name:'Parent directory',action:()=>go(current.parent||root)},
    {key:'rec',text:'PRINT',name:'Print this listing or file',action:()=>printView()}
  ]});
  const tube=el('div','dos-tube'),bar=el('header','dos-bar'),up=el('button','','↑ UP'),home=el('button','','C:\\');
  home.onclick=()=>go(root);up.onclick=()=>go(current.parent||root);
  const locationText=el('span','dos-location'), scroll=el('div','dos-scroll'),msg=el('div','dos-msg');
  scroll.tabIndex=0;scroll.setAttribute('aria-label','Directory contents');scroll.setAttribute('role','region');msg.setAttribute('role','status');
  const form=el('form','dos-form'),prompt=el('label'),input=el('input'),enter=el('button','','↵');
  input.id='dos-input';input.setAttribute('aria-label','DOS command');input.autocomplete='off';input.spellcheck=false;input.autocapitalize='none';input.placeholder='DIR, CD, TYPE, HELP';prompt.htmlFor=input.id;enter.setAttribute('aria-label','Run command');form.append(prompt,input,enter);
  bar.append(home,locationText,up);tube.append(bar,scroll,msg,form);tv.show(tube);station.append(tv.root);
  const rack=el('div','dos-rack'),plain=link('Classic view ↗','?plain=1');rack.append(plain);const wide=el('button','','Expand tube');wide.type='button';wide.onclick=()=>{const on=document.body.classList.toggle('dos-wide');wide.textContent=on?'Restore housing':'Expand tube';wide.setAttribute('aria-pressed',String(on));};rack.append(wide);
  for(const control of document.querySelectorAll('.crt-field-toggle,.crt-color-control'))rack.append(control);
  station.append(rack);main.prepend(station);
  // Return the live widgets to their original sections between views. Existing
  // gallery and portrait listeners can continue to find their elements by ID.
  const anchors=new Map();
  for(const node of [portrait,intro,gallery,project,info,...document.querySelectorAll('.lab-card,.cert-card')]){
    const anchor=document.createComment('drive source');node.before(anchor);anchors.set(node,anchor);
  }
  let current=root;
  const route=n=>'#drive/'+path(n).split('\\').map(encodeURIComponent).join('/');
  function go(n){if(location.hash===route(n)){show(n);return;}location.hash=route(n);}
  function resolve(s,from){
    const absolute=/^(?:C:|[\\/])/i.test(s);let n=absolute?root:(from.kids?from:from.parent);
    for(const part of s.toUpperCase().replace(/^C:/,'').split(/[\\/]/).filter(Boolean)){
      if(part==='.')continue;if(part==='..'){n=n.parent||root;continue;}
      n=n.kids?.find(k=>k.name===part);if(!n)return null;
    }return n;
  }
  function show(n){
    current=n;for(const v of scroll.querySelectorAll('video'))v.pause();
    for(const [node,anchor] of anchors)if(scroll.contains(node))anchor.after(node);
    scroll.replaceChildren();scroll.scrollTop=0;msg.textContent='';
    locationText.textContent='C:\\'+path(n);prompt.textContent='C:\\'+path(n.kids?n:n.parent)+'>';up.disabled=n===root;tv.slot.textContent=n.kids?'DIRECTORY':'READING';
    if(n===root){
      const banner=el('div','dos-banner'),copy=el('div');
      copy.append(el('small','','SA / NETWORK ENGINEERING'),el('h1','','Shuaib Ahmed'),el('p','','Select a directory or type CD followed by its name.'));
      banner.append(copy,portrait);scroll.append(banner);
    }else scroll.append(el('h2','dos-title',n.title));
    if(n.kids){
      scroll.append(el('p','dos-label','Directory of C:\\'+path(n)));
      for(const k of n.kids){
        const a=link('',route(k));a.className='dos-row';a.append(el('b','',k.name),el('small','',k.kids?'<DIR>':'FILE'),el('span','',k.title));scroll.append(a);
      }
      scroll.append(el('p','dos-total',n.kids.length+' entries'));
    }else{const doc=el('article','dos-doc');doc.append(...n.read());scroll.append(doc);}
  }
  function navigate(){let h=location.hash.slice(1),n;try{n=h.startsWith('drive/')?resolve(decodeURIComponent(h.slice(6)),root):paths.get(aliases[h]);}catch{}show(n||root);}
  function printView(){const f=scroll.querySelector('iframe');if(f){try{f.contentWindow.print();return;}catch{}}window.print();}
  form.onsubmit=e=>{
    e.preventDefault();const [cmd,...rest]=input.value.trim().split(/\s+/),arg=rest.join(' ').replace(/^"(.*)"$/,'$1');input.value='';
    switch(cmd.toUpperCase()){
      case 'DIR':case 'CD':case 'TYPE':case 'OPEN':{
        const n=arg?resolve(arg,current):(current.kids?current:current.parent);
        if(!n||(cmd.toUpperCase()==='CD'&&!n.kids)){msg.textContent='Path not found. Type DIR to list entries.';return;}go(n);break;}
      case 'ROOT':go(root);break;case 'PRINT':printView();break;
      case 'HELP':msg.textContent='DIR · CD folder · CD .. · TYPE file · ROOT · PRINT';break;
      default:msg.textContent='Unknown command. Type HELP.';
    }
  };
  scroll.addEventListener('click',e=>{
    const a=e.target.closest('a');if(!a)return;
    if(a.dataset.route){e.preventDefault();go(paths.get(a.dataset.route));}
    else if(a.closest('.cert-card')&&new URL(a.href).pathname.toLowerCase().endsWith('.pdf')){
      e.preventDefault();const article=a.closest('.dos-doc');article.querySelector('.dos-pdf')?.remove();
      const pdf=el('div','dos-pdf');pdf.append(...documentFile(a.href,current.title));article.append(pdf);pdf.scrollIntoView({block:'nearest'});
    }
  });
  document.body.classList.add('dos-home');addEventListener('hashchange',navigate);navigate();
})();
