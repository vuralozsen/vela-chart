/* Regresyon: izleme listesi silme + ekleme sonrasi davranis (kullanici 2026-09-11)
   1) ✕ çarpı → sembol listeden SILINMELI (eski hata: removeFromActiveList ReferenceError —
      ciplak cagri v3 IIFE kapsaminda; kullanici 'carpıya basiyorum silmiyor')
   2) Ekleme sonrasi acik dropdown KAPANMALI (eski hata: pinDD kutusu ekranin sol ust
      (0,0)'una dusup alani saydam katmanla ortdugunden tiklamalar yutuluyordu —
      'yeni bir sey ekledigimde ekran donuyor' algisi)
   Çalıştır: node tests/watchlist-del-add.cjs */
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

  const watch = () => p.evaluate(()=>window.velaChart.state.watch.slice());

  console.log('\n[1] ✕ ile silme (gerçek fare tıklaması)');
  let w = await watch();
  ok(w.length > 0, 'liste dolu başlıyor', w.length);
  // en alttaki sembolü sil (THYAO'ya dokunmayalım — varsayılan grafik sembolü)
  const target = w[w.length-1] === 'BIST:THYAO' ? w[w.length-2] : w[w.length-1];
  const box = await p.evaluate((sym)=>{
    const x = [...document.querySelectorAll('#wlist .wrow .x')].find(el=>el.dataset.del===sym);
    if(!x) return null; const r = x.getBoundingClientRect();
    return { x:r.x+r.width/2, y:r.y+r.height/2 };
  }, target);
  ok(!!box, 'çarpı düğmesi bulundu', target);
  await p.mouse.click(box.x, box.y);
  await new Promise(r=>setTimeout(r,1200));
  w = await watch();
  ok(!w.includes(target), 'sembol listeden SİLİNDİ', w);
  ok(pageErrors.length===0, 'silmede sayfa hatası yok', pageErrors);

  console.log('\n[2] Ekleme sonrası dropdown kapanıyor (donma kökü)');
  // liste seçiciyi aç
  await p.evaluate(()=>document.getElementById('listsel').click());
  await new Promise(r=>setTimeout(r,400));
  let open0 = await p.evaluate(()=>document.getElementById('listdd').classList.contains('open'));
  ok(open0, 'liste seçici açık', open0);
  // artı ile sembol ekle
  await p.click('#wpadd');
  await new Promise(r=>setTimeout(r,400));
  await p.type('#sinput','TUPRS',{delay:30});
  await new Promise(r=>setTimeout(r,900));
  await p.keyboard.press('Enter');
  await new Promise(r=>setTimeout(r,1500));
  w = await watch();
  ok(w.includes('BIST:TUPRS'), 'sembol eklendi', w.slice(0,3));
  const open1 = await p.evaluate(()=>document.getElementById('listdd').classList.contains('open'));
  ok(!open1, 'ekleme sonrası liste seçici KAPANDI (donma kökü giderildi)', open1);
  // ekran ortası artık tıklanabilir (engel yok)
  const occ = await p.evaluate(()=>{
    const el = document.elementFromPoint(700, 500);
    return el ? (el.tagName+'.'+(el.className||'')) : null;
  });
  ok(!!occ, 'ekran ortası tıklanabilir (katman yok)', occ);
  ok(pageErrors.length===0, 'eklemede sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'watchlist-del-add GECTI' : `watchlist-del-add BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
