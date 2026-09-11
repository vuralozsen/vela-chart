/* Regresyon: sembol ekleme + Alt+W (kullanici bildirimi 2026-09-11)
   1) Artı-aramada Enter → sembol AKTİF izleme listesine eklenir (eski hata:
      addToActiveList ReferenceError — sessiz başarısızlık)
   2) Aynı sembol tekrar → "zaten listede" (liste değişmez)
   3) Hızlı yazıp hemen Enter (sonuçlar gelmeden) → pendingEnter akışı yine ekler
   4) Alt+W → ekrandaki sembol aktif listeye eklenir; tekrarı etkisiz
   Çalıştır: node tests/search-add.cjs */
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
  await new Promise(r=>setTimeout(r,6000));

  const watch = () => p.evaluate(()=>window.velaChart.state.watch.slice());

  console.log('\n[1] Artı-arama: TCELL yaz → sonuçlar → Enter');
  await p.click('#wpadd');
  await new Promise(r=>setTimeout(r,400));
  await p.type('#sinput','TCELL',{delay:40});
  await new Promise(r=>setTimeout(r,900));
  const first = await p.evaluate(()=>document.querySelector('#sres .sres')?.dataset.sym);
  await p.keyboard.press('Enter');
  await new Promise(r=>setTimeout(r,1500));
  let w = await watch();
  ok(!!first && w[0]===first, 'yeni sembol listenin başına eklendi', { beklenen:first, liste:w.slice(0,3) });

  console.log('\n[2] Aynı sembol tekrar — "zaten listede"');
  const lenBefore = w.length;
  await p.click('#wpadd'); await new Promise(r=>setTimeout(r,400));
  await p.type('#sinput','TCELL',{delay:40});
  await new Promise(r=>setTimeout(r,900));
  await p.keyboard.press('Enter');
  await new Promise(r=>setTimeout(r,1200));
  w = await watch();
  ok(w.length===lenBefore && w[0]===first, 'liste değişmedi', { once:lenBefore, sonra:w.length });

  console.log('\n[3] Hızlı yaz + hemen Enter (sonuç gelmeden) — FROTO');
  await p.click('#wpadd'); await new Promise(r=>setTimeout(r,400));
  await p.type('#sinput','FROTO',{delay:15});
  await p.keyboard.press('Enter');                       // debounce henüz dolmadı
  await new Promise(r=>setTimeout(r,2500));
  w = await watch();
  const froto = w.find(x=>/FROTO/i.test(x));
  ok(!!froto, 'erken Enter da ekledi (pendingEnter)', w.slice(0,3));

  console.log('\n[4] Alt+W — ekrandaki sembolü listeye ekle');
  // grafik sembolünü aramayla değiştir: SISE
  await p.click('#symbolbtn'); await new Promise(r=>setTimeout(r,400));
  await p.type('#sinput','SISE',{delay:40});
  await new Promise(r=>setTimeout(r,900));
  await p.keyboard.press('Enter');
  await new Promise(r=>setTimeout(r,2500));
  const cur = await p.evaluate(()=>window.velaChart.state.symbol);
  ok(/SISE/i.test(cur), 'grafik SISE olarak değişti', cur);
  await p.keyboard.down('Alt'); await p.keyboard.press('KeyW'); await p.keyboard.up('Alt');
  await new Promise(r=>setTimeout(r,1000));
  w = await watch();
  ok(w.includes(cur), 'Alt+W sembolü ekledi', { sym:cur, liste:w.slice(0,3) });
  const lenW = w.length;
  await p.keyboard.down('Alt'); await p.keyboard.press('KeyW'); await p.keyboard.up('Alt');
  await new Promise(r=>setTimeout(r,800));
  w = await watch();
  ok(w.length===lenW, 'Alt+W tekrarı etkisiz', { once:lenW, sonra:w.length });

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'search-add GECTI' : `search-add BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
