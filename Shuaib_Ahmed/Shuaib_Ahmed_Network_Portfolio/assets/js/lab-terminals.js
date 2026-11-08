/* Recorded console excerpts and separately identified setup guides. These displays never execute commands. */
(() => {
  'use strict';
  const records=window.LAB_TERMINALS||{}, guides=window.LAB_RUNBOOKS||{};
  // Row-dependent horizontal deflection keeps the live commands as accessible HTML.
  const signal=document.createElementNS('http://www.w3.org/2000/svg','svg');
  signal.setAttribute('aria-hidden','true');signal.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  signal.innerHTML=`<filter id="terminal-tracking" x="-8%" y="-2%" width="116%" height="104%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".0001 .008" numOctaves="1" seed="3" result="broad-noise"><animate attributeName="baseFrequency" values=".0001 .008;.0001 .005;.0001 .011;.0001 .008" dur="10s" repeatCount="indefinite"/></feTurbulence>
    <feColorMatrix in="broad-noise" values="1 0 0 0 0 0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 1" result="broad-horizontal"/>
    <feDisplacementMap in="SourceGraphic" in2="broad-horizontal" scale="65" xChannelSelector="R" yChannelSelector="G" result="broad"><animate attributeName="scale" values="50;90;55;50" dur="12s" repeatCount="indefinite"/></feDisplacementMap>
    <feTurbulence type="fractalNoise" baseFrequency=".0001 .035" numOctaves="2" seed="7" result="noise"><animate attributeName="baseFrequency" values=".0001 .035;.0001 .023;.0001 .041;.0001 .035" dur="11s" repeatCount="indefinite"/></feTurbulence>
    <feColorMatrix in="noise" values="1 0 0 0 0 0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 1" result="horizontal"/>
    <feDisplacementMap in="broad" in2="horizontal" scale="18" xChannelSelector="R" yChannelSelector="G" result="warped"><animate attributeName="scale" values="12;20;14;24;12" keyTimes="0;.35;.7;.82;1" dur="13s" repeatCount="indefinite"/></feDisplacementMap>
    <feGaussianBlur in="warped" stdDeviation="1.5 .15" result="smear"/><feOffset in="smear" dx="2" result="echo"/>
    <feFlood flood-color="#8affec" flood-opacity=".3" result="phosphor"/><feComposite in="phosphor" in2="echo" operator="in" result="trail"/>
    <feMerge><feMergeNode in="trail"/><feMergeNode in="warped"/></feMerge>
  </filter>`;
  document.body.append(signal);
  const key=path=>decodeURIComponent(new URL(path,location.href).pathname).split('/assets/')[1];
  const prompt=line=>line.match(/^((?:[\w.-]+(?:\([^)]*\))?[#>]|(?:PS\s+)?[A-Z]:\\[^>]*>|\[[^\]]+\][#$]|[\w.-]+@[\w.-]+:[^#$]*[#$]|>>))\s?(.*)$/);
  const tone=line=>/error|failed|cannot|could not|not exist|denied|invalid|bad ip/i.test(line)?'error':/success rate|64 bytes from|FULL\/|\bup\s+up\b|This bridge is the root|Enabled group/i.test(line)?'success':/^(interface|router |network |switchport |spanning-tree |standby |encapsulation |no |ip )/.test(line)?'config':'output';
  class Terminal {
    constructor(data,guide=false){
      this.data=data;this.guide=guide;this.lines=data.lines;this.row=0;this.offset=0;this.timer=0;this.visible=false;this.paused=false;this.complete=false;
      this.element=document.createElement('div');this.element.className='terminal-tv';
      this.element.innerHTML='<div class="terminal-header"><span class="terminal-channel"></span><span class="terminal-title"></span><i aria-hidden="true"></i></div><div class="terminal-screen"><pre class="terminal-playback" aria-hidden="true"></pre><pre class="terminal-accessible"></pre></div><div class="terminal-bezel"><span class="terminal-status" aria-hidden="true">READY</span><div class="terminal-controls"><button type="button" data-terminal-pause>Pause</button><button type="button" data-terminal-replay>Replay</button><button type="button" data-terminal-all>Show all</button></div></div>';
      this.element.setAttribute('role','group');this.element.setAttribute('aria-label',data.title);
      this.element.querySelector('.terminal-channel').textContent=guide?'SETUP':'REPLAY';
      this.element.querySelector('.terminal-title').textContent=data.title;
      this.pre=this.element.querySelector('.terminal-playback');this.accessible=this.element.querySelector('.terminal-accessible');
      this.accessible.textContent=this.lines.join('\n');this.status=this.element.querySelector('.terminal-status');
      this.pause=this.element.querySelector('[data-terminal-pause]');
      this.pause.addEventListener('click',()=>{this.paused=!this.paused;this.pause.textContent=this.paused?'Play':'Pause';this.update();});
      this.element.querySelector('[data-terminal-replay]').addEventListener('click',()=>this.restart());
      this.element.querySelector('[data-terminal-all]').addEventListener('click',()=>this.finish());
      this.screen=this.element.querySelector('.terminal-screen');this.screen.tabIndex=0;this.screen.setAttribute('role','region');this.screen.setAttribute('aria-label',data.title+' console output');
      document.addEventListener('visibilitychange',()=>this.update());
      document.addEventListener('crt-signal-change',e=>{if(e.detail==='off')this.finish();this.update();});
      new IntersectionObserver(entries=>{this.visible=entries.at(-1).isIntersecting;this.update();},{threshold:.1}).observe(this.element);
      if(document.documentElement.classList.contains('crt-motion-off'))this.finish();
      this.element.terminal=this;
    }
    active(){return this.visible&&!this.paused&&!this.complete&&!document.hidden&&!document.documentElement.classList.contains('crt-motion-off');}
    update(){
      if(this.timer){clearTimeout(this.timer);this.timer=0;}
      this.element.classList.toggle('terminal-signal-live',this.visible&&!this.paused&&!document.hidden&&!document.documentElement.classList.contains('crt-motion-off'));
      this.status.textContent=this.complete?'END':this.paused?'PAUSE':this.visible?'PLAY':'READY';
      if(this.active())this.timer=setTimeout(()=>this.step(),45);
    }
    lineElement(text,partial=false){
      const line=document.createElement('span');line.className='terminal-line '+tone(text);
      const p=prompt(text);
      if(p){const label=document.createElement('span');label.className='terminal-prompt';label.textContent=p[1]+' ';line.append(label);const command=document.createElement('span');command.className='terminal-command';command.textContent=partial?p[2].slice(0,this.offset):p[2];line.append(command);}
      else {line.textContent=partial?text.slice(0,this.offset):text;if(this.guide&&!/^\s*[!#]/.test(text))line.classList.add('terminal-command');}
      return line;
    }
    step(){
      this.timer=0;if(!this.active())return;
      const text=this.lines[this.row];if(text===undefined){this.finish();return;}
      const typed=!!prompt(text)||(this.guide&&!/^\s*[!#]/.test(text));
      if(typed){
        this.offset+=2;const len=prompt(text)?.[2].length??text.length;
        const next=this.lineElement(text,true);
        if(this.current)this.current.replaceWith(next);else this.pre.append(next);this.current=next;
        if(this.offset>=len){this.row++;this.offset=0;this.current=null;}
      }else{this.pre.append(this.lineElement(text));this.row++;}
      this.screen.scrollTop=this.screen.scrollHeight;
      this.status.textContent='PLAY';
      this.timer=setTimeout(()=>this.step(),typed?28:95);
    }
    finish(){
      clearTimeout(this.timer);this.timer=0;this.complete=true;this.current=null;
      this.pre.replaceChildren(...this.lines.map(line=>this.lineElement(line)));
      this.status.textContent='END';this.screen.scrollTop=0;
      this.element.dataset.terminal='complete';
    }
    restart(data=this.data){
      clearTimeout(this.timer);this.timer=0;this.data=data;this.lines=data.lines;this.row=0;this.offset=0;this.current=null;this.complete=false;this.paused=false;
      this.element.querySelector('.terminal-title').textContent=data.title;
      this.screen.setAttribute('aria-label',data.title+' console output');
      this.pre.replaceChildren();this.accessible.textContent=this.lines.join('\n');this.pause.textContent='Pause';this.element.dataset.terminal='playing';
      if(document.documentElement.classList.contains('crt-motion-off'))this.finish();else this.update();
    }
  }
  const instances=[];
  for(const figure of document.querySelectorAll('figure.figure')){
    const image=figure.querySelector('img');if(!image)continue;
    const data=records[key(image.src)];if(!data)continue;
    const source=image.closest('a')||image;
    const terminal=new Terminal(data);instances.push(terminal);
    const details=document.createElement('details');details.className='terminal-source';
    const summary=document.createElement('summary');summary.textContent='Original screenshot';details.append(summary);
    source.before(terminal.element,details);details.append(source);figure.classList.add('has-terminal');
  }
  const slug=location.pathname.split('/').pop()?.replace(/\.html$/,'');
  const guide=guides[slug];
  if(guide){
    const article=document.querySelector('.detail-grid > article');
    if(article){
      const section=document.createElement('section');section.className='lab-runbook';
      const heading=document.createElement('h2');heading.textContent='Build & verify';
      const description=document.createElement('p');description.textContent=guide.description;
      const label=document.createElement('label');label.className='terminal-guide-label';label.textContent='Console channel ';
      const select=document.createElement('select');select.setAttribute('aria-label','Setup console channel');
      for(const channel of guide.channels){const option=document.createElement('option');option.textContent=channel.title;select.append(option);}
      label.append(select);
      const terminal=new Terminal(guide.channels[0],true);instances.push(terminal);
      select.addEventListener('change',()=>terminal.restart(guide.channels[select.selectedIndex]));
      section.append(heading,description,label,terminal.element);article.prepend(section);
    }
  }
  window.labTerminals=instances;
})();
