/* CDP touchmove scroll'u tetiklemiyor olabilir (headless). Scroll'u JS ile zorla:
   wstrip.scrollTop = X yapip scroll event + wheel-selector'un calistigini dogrula.
   Ayrica gercek cihazda native scroll calisir; headless'ta Programatik test yeterli. */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
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
  const before = await p.evaluate(() => window.velaChart.state.symbol);
  // JS ile scroll (yatay tek satir bant) — wheel selector 160ms debounce sonrasi sembol degistirmeli
  await p.evaluate(() => { const s = document.querySelector('#wstrip'); s.scrollLeft = s.scrollWidth; });
  await new Promise(r => setTimeout(r, 1500));
  const after = await p.evaluate(() => window.velaChart.state.symbol);
  ok(after !== before, 'kaydirma → merkez satir secildi', { once: before, sonra: after });
  // secili satir ortada mi
  const centerOk = await p.evaluate(() => {
    const s = document.querySelector('#wstrip');
    const sel = s.querySelector('.wsrow.sel');
    if (!sel) return false;
    const sr = s.getBoundingClientRect(), b = sel.getBoundingClientRect();
    return Math.abs((b.left + b.width / 2) - (sr.left + sr.width / 2)) < 120;
  });
  ok(centerOk, 'secili satir merkezde (snap calisiyor)');
  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));
  console.log(fails ? `tekerlek BASARISIZ (${fails})` : 'tekerlek GECTI');
  process.exit(fails ? 1 : 0);
})();
