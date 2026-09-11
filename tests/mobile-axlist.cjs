/* Regresyon: mobil tarih ekseni + katlanabilir gösterge listesi (kullanici 2026-09-11)
   1) Mobilde drawbar (çizim araçları) chart'ın ÜZERİNE fixed biniyordu → tarihler görünmüyordu.
      Artık akışta, chart'ın altında; zaman ekseni bölgesi canvas'a açık.
   2) Gösterge listesi başlığına tıkla → katlan/aç (ok ▾/▸ döner), LS'e kalıcı.
   Çalıştır: node tests/mobile-axlist.cjs */
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
  await p.setViewport({ width:390, height:720, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
  await new Promise(r=>setTimeout(r,7000));

  console.log('\n[1] Mobilde tarih ekseni (zaman ekseni) erişilebilir');
  const ax = await p.evaluate(()=>{
    const cr = document.querySelector('#chart').getBoundingClientRect();
    const db = document.querySelector('#drawbar');
    const dbr = db ? db.getBoundingClientRect() : null;
    const y = cr.bottom - 12, x = cr.left + cr.width/2;
    const el = document.elementFromPoint(x, y);
    return { probe: el ? el.tagName : null, chartBottom: Math.round(cr.bottom),
      drawbarTop: dbr ? Math.round(dbr.top) : null, drawbarPos: db ? getComputedStyle(db).position : null,
      vh: innerHeight };
  });
  ok(ax.probe === 'CANVAS', 'zaman ekseni bölgesi chart canvas\'ında (örtü yok)', ax);
  ok(ax.drawbarPos === 'static', 'drawbar fixed değil, akışta', ax.drawbarPos);
  ok(ax.drawbarTop >= ax.chartBottom, 'drawbar chart\'ın ALTINDA başlıyor', ax);

  console.log('\n[2] Gösterge listesi — katla/aç');
  const snap = () => p.evaluate(()=>{
    const il=document.querySelector('#indlist');
    return { open: window.velaChart.state.indOpen, collapsed: il.classList.contains('collapsed'),
      chips: il.querySelectorAll('.chip').length,
      head: (il.querySelector('.ilhead')||{}).textContent || null,
      h: Math.round(il.getBoundingClientRect().height) };
  });
  const s0 = await snap();
  ok(s0.head && s0.head.includes('Göstergeler'), 'başlık görünüyor', s0.head);
  ok(s0.chips >= 3, 'çipler açıkken görünür', s0.chips);
  await p.evaluate(()=>document.querySelector('#indlist .ilhead').click());
  await new Promise(r=>setTimeout(r,400));
  const s1 = await snap();
  ok(s1.open === false && s1.collapsed === true, 'tıklama KAPATIYOR', s1);
  ok(s1.h < s0.h * 0.5, 'kapalıyken yükseklik ciddi küçülüyor', { once:s0.h, sonra:s1.h });
  ok(/▸/.test(s1.head||''), 'ok ▸ (kapalı) durumunda', s1.head);
  const ls1 = await p.evaluate(()=>LS.get('indOpen', null));
  ok(ls1 === false, 'durum LS\'e yazılıyor', ls1);
  await p.evaluate(()=>document.querySelector('#indlist .ilhead').click());
  await new Promise(r=>setTimeout(r,400));
  const s2 = await snap();
  ok(s2.open === true && s2.collapsed === false && s2.chips === s0.chips, 'ikinci tıklama YENİDEN AÇIYOR', s2);
  ok(/▾/.test(s2.head||''), 'ok ▾ (açık) durumunda', s2.head);

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'mobile-axlist GECTI' : `mobile-axlist BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
