/* VURAL'IN 5 MADDEsi dogrulama (lokal):
   1) tek hamburger/wptoggle: topbar'da menu ikonu yok, tek liste ikonu
   2) izleme satirina dokun → ticker kutusu (searchmodal) acilir
   3) izleme listesinde dikey kaydirma: .wlist scrollHeight > clientHeight (scrollable)
   4) mobilde zoombar ( +/- kilit) gorunmez
   5) mobilde legend'de A/Y/D/K satiri yok (sadece fiyat)
*/
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new',
    executablePath: '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:3010/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 7000));
  let fails = 0;
  const ok = (c, n, x) => { console.log((c ? '  ✓ ' : '  ✗ ') + n, x !== undefined ? JSON.stringify(x) : ''); if (!c) fails++; };

  /* 1) hamburger sayisi */
  const ham = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#topbar button')].filter(el => {
      if (getComputedStyle(el).display === 'none' || el.hidden) return false;
      const paths = el.querySelectorAll('svg path');
      return [...paths].some(p => { const d = p.getAttribute('d') || ''; return /^M2 4h/.test(d) || /^M2 \d/.test(d) && d.includes('M2 9'); });
    });
    return btns.map(b => b.id);
  });
  ok(ham.length === 1 && ham[0] === 'wptoggle', 'tek hamburger: sadece wptoggle', ham);

  /* 4) zoombar gizli */
  const zb = await p.evaluate(() => { const z = document.querySelector('#zoombar'); return getComputedStyle(z).display; });
  ok(zb === 'none', 'mobilde zoombar (+/-/kilit) gizli', zb);

  /* 5) legend'de A/Y/D/K yok */
  const lg = await p.evaluate(() => document.querySelector('#legend').textContent);
  ok(!lg.includes('A '), 'mobilde legend OHLC satiri yok', lg.slice(0, 60));

  /* cekmeceyi ac */
  await p.evaluate(() => { document.querySelector('#wptoggle').click(); });
  await new Promise(r => setTimeout(r, 700));

  /* 3) wlist dikey scrollable */
  const sc = await p.evaluate(() => { const w = document.querySelector('.wlist');
    return { sh: w.scrollHeight, ch: w.clientHeight, scrollable: w.scrollHeight > w.clientHeight + 2,
      overflowY: getComputedStyle(w).overflowY }; });
  ok(sc.scrollable || sc.overflowY === 'auto', 'izleme listesi dikey kaydirilabilir', sc);

  /* 2) satira dokun → searchmodal acilir */
  const cdp = await p.target().createCDPSession();
  const row = await p.evaluate(() => { const r = document.querySelectorAll('.wrow')[1].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: row.x, y: row.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 800));
  const modal = await p.evaluate(() => ({ acik: document.querySelector('#searchmodal').classList.contains('open'),
    mod: document.querySelector('#searchmodal').dataset.mode }));
  ok(modal.acik, 'izleme satirina dokun → ticker kutusu acildi', modal);

  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));
  console.log(fails ? `TV-parite-mobil BASARISIZ (${fails})` : 'TV-parite-mobil GECTI');
  process.exit(fails ? 1 : 0);
})();
