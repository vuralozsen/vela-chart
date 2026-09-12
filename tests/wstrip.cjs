/* wstrip (grafik alti izleme seridi) dogrulama: mobilde gorunur, satirlar dolu,
   secili buyuk/beyaz, dokununca sembol gecer */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
/* gercek dokunma: CDP touch (puppeteer tap bazi durumlarda click uretmeyebilir) */
async function cdpTouch(p, x, y) {
  const cdp = await p.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await new Promise(r => setTimeout(r, 80));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new',
    executablePath: '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:3010/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));
  let fails = 0;
  const ok = (c, n, x) => { console.log((c ? '  ✓ ' : '  ✗ ') + n, x !== undefined ? JSON.stringify(x) : ''); if (!c) fails++; };
  const strip = await p.evaluate(() => {
    const el = document.querySelector('#wstrip');
    const r = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('.wsrow')];
    const sel = el.querySelector('.wsrow.sel');
    return { gorunur: r.height > 60, satir: rows.length,
      seciliBuyuk: sel ? getComputedStyle(sel.querySelector('.wst')).fontSize : null,
      renk: sel ? getComputedStyle(sel.querySelector('.wst')).color : null,
      seciliSembol: sel ? sel.dataset.sym : null };
  });
  ok(strip.gorunur, 'wstrip gorunur (grafik alti)', strip);
  ok(strip.satir >= 3, 'satirlar dolu', strip.satir);
  ok(strip.seciliBuyuk === '22px', 'secili ticker buyuk (22px TV carousel)', strip.seciliBuyuk);
  ok(strip.renk === 'rgb(255, 255, 255)', 'secili ticker beyaz', strip.renk);
  // seritteki baska satira dokun → sembol gecer
  const otherInfo = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#wstrip .wsrow')];
    const el = rows.find(r => !r.classList.contains('sel'));
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { sym: el.dataset.sym, x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  if (otherInfo) {
    await cdpTouch(p, otherInfo.x, otherInfo.y);
    await new Promise(r2 => setTimeout(r2, 2000));
    const now = await p.evaluate(() => window.velaChart.state.symbol);
    ok(now === otherInfo.sym, 'seritteki satira dokun → sembol gecer', { beklenen: otherInfo.sym, gelen: now });
  }
  // dikey kaydirma: 5 satir sigmiyorsa scrollable olmali; sigiyorsa zaten gezinme gereksiz
  const sc = await p.evaluate(() => { const el = document.querySelector('#wstrip');
    return { sh: el.scrollHeight, ch: el.clientHeight, scrollable: el.scrollHeight > el.clientHeight + 2,
      overflowY: getComputedStyle(el).overflowY, maxH: getComputedStyle(el).maxHeight }; });
  ok(sc.scrollable || sc.overflowY === 'auto' || strip.satir <= 4, 'serit dikey kaydirma hazir (overflow:auto)', sc);
  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));
  console.log(fails ? `wstrip BASARISIZ (${fails})` : 'wstrip GECTI');
  process.exit(fails ? 1 : 0);
})();
