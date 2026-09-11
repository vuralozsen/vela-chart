/* Regresyon: mobil dokunmatik eksen zoom (kullanici bildirimi 2026-09-11)
   TV semantiği:
   - FİYAT ekseninde iki parmak: AYIRMA = zoom-in, KAPATMA = zoom-out
   - FİYAT ekseninde tek parmak: YUKARI sürükleme = zoom-in
   - ZAMAN ekseninde iki parmak: AYIRMA = zoom-in; tek parmak: SAĞA = zoom-in
   Ölçüm: fiyat zoom → __priceZoomState().f0 (küçülür = zoom-in);
          zaman zoom → timeScale().options().barSpacing (büyür = zoom-in)
   Çalıştır: node tests/mobile-touch.cjs   (VELA_URL ile baska hedef) */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

(async () => {
  const browser = await puppeteer.launch({ headless:'new', executablePath:CHROME,
    args:['--no-sandbox','--disable-dev-shm-usage'] });
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width:390, height:720, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
  await new Promise(r=>setTimeout(r,6000));

  const f0 = () => p.evaluate(()=>window.__priceZoomState ? window.__priceZoomState().f0 : null);
  const resetZoom = () => p.evaluate(()=>{ if(window.__priceZoomReset) window.__priceZoomReset(); });
  const geo = () => p.evaluate(()=>{
    const r = document.querySelector('#chart').getBoundingClientRect();
    return { x:r.x, y:r.y, w:r.width, h:r.height,
      rw: (()=>{ try{ return window.velaChart.chart.priceScale('right').width(); }catch(e){ return 0; } })() };
  });
  const cdp = await p.target().createCDPSession();
  /* iki parmak karsi karsiya; d0->d1 mesafe degisimi. AYIRMA = d artar. */
  const pinch = async (x,y,d0,d1,axis='y',steps=10) => {
    const P = (dd, sign) => axis==='y' ? {x, y:y+sign*dd/2} : {x:x+sign*dd/2, y};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart', touchPoints:[
      {...P(d0,-1), id:1}, {...P(d0,+1), id:2}]});
    for(let i=1;i<=steps;i++){ const d = d0+(d1-d0)*i/steps;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove', touchPoints:[
        {...P(d,-1), id:1}, {...P(d,+1), id:2}]});
      await new Promise(r=>setTimeout(r,30)); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd', touchPoints:[]});
  };

  const G = await geo();
  const axX = G.x + G.w - G.rw/2;

  console.log('\n[1] Sag fiyat ekseni — pinch (TV: ayirma=zoom-in)');
  await resetZoom();
  const a0 = await f0();
  await pinch(axX, G.y + G.h/2, 60, 160, 'y');           // AYIRMA
  await new Promise(r=>setTimeout(r,1200));
  const a1 = await f0();
  ok(a0!=null && a1!=null && a1 < a0*0.8, 'ayirma = zoom-in', { f0:a0, f1:a1 });
  const auto = await p.evaluate(()=>window.velaChart.chart.priceScale('right').options().autoScale);
  ok(auto === true, 'autoScale korunuyor (canli tick güvenli)', auto);
  await pinch(axX, G.y + G.h/2, 160, 60, 'y');           // KAPATMA
  await new Promise(r=>setTimeout(r,1000));
  const a2 = await f0();
  ok(a2 > a1*1.2, 'kapatma = zoom-out', { f1:a1, f2:a2 });

  console.log('\n[2] Sag fiyat ekseni — tek parmak yukarı sürükleme (TV: zoom-in)');
  await resetZoom();
  const b0 = await f0();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart', touchPoints:[{x:axX, y:G.y+G.h/2, id:1}]});
  for(let i=1;i<=12;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
    touchPoints:[{x:axX, y:G.y+G.h/2 - i*7, id:1}]}); await new Promise(r=>setTimeout(r,25)); }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd', touchPoints:[]});
  await new Promise(r=>setTimeout(r,1000));
  const b1 = await f0();
  ok(b0!=null && b1!=null && b1 < b0-0.08, 'yukarı sürükleme zoom-in', { f0:b0, f1:b1 });
  const auto2 = await p.evaluate(()=>window.velaChart.chart.priceScale('right').options().autoScale);
  ok(auto2 === true, 'sürükleme autoScale bozmadı', auto2);
  await resetZoom();

  console.log('\n[3] Zaman ekseni — pinch (TV: ayirma=zoom-in)');
  const t0 = await p.evaluate(()=>window.velaChart.chart.timeScale().options().barSpacing);
  await pinch(G.x + G.w/2, G.y + G.h - 14, 40, 130, 'x');  // AYIRMA (yatay)
  await new Promise(r=>setTimeout(r,1000));
  const t1 = await p.evaluate(()=>window.velaChart.chart.timeScale().options().barSpacing);
  ok(t1 > t0*1.3, 'ayirma = zoom-in', { once:t0, sonra:t1 });
  await pinch(G.x + G.w/2, G.y + G.h - 14, 130, 40, 'x');  // KAPATMA geri
  await new Promise(r=>setTimeout(r,800));

  console.log('\n[4] Chart alanı — LWC doğal davranış korunmalı');
  const c0 = await p.evaluate(()=>window.velaChart.chart.timeScale().options().barSpacing);
  await pinch(G.x + G.w/2, G.y + G.h/2, 200, 90, 'y');
  await new Promise(r=>setTimeout(r,1200));
  const c1 = await p.evaluate(()=>window.velaChart.chart.timeScale().options().barSpacing);
  ok(c1 < c0, 'chart alanında pinch = zaman zoom (LWC)', { once:c0, sonra:c1 });
  const v0 = await p.evaluate(()=>{ const lr=window.velaChart.chart.timeScale().getVisibleLogicalRange(); return Math.round(lr.from); });
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart', touchPoints:[{x:G.x+G.w/2, y:G.y+G.h/2, id:1}]});
  for(let i=1;i<=10;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
    touchPoints:[{x:G.x+G.w/2+i*8, y:G.y+G.h/2, id:1}]}); await new Promise(r=>setTimeout(r,25)); }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd', touchPoints:[]});
  await new Promise(r=>setTimeout(r,800));
  const v1 = await p.evaluate(()=>{ const lr=window.velaChart.chart.timeScale().getVisibleLogicalRange(); return Math.round(lr.from); });
  ok(v0 !== v1, 'tek parmak pan bozulmadı', { once:v0, sonra:v1 });

  console.log('\n[5] Sol fiyat ekseni (TV ayari)');
  await p.evaluate(()=>{ window.velaChart.state.leftAxis=true; LS.set('leftAxis',true); window.applyLeftAxis(); });
  await new Promise(r=>setTimeout(r,600));
  const lw = await p.evaluate(()=>{ try{ return window.velaChart.chart.priceScale('left').width(); }catch(e){ return -1; } });
  ok(lw > 10, 'sol eksen açılabiliyor', lw);
  await resetZoom();
  const d0v = await f0();
  await pinch(G.x + lw/2, G.y + G.h/2, 40, 150, 'y');     // AYIRMA
  await new Promise(r=>setTimeout(r,1200));
  const d1v = await f0();
  ok(d0v!=null && d1v!=null && d1v < d0v*0.8, 'sol eksende pinch zoom-in', { f0:d0v, f1:d1v });

  console.log('\n[6] Alt+R fiyat zoom sıfırlaması');
  await pinch(axX, G.y + G.h/2, 160, 40, 'y');            // once zoom-out yap
  await new Promise(r=>setTimeout(r,800));
  const e0 = await f0();
  await p.keyboard.down('Alt'); await p.keyboard.press('KeyR'); await p.keyboard.up('Alt');
  await new Promise(r=>setTimeout(r,1500));
  const e1 = await f0();
  ok(Math.abs(e1-0.66)<0.01, 'Alt+R fiyat zoomunu varsayılana döndürüyor', { once:e0, sonra:e1 });
  const mR = await p.evaluate(()=>{ try{
    const ps = window.velaChart.chart.priceScale('right').options();
    return ps.scaleMargins.top.toFixed(2)+'/'+ps.scaleMargins.bottom.toFixed(2);
  }catch(e){ return null; } });
  ok(mR === '0.08/0.26', 'scaleMargins varsayilanda', mR);
  await p.evaluate(()=>{ window.velaChart.state.leftAxis=false; LS.set('leftAxis',false); window.applyLeftAxis(); });

  await browser.close();
  console.log('\n' + (fails===0 ? 'mobile-touch GECTI' : `mobile-touch BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
