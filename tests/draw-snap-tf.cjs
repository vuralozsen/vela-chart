/* r110-drawsnap regresyon: günlükte çizilen çizim haftalıkta/aylıkta İÇİNDE bulunduğu
   barın konumunda çizilmeli (TV paritesi — TV yardım: "points will be displayed on marks
   that match the first days of the week"). r91'deki kesirli konum, hafta/ay ortası
   ankrajlı çizimleri bargen kaydırıyordu (kullanıcı: "günlükte çizdiğim çizim
   haftalıkta/aylıkta kayıyor").
   Ayrıca seçim çerçevesi/tutamaçları artık SCRx ile çizilir — 1W/1M'de tam bara oturmayan
   ankrajda tutamaçlar kaybolmuyor.
   Çalıştır: node tests/draw-snap-tf.cjs  (sunucu çalışır olmalı: node server.mjs) */
const PW = process.env.PW_CORE || 'C:/Users/v_ozs/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Users/v_ozs/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const { chromium } = require(PW);

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

const IN_PAGE = () => {
  const ORANGE=(r,g,b)=> r>200 && g>110 && g<190 && b<80;   // #ff9800 çizim rengi
  const BLUE=(r,g,b)=> Math.abs(r-41)<60 && Math.abs(g-98)<60 && b>200 && r<120; // #2962ff yalnız seçim çerçevesi
  function scan(pred){
    const cv=document.querySelector('#overlay');
    const cx=cv.getContext('2d');
    const img=cx.getImageData(0,0,cv.width,cv.height).data;
    const dpr=window.devicePixelRatio||1;
    const cols=new Set();
    for(let y=0;y<cv.height;y+=2){
      for(let x=0;x<cv.width;x+=1){
        const i=(y*cv.width+x)*4;
        if(pred(img[i],img[i+1],img[i+2])) cols.add(x);
      }
    }
    const px=[...cols].sort((a,b)=>a-b).map(x=>x/dpr);
    const groups=[];
    for(const c of px){ const g=groups[groups.length-1]; if(g && c-g[g.length-1]<=4) g.push(c); else groups.push([c]); }
    return groups.map(g=>+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(1));
  }
  const orangeCols=()=>scan(ORANGE);
  const blueCols =()=>scan(BLUE);
  function barContaining(T){
    const b=window.__vela.state.bars;
    if(!b||!b.length) return null;
    if(T<b[0].time) return b[0];
    let lo=0,hi=b.length-1;
    while(hi-lo>1){ const m=(lo+hi)>>1; if(b[m].time<=T) lo=m; else hi=m; }
    return b[lo];
  }
  function expectedX(T){
    const ts=window.__chart.timeScale();
    const ex=ts.timeToCoordinate(T);
    if(ex!=null) return {x:ex, mode:'exact'};
    const bar=barContaining(T);
    if(!bar) return null;
    const x=ts.timeToCoordinate(bar.time);
    return x==null?null:{x, mode:'containing-bar'};
  }
  /* r91 kesirli konumu geri hesapla (regresyon guard'ı için) */
  function fracX(T){
    const ts=window.__chart.timeScale();
    const bar=barContaining(T); if(!bar) return null;
    const x=ts.timeToCoordinate(bar.time); if(x==null) return null;
    const nb=window.__vela.state.bars; const i=nb.indexOf(bar); const nx=nb[i+1];
    if(!nx) return null; const xb=ts.timeToCoordinate(nx.time); if(xb==null) return null;
    const f=(T-bar.time)/(nx.time-bar.time);
    return +(x+f*(xb-x)).toFixed(1);
  }
  return { orangeCols, blueCols, expectedX, barContaining, fracX };
};

(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport:{width:1400,height:900} });
  const pageErrors=[];
  page.on('pageerror', e=>pageErrors.push(e.message));
  await page.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(7000);
  await page.evaluate(()=>{ try{ window.velaChart.setInt('1D'); }catch(e){} });
  await page.waitForTimeout(3500);

  /* ankrajlar SON 60 barda (1D görünür alanında): PERŞEMBE (1W kesiri f≈0.43) +
     ayın 12-19'u Salı (1M kesiri f≈0.4-0.6) — kesirli konumdan en çok sapan uçlar */
  const setup = await page.evaluate(()=>{
    const b=window.__vela.state.bars, n=b.length;
    const pc=b[n-1].close;
    let T1=null,T2=null;
    for(let i=n-60;i<n-6;i++){
      const d=new Date(b[i].time*1000);
      if(T1===null && d.getUTCDay()===4) T1=b[i].time;                 // perşembe
      if(T1!==null && T2===null && d.getUTCDate()>=12 && d.getUTCDate()<=19 && d.getUTCDay()===2) T2=b[i].time; // ay ortası salı
    }
    const key='vela.drw.'+window.__vela.state.symbol;
    localStorage.setItem(key, JSON.stringify([
      {type:'vline', color:'#ff9800', pts:[{time:T1, price:pc}]},
      {type:'vline', color:'#ff9800', pts:[{time:T2, price:pc}]},
    ]));
    localStorage.setItem('interval','1D');
    return { T1, T2, pc,
      d1:new Date(T1*1000).toISOString().slice(0,10),
      d2:new Date(T2*1000).toISOString().slice(0,10) };
  });
  ok(!!(setup.T1 && setup.T2), 'ankraj barları seçildi (perşembe + ay ortası, son 60 bar)', setup);

  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(7000);
  await page.mouse.move(10, 880);

  for(const iv of ['1D','1W','1M']){
    if(iv!=='1D'){ await page.evaluate(k=>window.velaChart.setInt(k), iv); await page.waitForTimeout(3000); }
    const m = await page.evaluate(({IN_PAGE_SRC, s})=>{
      const A=new Function('return ('+IN_PAGE_SRC+')()')();
      return { cols:A.orangeCols(), e1:A.expectedX(s.T1), e2:A.expectedX(s.T2),
        f1:A.fracX(s.T1), iv:window.__vela.state.interval };
    }, {IN_PAGE_SRC: IN_PAGE.toString(), s:setup});
    const near=(x)=>m.cols.length? m.cols.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a) : null;
    const g1=near(m.e1?m.e1.x:0), g2=near(m.e2?m.e2.x:0);
    ok(m.iv===iv, iv+': interval uygulandı', m.iv);
    ok(!!(m.e1 && m.e1.x!=null && g1!=null && Math.abs(g1-m.e1.x)<=3),
      iv+': T1 ('+setup.d1+') içinde bulunulan barın kolonunda', {beklenen:+(m.e1?m.e1.x:0).toFixed(1), olculen:g1, mod:m.e1&&m.e1.mode});
    ok(!!(m.e2 && m.e2.x!=null && g2!=null && Math.abs(g2-m.e2.x)<=3),
      iv+': T2 ('+setup.d2+') içinde bulunulan barın kolonunda', {beklenen:+(m.e2?m.e2.x:0).toFixed(1), olculen:g2, mod:m.e2&&m.e2.mode});
    if(iv==='1W' && m.f1!=null && g1!=null){
      ok(Math.abs(g1-m.f1)>=4, iv+': eski kesirli konum artık kullanılmıyor', {kesirliKonum:m.f1, olculen:g1});
    }
  }

  /* seçim çerçevesi: çizim TURUNCU → overlay'deki MAVİ pikseller yalnız seçim çerçevesi/tutamaçları.
     1W'da tam bara oturmayan ankraj seçilince mavi pikseller OLMALI (r110 öncesi xOf null → çerçeve yok) */
  await page.evaluate(k=>window.velaChart.setInt(k), '1W');
  await page.waitForTimeout(3000);
  const sf = await page.evaluate(({IN_PAGE_SRC, s})=>{
    const A=new Function('return ('+IN_PAGE_SRC+')()')();
    const before=A.blueCols();
    window.velaChart.select(0);
    return { before, after:A.blueCols(), e1:A.expectedX(s.T1) };
  }, {IN_PAGE_SRC: IN_PAGE.toString(), s:setup});
  ok(sf.before.length===0, '1W: seçimsizken mavi çerçeve pikseli yok', sf.before);
  ok(sf.after.length>0, '1W: seçimde çerçeve/tutamaç çiziliyor (r110 öncesi kayboluyordu)', sf.after);
  if(sf.e1 && sf.after.length){
    ok(Math.abs(sf.after.reduce((a,b)=>Math.abs(b-(sf.e1?sf.e1.x:0))<Math.abs(a-(sf.e1?sf.e1.x:0))?b:a) - (sf.e1?sf.e1.x:0))<=8,
      '1W: çerçeve çizimin ucunda', {beklenen:+(sf.e1?sf.e1.x:0).toFixed(1), cevreKolonlar:sf.after});
  }

  /* gidiş-dönüş: 1D'ye dönünce konum değişmemeli */
  await page.evaluate(()=>window.velaChart.setInt('1D'));
  await page.waitForTimeout(3000);
  const rt = await page.evaluate(({IN_PAGE_SRC, s})=>{
    const A=new Function('return ('+IN_PAGE_SRC+')()')();
    const cols=A.orangeCols(); const e1=A.expectedX(s.T1); const e2=A.expectedX(s.T2);
    const near=(x)=>cols.length? cols.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a) : null;
    return {g1:near(e1?e1.x:0), e1:e1?+(e1.x).toFixed(1):null, g2:near(e2?e2.x:0), e2:e2?+(e2.x).toFixed(1):null};
  }, {IN_PAGE_SRC: IN_PAGE.toString(), s:setup});
  ok(rt.e1!=null && rt.g1!=null && Math.abs(rt.g1-rt.e1)<=3, '1D dönüş: T1 konumu korundu', rt);
  ok(rt.e2!=null && rt.g2!=null && Math.abs(rt.g2-rt.e2)<=3, '1D dönüş: T2 konumu korundu', rt);

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors.slice(0,3));

  await browser.close();
  console.log(fails ? `\n${fails} BAŞARISIZ` : '\nTAMAM — tümü geçti');
  process.exit(fails?1:0);
})().catch(e=>{ console.error('HATA:', e); process.exit(1); });
