/* Regresyon: kullanıcı bildirimi (2026-09-11)
   1) Grafik "iki koca mum" (full zoom) geliyordu  → kayıtlı range=1D + günlük grafik = 1 mum
   2) Alt+R sıfırlamıyordu (DEFRANGE = kayıtlı bozuk değeri geri yüklüyordu)
   3) İzleme listesinde tıklama bazen algılanmıyordu (her canlı tick'te innerHTML yeniden yazımı)
   4) Hacim + SMA/EMA/RSI hiç görünmüyordu (taze oturumda hiç gösterge aktif değildi)
   Çalıştır: node tests/bugfix-zoom-click.cjs                                        */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const MIN_BARS = 25;

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

const READ = `(() => {
  const c = window.velaChart.chart, st = window.velaChart.state;
  let vis=null, sp=null;
  try { const lr=c.timeScale().getVisibleLogicalRange(); vis = lr?Math.round(lr.to-lr.from):null;
        sp = c.timeScale().options().barSpacing; } catch(e){}
  const indEl = document.getElementById('indlist');
  return { range: st.range, interval: st.interval, active: st.active.map(a=>a.id),
           visibleBars: vis, barSpacing: sp,
           indText: indEl ? indEl.textContent : '',
           panes: (()=>{ try{ return c.panes().length; }catch(e){ return -1; } })() };
})()`;

(async () => {
  const browser = await puppeteer.launch({ headless:'new', executablePath:CHROME,
    args:['--no-sandbox','--disable-dev-shm-usage'] });

  const fresh = async (lsInit) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width:1600, height:900 });
    if (lsInit) {
      await p.goto(URL, { waitUntil:'domcontentloaded', timeout:60000 });
      await p.evaluate((kv)=>{ for (const k in kv) localStorage.setItem(k, kv[k]); }, lsInit);
    }
    await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
    await new Promise(r=>setTimeout(r,6000));
    return p;
  };

  console.log('\n[1] Taze oturum — zoom ve göstergeler');
  let p = await fresh();
  let s = await p.evaluate(READ);
  ok(s.visibleBars >= MIN_BARS, `en az ${MIN_BARS} mum gorunur`, { visibleBars:s.visibleBars, range:s.range });
  ok(s.barSpacing < 60, 'barSpacing makul (dev mum yok)', s.barSpacing);
  ok(s.active.includes('volume'), 'hacim varsayilan olarak ACIK', s.active);
  ok(s.active.includes('ma'), 'SMA varsayilan olarak ACIK', s.active);
  ok(s.active.includes('ema'), 'EMA varsayilan olarak ACIK', s.active);
  ok(/Hacim|Volume/i.test(s.indText) || s.active.includes('volume'), 'gosterge listesinde hacim gorunur');

  console.log('\n[2] Kayitli bozuk aralik (range=1D, gunluk grafik) — "iki koca mum" senaryosu');
  const p2 = await fresh({ range:'1D', interval:'1D' });
  const s2 = await p2.evaluate(READ);
  ok(s2.visibleBars >= MIN_BARS, 'bozuk kayitli aralik ekrani kilitlemiyor', { visibleBars:s2.visibleBars, range:s2.range });
  ok(s2.barSpacing < 60, 'barSpacing bozuk kayittan etkilenmiyor', s2.barSpacing);

  console.log('\n[3] Alt+R = grafigi sifirla');
  const before = await p2.evaluate(()=>{ window.velaChart.chart.timeScale().applyOptions({ barSpacing:120 }); return true; });
  await p2.keyboard.down('Alt'); await p2.keyboard.press('KeyR'); await p2.keyboard.up('Alt');
  await new Promise(r=>setTimeout(r,2500));
  const s3 = await p2.evaluate(READ);
  ok(before && s3.barSpacing < 60, 'Alt+R bozuk zoom\'u DUZELTIYOR', { barSpacing:s3.barSpacing, range:s3.range });
  ok(s3.visibleBars >= MIN_BARS, 'Alt+R sonrasi yeterli mum var', s3.visibleBars);

  console.log('\n[4] Izleme listesi — DOM kararliligi + tek tikla gecis');
  const p3 = await fresh();
  const stab = await p3.evaluate(async () => {
    const node = document.querySelector('#wlist .wrow');
    for (let i=0;i<5;i++) { try { await refreshQuotes(); } catch(e){} }
    await new Promise(r=>setTimeout(r,600));
    return { same: node === document.querySelector('#wlist .wrow') };
  });
  ok(stab.same, 'fiyat tazelemesi DOM dugumunu YENIDEN YAZMIYOR', stab);

  const syms = await p3.evaluate(()=>[...document.querySelectorAll('#wlist .wrow')].map(r=>r.dataset.sym));
  let good = 0;
  for (const sym of syms) {
    await p3.evaluate(async ()=>{ try{ await refreshQuotes(); }catch(e){} });   // tazeleme ARASINDA tikla
    const box = await p3.evaluate((s)=>{ const r=[...document.querySelectorAll('#wlist .wrow')].find(x=>x.dataset.sym===s);
      if(!r) return null; const b=r.getBoundingClientRect(); return { x:b.x+b.width/2, y:b.y+b.height/2 }; }, sym);
    if (!box) continue;
    await p3.mouse.click(box.x, box.y);
    await new Promise(r=>setTimeout(r,1300));
    if (await p3.evaluate(()=>window.velaChart.state.symbol) === sym) good++;
  }
  ok(syms.length > 0 && good === syms.length, `her sembol TEK tikla aciliyor (${good}/${syms.length})`);

  console.log('\n[5] Indikator menusu + RSI');
  const ind = await p3.evaluate(async () => {
    document.querySelector('#indbtn').click();
    await new Promise(r=>setTimeout(r,400));
    const dd = document.querySelector('.dd.open');
    const out = { opened: !!dd, rows: dd ? dd.querySelectorAll('[data-add]').length : 0 };
    if (dd) { out.sma = /SMA|Basit Ortalama/.test(dd.textContent); out.ema = /EMA|Üstel/.test(dd.textContent);
              out.rsi = /RSI/.test(dd.textContent); out.volume = /Hacim|Volume/.test(dd.textContent); }
    const n0 = window.velaChart.state.active.length;
    window.velaChart.addIndicator('rsi', {}, true);
    await new Promise(r=>setTimeout(r,1200));
    out.added = window.velaChart.state.active.length - n0;
    return out;
  });
  ok(ind.opened && ind.rows > 50, 'gosterge menusu aciliyor ve katalog dolu', { rows:ind.rows });
  ok(ind.sma && ind.ema && ind.rsi && ind.volume, 'SMA / EMA / RSI / Hacim menude var', ind);
  ok(ind.added === 1, 'RSI eklenebiliyor', ind.added);

  await browser.close();
  console.log('\n' + (fails === 0 ? 'bugfix-zoom-click GECTI' : `bugfix-zoom-click BASARISIZ (${fails} hata)`));
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
