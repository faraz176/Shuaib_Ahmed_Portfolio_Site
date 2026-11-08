from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json,sys,time
from playwright.sync_api import sync_playwright
S=Path(__file__).resolve().parents[1]
import os
O=Path(os.environ['STUDIO_SCREENSHOTS']) if os.environ.get('STUDIO_SCREENSHOTS') else None
if O: O.mkdir(parents=True,exist_ok=True)
class H(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(S),**kw)
 def log_message(self,*a):pass
class Server(ThreadingHTTPServer):
 def handle_error(self,*a):pass
server=Server(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start()
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:'+str(server.server_port)
with sync_playwright() as pw:
 b=pw.chromium.launch(channel='chrome',headless=True,args=['--autoplay-policy=no-user-gesture-required'])
 ctx=b.new_context(viewport={'width':1440,'height':1000})
 pg=ctx.new_page();err=[];bad=[];result={}
 cdp=ctx.new_cdp_session(pg);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
 pg.on('pageerror',lambda e:err.append(str(e)))
 pg.on('response',lambda r:bad.append(str(r.status)+' '+r.url) if r.url.startswith(base) and r.status>=400 else None)
 # Measure browser issue times of the three cues; no actual mic, recording, speaker measurement or vibration needed.
 pg.add_init_script("""window.probe={};Object.defineProperty(navigator,'vibrate',{value:n=>{probe.vib=performance.now();probe.duration=n;return true}});
 const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){probe.audio=performance.now();return start.apply(this,a)};
 const rect=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...a){if(!probe.visual&&this.canvas.hasAttribute('data-lemon-canvas')&&this.canvas.dataset.phase==='burst')probe.visual=performance.now();return rect.apply(this,a)};
 window.fakeInput=async()=>{let ac=window.fakeContext=new AudioContext();await ac.resume();let osc=ac.createOscillator(),gain=window.fakeGain=ac.createGain(),dest=ac.createMediaStreamDestination();gain.gain.value=0;osc.connect(gain);gain.connect(dest);osc.start();window.testStream=dest.stream;return dest.stream};
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>window.denyMic?Promise.reject(new DOMException('denied','NotAllowedError')):fakeInput()});""")
 pg.goto(base+'/?studio-check=1',wait_until='load');pg.reload(wait_until='load')
 assert pg.evaluate('document.featurePolicy?.allowsFeature("microphone") ?? true'), 'Host disallows the optional microphone'
 pc=pg.locator('[data-particle-canvas]');rig=pg.locator('.hero-instrument');rig.scroll_into_view_if_needed()
 pg.wait_for_selector('[data-studio-controls]:visible');pg.wait_for_function('document.querySelector("[data-particle-canvas]").dataset.channel==="1"')
 assert pg.locator('.hero-copy').inner_text().strip()=='Shuaib Ahmed'
 result['channels']=[]
 for ch in ['1','2','3']:
  pg.wait_for_function('(c)=>document.querySelector("[data-particle-canvas]").dataset.channel===c',arg=ch,timeout=12000)
  result['channels'].append(ch)
 pg.locator('[data-mode=source]').click();assert pc.get_attribute('data-mode')=='source'
 for mode in ['dither','ascii','waveform','crt']:
  pg.locator('[data-mode='+mode+']').click();assert pc.get_attribute('data-mode')==mode
 pg.locator('[data-portrait-mic]').click();pg.wait_for_function('document.querySelector("[data-portrait-mic]").getAttribute("aria-pressed")==="true"')
 pc.evaluate('(c)=>window.beforeLoud=c.toDataURL()');pg.evaluate('fakeGain.gain.value=.7');pg.wait_for_timeout(300)
 assert pc.evaluate('c=>c.toDataURL()!==beforeLoud')
 pg.wait_for_function("Number(document.querySelector('.studio-coords').textContent.split(' / IN ')[1])>15")
 pg.evaluate('fakeGain.gain.value=0');pg.wait_for_function("Number(document.querySelector('.studio-coords').textContent.split(' / IN ')[1])<3",timeout=4000)
 pg.locator('[data-portrait-mic]').click();assert pg.evaluate('testStream.getTracks().every(t=>t.readyState==="ended")')
 pg.evaluate('window.denyMic=true');pg.locator('[data-portrait-mic]').click();pg.wait_for_function('document.querySelector("[data-portrait-status]").textContent.includes("denied")')
 pg.locator('[data-scatter]').click()
 pg.locator('[data-depth]').evaluate('e=>{e.value=75;e.dispatchEvent(new Event("input"))}');assert '75' in pg.locator('.studio-coords').inner_text()
 box=pc.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x+30,y+12);pg.mouse.up();assert 'X +0°' not in pg.locator('.studio-coords').inner_text()
 for key in ['trails','waves','links']:
  pg.locator('[data-'+key+']').click();assert pg.locator('[data-'+key+']').get_attribute('aria-pressed')=='true';pg.locator('[data-'+key+']').click()
 pg.locator('.crt-color-control input').evaluate('e=>{e.value=280;e.dispatchEvent(new Event("input"))}')
 assert pg.evaluate('PortfolioColor.current.hue')==280
 assert pg.locator('.lemon-lab').evaluate('e=>e.style.getPropertyValue("--fruit")')==pg.evaluate('PortfolioColor.current.ink')
 pg.evaluate('PortfolioColor.preset("blue")')
 result['controls']=True
 result['frame_intervals']=pg.evaluate("""()=>new Promise(done=>{let ds=[],last=0;function f(t){if(last)ds.push(t-last);last=t;if(ds.length<90)requestAnimationFrame(f);else{ds.sort((a,b)=>a-b);done([ds[45],ds[85]])}}requestAnimationFrame(f)})""")
 pg.locator('[data-cut]').click();pg.wait_for_function('probe.visual&&probe.audio&&probe.vib')
 dur=pg.evaluate('Math.max(probe.visual,probe.audio,probe.vib)-Math.min(probe.visual,probe.audio,probe.vib)')
 assert dur<200 and pg.evaluate('probe.duration')==30,dur
 result['cue_dispatch_ms']=round(dur,2)
 pg.wait_for_function('document.querySelector("[data-fruit-state]").textContent==="REFORMED"',timeout=5000)
 if O: pg.locator('.lemon-grid').screenshot(path=str(O/'lemon-study.png'))
 pg.goto(base+'/smell-test.html',wait_until='load');assert pg.locator('h1').inner_text().endswith('LEMON')
 pg.locator('[data-lemon-mic]').click();pg.wait_for_function('document.querySelector("[data-lemon-mic]").getAttribute("aria-pressed")==="true"')
 pg.evaluate('fakeGain.gain.value=.65');pg.wait_for_function('document.querySelector("[data-cut]").textContent==="CUT AGAIN"',timeout=4000)
 pg.locator('[data-lemon-mic]').click();assert pg.evaluate('testStream.getTracks().every(t=>t.readyState==="ended")')
 pg.emulate_media(reduced_motion='reduce');pg.evaluate('window.probe={}')
 pg.locator('[data-cut]').click();assert pg.locator('[data-lemon-canvas]').get_attribute('data-phase')=='still'
 assert not pg.evaluate('probe.audio||probe.vib')
 pg.goto(base+'/',wait_until='load');pg.wait_for_selector('[data-studio-controls]:visible');rig.scroll_into_view_if_needed()
 v=pc.evaluate('c=>c.toDataURL()');pg.wait_for_timeout(350);assert pc.evaluate('c=>c.toDataURL()')==v
 if O: rig.screenshot(path=str(O/'particle-portrait-hero.png'))
 for width in [320,390,768,1024,1440]:
  pg.set_viewport_size({'width':width,'height':900});pg.wait_for_timeout(60)
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 result.update({'no_page_overflow':True,'reduced_motion':True,'simulated_microphones':True,'page_errors':err,'http_errors':bad})
 assert not err and not bad,(err,bad)
 print(json.dumps(result));ctx.close();b.close()
server.shutdown()
