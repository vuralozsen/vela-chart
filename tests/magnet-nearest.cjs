/* Regresyon: snap() ikili arama doğruluğu + hover performansı.
   Hover takibi her fare hareketinde snap() çağırır; eskiden tüm barlar (1500) taranıp
   her biri için timeToCoordinate çağrılıyordu → O(n). Artık zaman-sıralı ikili arama:
   O(log n). Bu test:
     (1) DOĞRULUK — 12 farklı görünür barın low'una hover et, kılavuzun çizildiği y
         o barın low koordinatına eşit olmalı. Yanlış bar seçilseydi y farklı çıkardı.
     (2) PERFORMANS — 150 hareketin toplam süresi makul olmalı (bloklamıyor).
   Çalıştır: node tests/magnet-nearest.cjs */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

const guideScan = (x0css, x1css) => `(()=>{
  const dpr=window.devicePixelRatio||1;
  const cv=document.querySelector('#overlay');
  const img=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  const X0=Math.round(${x0css}*dpr), X1=Math.min(cv.width,Math.round(${x1css}*dpr));
  let ilkY=null;
  for(let y=0;y<cv.height;y+=1){
    for(let x=X0;x<X1;x+=1){
      const i=(y*cv.width+x)*4;
      if(img[i]>180 && img[i+1]>100 && img[i+1]<200 && img[i+2]<120){ ilkY=Math.round(y/dpr); break; }
    }
    if(ilkY!=null) break;
  }
  return ilkY;
})()`;

(async () => {
  const browser = await puppeteer.launch({ headless:'new', executablePath:CHROME,
    args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await (await browser.createBrowserContext()).newPage();
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message));
  await p.setViewport({ width:1400, height:900 });
  await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
  await new Promise(r=>setTimeout(r,7000));

  await p.evaluate(()=>{ const b=document.querySelector('.dtool[data-tool="trend"]'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,300));

  /* 12 görünür barın hedef koordinatları (low noktası) */
  const targets = await p.evaluate(()=>{
    const cv=document.querySelector('#overlay'), r=cv.getBoundingClientRect();
    const ts=window.__chart.timeScale(), s=window.__vela.series;
    const bars=window.velaChart.state.bars;
    const out=[];
    for(let i=bars.length-1;i>=0 && out.length<12;i--){
      const x=ts.timeToCoordinate(bars[i].time);
      if(x==null || x < r.width*0.10 || x > r.width*0.90) continue;
      const y=s.priceToCoordinate(bars[i].low);
      if(y==null) continue;
      out.push({ x, y, cx:r.left+x, cy:r.top+y, low:bars[i].low, time:bars[i].time });
    }
    return out.reverse();
  });
  ok(targets.length >= 10, 'yeterli sayıda görünür test barı bulundu', { n: targets.length });

  /* --- 1) DOĞRULUK: her barın low'una hover → kılavuz tam o fiyatta --- */
  let dogru = 0; const sapmalar = [];
  for(const t of targets){
    await p.mouse.move(t.cx - 45, t.cy - 26);
    await p.mouse.move(t.cx, t.cy, { steps: 4 });
    await new Promise(r=>setTimeout(r,260));
    /* barın solunda tara: yalnız YATAY kılavuz satırını yakalar */
    const gy = await p.evaluate(guideScan(Math.max(5, t.x - 200), t.x - 30));
    const sapma = gy == null ? null : Math.abs(gy - t.y);
    if(sapma != null && sapma <= 1.5) dogru++; else sapmalar.push({ x:Math.round(t.x), beklenen:Math.round(t.y), olculen:gy });
  }
  ok(dogru >= targets.length - 1, 'mıknatıs DOĞRU barın low fiyatına tutunuyor (ikili arama doğru)', { dogru, toplam: targets.length, sapmalar: sapmalar.slice(0,3) });

  /* --- 2) PERFORMANS: 150 hareket --- */
  const t0 = Date.now();
  for(let i=0;i<150;i++){
    const t = targets[i % targets.length];
    await p.mouse.move(t.cx + (i%7) - 3, t.cy + (i%5) - 2);
  }
  const ms = Date.now() - t0;
  const perMove = ms/150;
  ok(perMove < 25, 'hover takibi akıcı (150 hareket, bloklama yok)', { toplamMs: ms, hareketBasiMs: +perMove.toFixed(2) });

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'magnet-nearest GECTI' : `magnet-nearest BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
