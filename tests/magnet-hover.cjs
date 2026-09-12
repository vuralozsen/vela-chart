/* Regresyon: alet SEÇİLİ ama henüz tıklanmadı — imleç gezerken mıknatısın nereye
   tutunacağı görünmeli (kullanıcı: "imleç çizim aleti seçtiğimde de mıknatısın
   tuttuğu yeri göstermeli").
   - trend aracı seçili + sadece pointermove (pointerdown YOK) → turuncu kılavuz çizilir
   - imleç grafikten çıkınca kılavuz kaybolur
   - cursor aracında hover kılavuz çizmez
   - çizim sürerken (drag) de kılavuz görünür
   NOT: hedef bar MUTLAKA ekranda görünür olmalı — state.bars tüm geçmişi taşır,
   rastgele indeks ekran dışına düşer ve gerçek fare olayı oraya ulaşmaz.
   Çalıştır: node tests/magnet-hover.cjs */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

/* overlay tuvalinde turuncu satir taramasi — BOLGEYE SINIRLI (CSS px).
   Bolge, barin dikey kilavuz cizgisinden UZAK secilir; boylece olculen sey
   yalnizca YATAY miknatis kilavuzudur (dikey cizgi tum satirlari kirletir). */
const orangeScan = (x0css, x1css) => `(()=>{
  const dpr=window.devicePixelRatio||1;
  const cv=document.querySelector('#overlay');
  const cx=cv.getContext('2d');
  const img=cx.getImageData(0,0,cv.width,cv.height).data;
  const X0=Math.round(${x0css}*dpr), X1=Math.min(cv.width,Math.round(${x1css}*dpr));
  let rows=0, ilkY=null;
  for(let y=0;y<cv.height;y+=1){
    for(let x=X0;x<X1;x+=1){
      const i=(y*cv.width+x)*4;
      if(img[i]>180 && img[i+1]>100 && img[i+1]<200 && img[i+2]<120){ rows++; if(ilkY==null) ilkY=Math.round(y/dpr); break; }
    }
  }
  return { rows, ilkY };
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

  const toolState = await p.evaluate(()=>{
    const cv=document.querySelector('#overlay');
    return { pe: getComputedStyle(cv).pointerEvents, cursor: getComputedStyle(cv).cursor };
  });
  ok(toolState.pe === 'auto', 'çizim aracı seçilince overlay imleç alıyor', toolState);

  /* EKRANDA GÖRÜNÜR, OHLC'leri arasinda EN GENIS bosluk olan bari sec:
     otede kalan test (miknatis tutmuyor) ancak boyle anlamli olur. */
  const pt = await p.evaluate(()=>{
    const cv = document.querySelector('#overlay');
    const r = cv.getBoundingClientRect();
    const ts = window.__chart.timeScale(), s = window.__vela.series;
    const bars = window.velaChart.state.bars;
    let pick = null, bestGap = -1;
    for(let i=bars.length-1; i>=0; i--){
      const x = ts.timeToCoordinate(bars[i].time);
      if(x==null || x <= r.width*0.40 || x >= r.width*0.75) continue;
      const ys = [bars[i].open,bars[i].high,bars[i].low,bars[i].close]
        .map(v=>s.priceToCoordinate(v)).filter(v=>v!=null).sort((a,b)=>a-b);
      let g = 0;
      for(let k=0;k<ys.length-1;k++) g = Math.max(g, ys[k+1]-ys[k]);
      if(g > bestGap){ bestGap = g; pick = { bar: bars[i], x, gap:g }; }
      if(bestGap > 70) break;
    }
    if(!pick) return null;
    const yL = s.priceToCoordinate(pick.bar.low);
    const yH = s.priceToCoordinate(pick.bar.high);
    /* ikinci hedef: bir sonraki görünür barın low'u (drag testi için) */
    let pick2 = null;
    for(let i=bars.length-1; i>=0; i--){
      const x2 = ts.timeToCoordinate(bars[i].time);
      if(x2!=null && x2 > pick.x + 60 && x2 < r.width*0.85){ pick2 = { bar: bars[i], x: x2 }; break; }
    }
    const yL2 = pick2 ? s.priceToCoordinate(pick2.bar.low) : yL;
    return { cx: r.left+pick.x, cy: r.top+yL, x: pick.x, yL, yH, gap: pick.gap,
             rangePx: Math.abs(yL-yH),
             cx2: pick2 ? r.left+pick2.x : null, cy2: r.top+yL2,
             ohlc: {o:pick.bar.open,h:pick.bar.high,l:pick.bar.low,c:pick.bar.close} };
  });
  ok(!!pt, 'ekranda görünür bir test barı bulundu', pt && {x:Math.round(pt.x), yL:Math.round(pt.yL), rangePx:Math.round(pt.rangePx)});
  if(!pt){ await browser.close(); process.exit(1); }

  /* --- 1) alet seçili, SADECE hover (pointerdown YOK) --- */
  await p.mouse.move(pt.cx - 60, pt.cy - 40);
  await p.mouse.move(pt.cx, pt.cy, { steps: 8 });
  await new Promise(r=>setTimeout(r,500));
  const hov = await p.evaluate(orangeScan(20, pt.x - 120));
  ok(hov.rows >= 1, 'alet seçiliyken HOVER ile mıknatıs kılavuzu çiziliyor (tıklamadan)', hov);

  /* --- 2) OHLC değerlerinden KESİN uzak nokta → kılavuz KAPANMALI --- */
  const far = await p.evaluate(()=>{
    const cv=document.querySelector('#overlay'), r=cv.getBoundingClientRect();
    const ts=window.__chart.timeScale(), s=window.__vela.series;
    const bars=window.velaChart.state.bars;
    /* pt ile AYNI bari bul: yine en genis bosluklu gorunur bar */
    let pick=null, bestGap=-1;
    for(let i=bars.length-1;i>=0;i--){
      const x=ts.timeToCoordinate(bars[i].time);
      if(x==null || x <= r.width*0.40 || x >= r.width*0.75) continue;
      const cy=[bars[i].open,bars[i].high,bars[i].low,bars[i].close]
        .map(v=>s.priceToCoordinate(v)).filter(v=>v!=null).sort((a,b)=>a-b);
      let g=0; for(let k=0;k<cy.length-1;k++) g=Math.max(g, cy[k+1]-cy[k]);
      if(g>bestGap){ bestGap=g; pick={bar:bars[i],x}; }
      if(bestGap > 70) break;
    }
    if(!pick) return null;
    const ys=[pick.bar.open,pick.bar.high,pick.bar.low,pick.bar.close].map(v=>s.priceToCoordinate(v)).filter(v=>v!=null).sort((a,b)=>a-b);
    /* en buyuk dikey bosluk: orta noktasi hem ust hem alt komsudan uzak */
    let best=null;
    for(let k=0;k<ys.length-1;k++){ const gap=ys[k+1]-ys[k];
      if(!best||gap>best.gap) best={gap, y:(ys[k]+ys[k+1])/2, alt:ys[k], ust:ys[k+1]}; }
    if(!best) return null;
    return { cx:r.left+pick.x, cy:r.top+best.y, mesafeUst:best.ust-best.y, mesafeAlt:best.y-best.alt, gap:best.gap, x:pick.x };
  });
  ok(far && far.mesafeUst>15 && far.mesafeAlt>15, 'OHLC\'den uzak test noktasi bulundu (>15px, miknatis toleransi 14px)', far && {gap:Math.round(far.gap), u:Math.round(far.mesafeUst), a:Math.round(far.mesafeAlt)});
  if(far){
    await p.mouse.move(far.cx, far.cy, { steps: 8 });
    await new Promise(r=>setTimeout(r,500));
    const mid = await p.evaluate(orangeScan(20, far.x - 120));
    ok(mid.rows === 0, 'OHLC değerlerinden uzakta kılavuz kapalı (mıknatıs tutmuyor)', mid);
  }

  /* --- 3) imleç grafikten çıkınca kaybolmalı --- */
  await p.mouse.move(pt.cx, pt.cy - pt.rangePx*0.5, { steps: 4 });
  await p.mouse.move(pt.cx, pt.cy, { steps: 4 });
  await new Promise(r=>setTimeout(r,400));
  await p.mouse.move(5, 5);
  await new Promise(r=>setTimeout(r,500));
  const gone = await p.evaluate(orangeScan(20, pt.x - 120));
  ok(gone.rows === 0, 'imleç grafikten çıkınca kılavuz kayboluyor', gone);

  /* --- 4) cursor aracında hover kılavuz çizmez --- */
  await p.evaluate(()=>{ const b=document.querySelector('.dtool[data-tool="cursor"]'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,300));
  await p.mouse.move(pt.cx - 40, pt.cy - 30);
  await p.mouse.move(pt.cx, pt.cy, { steps: 6 });
  await new Promise(r=>setTimeout(r,500));
  const cur = await p.evaluate(orangeScan(20, pt.x - 120));
  ok(cur.rows === 0, 'cursor aracında hover kılavuzu çizilmiyor', cur);

  /* --- 5) tekrar trend: tıkla + görünür başka barın low'una sürükle → kılavuz açık --- */
  await p.evaluate(()=>{ const b=document.querySelector('.dtool[data-tool="trend"]'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,300));
  await p.mouse.move(pt.cx, pt.cy, { steps: 5 });
  await p.mouse.down();
  if(pt.cx2){
    await p.mouse.move(pt.cx2, pt.cy2, { steps: 10 });
    await new Promise(r=>setTimeout(r,500));
    const dragging = await p.evaluate(orangeScan(20, Math.min(pt.x, pt.cx2-20) - 120));
    ok(dragging.rows >= 1, 'çizim sürerken (drag, snap noktasında) kılavuz görünüyor', dragging);
  }
  await p.mouse.up();
  await new Promise(r=>setTimeout(r,600));

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'magnet-hover GECTI' : `magnet-hover BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
