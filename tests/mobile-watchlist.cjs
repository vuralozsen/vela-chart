/* MOBIL IZLEME LISTESI + TICKER GIRISI (TV parite):
   1) wptoggle ile cekmece acilir → liste secici (#listsel) gorunur ve dokunulabilir
   2) liste seciciye dokununca liste dd acilir, diger listeye gecis calisir
   3) "+" dokun → arama modalı acılır, ticker yaz → ilk sonuca tap → sembol gecer
   4) sembol secilince cekmece kapanir (TV mobil davranisi)
*/
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
let fails = 0;
const ok = (c, name, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + name, extra !== undefined ? JSON.stringify(extra) : ''); if (!c) fails++; };
(async () => {
  const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await (await b.createBrowserContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 7000));

  /* 1) cekmeceyi ac (wptoggle dokun) */
  await p.tap('#wptoggle');
  await new Promise(r => setTimeout(r, 700));
  const s1 = await p.evaluate(() => {
    const wp = document.querySelector('#watchpanel');
    const sel = document.querySelector('#listsel');
    const r = sel.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { acik: !wp.classList.contains('hide'),
      selGorunur: r.width > 40 && r.height > 20,
      selEkranda: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      selHit: hit ? (hit.id || hit.className || hit.tagName) : null };
  });
  ok(s1.acik, 'cekmece aciliyor'); ok(s1.selGorunur && s1.selEkranda, 'liste secici gorunur ve ekranda', s1);
  ok(s1.selHit && (s1.selHit.includes('listsel') || s1.selHit.includes('lnm') || s1.selHit.includes('caret')), 'liste secici dokunmaya acik (ustunde baska katman yok)', s1.selHit);

  /* 2) liste seciciye tap → dd acilir; listeler arasi gecis */
  await p.tap('#listsel');
  await new Promise(r => setTimeout(r, 500));
  const s2 = await p.evaluate(() => {
    const dd = document.querySelector('#listdd');
    const rows = [...dd.querySelectorAll('.row')];
    return { acik: dd.classList.contains('open'), listeSayisi: rows.length,
      isimler: rows.map(x => x.textContent.trim().slice(0, 22)) };
  });
  ok(s2.acik, 'liste secici dokunmasi dd acar'); ok(s2.listeSayisi >= 1, 'listeler listelenir', s2.isimler);

  /* 3) + (wpadd) dokun → arama modal, ticker yaz, sonuc gelsin → LISTEYE EKLENIR (TV modu) */
  await p.tap('#wpadd');
  await new Promise(r => setTimeout(r, 600));
  const s3a = await p.evaluate(() => document.querySelector('#searchmodal').classList.contains('open'));
  ok(s3a, '+ dokunmasi arama modalini acar');
  await p.type('#sinput', 'GARAN');
  await new Promise(r => setTimeout(r, 2500));
  const s3b = await p.evaluate(() => ({
    sonuc: document.querySelectorAll('#sres .sres').length,
    ilk: (document.querySelector('#sres .sres') || {}).textContent?.trim().slice(0, 40) || null
  }));
  ok(s3b.sonuc > 0, 'ticker yazinca sonuclar gelir', s3b);

  /* 4) ilk sonuca tap → listeye EKLENIR (grafik degismez — TV davranisi) */
  const sembolOnce = await p.evaluate(() => window.velaChart.state.symbol);
  await p.evaluate(() => { const el = document.querySelector('#sres .sres'); el && el.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const s4 = await p.evaluate(() => ({
    listedeMi: window.velaChart.state.watch.includes('BIST:GARAN') ||
               (window.velaChart.listItems().some ? window.velaChart.listItems().includes('BIST:GARAN') : false),
    grafikAyni: window.velaChart.state.symbol === 'BIST:THYAO',
    modalKapali: !document.querySelector('#searchmodal').classList.contains('open')
  }));
  ok(s4.listedeMi, 'listeye ekleme modunda sembol listeye girer');
  ok(s4.grafikAyni, 'listeye ekleme modunda grafik degismez (TV davranisi)', sembolOnce);
  ok(s4.modalKapali, 'arama modalı kapanir');

  /* 4b) symbolbtn akisi → ticker gir → grafik gecer (TV mobil: cekmece kapanir) */
  await p.tap('#symbolbtn');
  await new Promise(r => setTimeout(r, 500));
  await p.type('#sinput', 'ASELS');
  await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => { document.querySelector('#sres .sres').click(); });
  await new Promise(r => setTimeout(r, 1800));
  const s5 = await p.evaluate(() => ({
    sembol: window.velaChart.state.symbol,
    cekmeceKapali: document.querySelector('#watchpanel').classList.contains('hide')
  }));
  ok(s5.sembol.includes('ASELS'), 'ticker girisi grafigi degistirir', s5.sembol);
  ok(s5.cekmeceKapali, 'sembol secilince cekmece kapanir (TV mobil)');

  ok(errs.length === 0, 'sayfa hatasi yok', errs.slice(0, 3));
  await b.close();
  console.log(fails ? `mobile-watchlist BASARISIZ (${fails})` : 'mobile-watchlist GECTI');
  process.exit(fails ? 1 : 0);
})();
