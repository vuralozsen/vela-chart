/* Regresyon: TV parite paketi 2 (kullanici 2026-09-11)
   1) Çizimler son barın sağına UZATILABİLİR (SCR/snap future-time)
   2) Kesik/noktalı çizgi varyant araçları çalışır (trendDash/trendDot/hlineDash, ls sabit)
   3) İzleme listesinde SATIR NUMARALARI (TV) — 1,2,3...
   4) Fiyat decimal'leri sembol başına SABİT (bir uzayıp kısalmez)
   5) İzleme Listesi sekmesinde liste seçici AÇIK gelir (eski listelere erişim)
   6) Yeni liste oluşturma ESKİLERİ SİLMEZ
   7) Ölçek kilidi (pin) butonu
   8) Mıknatıs kılavuzu: snap fonksiyonu pending çizimde tutunma bilgisini işler (kod var)
   Çalıştır: node tests/tv-parity2.cjs */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

(async () => {
  const browser = await puppeteer.launch({ headless:'new', executablePath:CHROME,
    args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await (await browser.createBrowserContext()).newPage();
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message));
  await p.setViewport({ width:1400, height:900 });
  await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
  await new Promise(r=>setTimeout(r,7000));

  const drw = () => p.evaluate(()=>JSON.parse(localStorage.getItem('vela.drw.'+window.velaChart.state.symbol)||'[]'));
  const clearDrw = () => p.evaluate(()=>{ localStorage.setItem('vela.drw.'+window.velaChart.state.symbol,'[]'); });
  const stroke = async (toolId, fx1,fy1,fx2,fy2) => {
    await p.evaluate((t)=>{ const b=document.querySelector(`.dtool[data-tool="${t}"]`); b&&b.click(); }, toolId);
    await new Promise(r=>setTimeout(r,250));
    await p.evaluate(([t,x1,y1,x2,y2])=>{
      const cv=document.querySelector('#overlay');
      const pe=(type,x,y)=>cv.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,pointerId:9,buttons:1}));
      pe('pointerdown',x1,y1); pe('pointermove',x2,y2); pe('pointerup',x2,y2);
    },[toolId,1400*fx1,900*fy1,1400*fx2,900*fy2]);
    await new Promise(r=>setTimeout(r,450));
  };

  console.log('\n[1] Trend son barın sağına uzatılır');
  await clearDrw();
  await stroke('trend', 0.50,0.40, 0.88,0.60);
  let d = await drw();
  const lastT = await p.evaluate(()=>window.velaChart.state.bars.at(-1).time);
  ok(d.length===1 && d[0].pts.some(pt=>pt.time>lastT), 'çizim noktası son barın sağında kaydedildi', { n:d.length, sonNokta: d[0]?.pts?.[1]?.time>lastT });

  console.log('\n[2] Kesik/noktalı çizgi varyantları');
  await stroke('trendDash', 0.30,0.35, 0.70,0.55);
  await stroke('trendDot', 0.30,0.25, 0.70,0.30);
  await stroke('hlineDash', 0.40,0.30, 0.41,0.30);
  d = await drw();
  ok(d[1]?.type==='trendDash' && d[1]?.ls===1, 'trendDash kaydedildi (ls=1)', d[1]);
  ok(d[2]?.type==='trendDot' && d[2]?.ls===2, 'trendDot kaydedildi (ls=2)', d[2]);
  ok(d[3]?.type==='hlineDash' && d[3]?.ls===1, 'hlineDash kaydedildi (ls=1)', d[3]);
  const dashBtns = await p.evaluate(()=>['trendDash','trendDot','hlineDash'].map(t=>!!document.querySelector(`.dtool[data-tool="${t}"]`)));
  ok(dashBtns.every(Boolean), 'araç çubuğunda görünür', dashBtns);

  console.log('\n[3] İzleme listesi numaraları');
  const nums = await p.evaluate(()=>[...document.querySelectorAll('#wlist .wrow .num')].map(n=>n.textContent));
  ok(nums.length>=3 && nums[0]==='1' && nums[1]==='2' && nums[2]==='3', '1,2,3... numaralar', nums);

  console.log('\n[4] Decimal sabitliği');
  const fmt = await p.evaluate(()=>{
    const b=window.velaChart.state.bars; const last=b[b.length-1];
    return { a: fmtP(last.close), b: fmtP(last.close*1.0), c: fmtP(b[b.length-5].close) };
  });
  const dec = v => v.includes(',') ? v.split(',')[1].length : 0;
  ok(dec(fmt.a)===dec(fmt.b) && dec(fmt.a)===dec(fmt.c), 'aynı sembolde basamak sabit', fmt);

  console.log('\n[5] İzleme Listesi sekmesi → liste seçici AÇIK');
  await p.evaluate(()=>{ document.querySelector('.wphead .tab[data-tab="fav"]').click(); });
  await new Promise(r=>setTimeout(r,300));
  await p.evaluate(()=>{ document.querySelector('.wphead .tab[data-tab="watch"]').click(); });
  await new Promise(r=>setTimeout(r,400));
  const ddOpen = await p.evaluate(()=>document.getElementById('listdd').classList.contains('open'));
  ok(ddOpen, 'liste seçici otomatik açık (eski listelere erişim)', ddOpen);

  console.log('\n[6] Yeni liste eskileri silmez');
  const names0 = await p.evaluate(()=>window.velaChart.listNames());
  const items0 = await p.evaluate(()=>window.velaChart.listItems(0));
  await p.evaluate(()=>window.velaChart.createList('REGRESYON-TEST'));
  const st1 = await p.evaluate(()=>({ names: window.velaChart.listNames(), items0: window.velaChart.listItems(0), idx: window.velaChart.listIdx() }));
  ok(st1.names.length === names0.length+1, 'liste EKLENDİ', st1.names);
  ok(JSON.stringify(st1.items0)===JSON.stringify(items0), 'eski liste içeriği AYNEN duruyor');
  ok(st1.names[st1.idx]==='REGRESYON-TEST', 'yeni listeye geçildi', st1.names[st1.idx]);
  await p.evaluate(()=>window.velaChart.deleteList(window.velaChart.listNames().indexOf('REGRESYON-TEST')));
  const names2 = await p.evaluate(()=>window.velaChart.listNames());
  ok(names2.length===names0.length, 'test listesi temizlendi', names2);

  console.log('\n[7] Ölçek kilidi (pin) butonu');
  const pin = await p.evaluate(()=>{ const b=document.getElementById('pinbtn');
    if(!b) return {var:false}; b.click(); return { var:true, icon: b.textContent }; });
  ok(pin.var && pin.icon==='🔒', 'pin kilitlendi', pin);
  await p.evaluate(()=>document.getElementById('pinbtn').click());

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'tv-parity2 GECTI' : `tv-parity2 BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
