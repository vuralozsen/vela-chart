/* Vela Chart — CANLI MUM MOTORU testi (gerçek Chrome)
   Kanıtlanan hata: canlı fiyat gelirken grafikte YENİ MUM AÇILMIYORDU — tüm tick'ler
   sayfa yüklendiğindeki son muma yazılıyordu ("izleme listesi canlı, grafik donuk").
   Bu test: yerinde güncelleme + periyot devrinde yeni mum + koruma + uzlaştırma + GERÇEK akış. */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const TZ = 3 * 3600; // BIST UTC+3 (ct() ile aynı)

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    protocolTimeout: 600000, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  const fails = [];
  const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(3000);

  console.log('\nCANLI MUM MOTORU — 1m kripto (24/7 açık, gerçek akış test edilebilir)');
  const tSw = Date.now();
  await ev(() => window.velaChart.pickSymbol('BINANCE:BTCUSDT'));
  await ev(() => window.velaChart.setInt('1m'));
  /* periyot gerçekten 1m'e oturana kadar bekle (1D barları üzerinde ölçüm yapmamak için) */
  await page.waitForFunction(() => { const V = window.velaChart, b = V.state.bars;
    const L = b[b.length - 1], now = Math.floor(Date.now() / 1000);
    return V.state.interval === '1m' && b.length > 100 && L.time > now - 300; }, { timeout: 30000 });
  console.log(`  … 1m barları yerleşti (${Date.now() - tSw} ms)`);
  await wait(500);

  const s0 = await ev(() => { const V = window.velaChart, b = V.state.bars, L = b[b.length - 1];
    return { n: b.length, t: L.time, c: L.close, sym: V.state.symbol, iv: V.state.interval,
      age: Math.floor(Date.now() / 1000) - L.time, seri: V.main.data().slice(-1)[0] }; });
  ok(s0.sym === 'BINANCE:BTCUSDT' && s0.iv === '1m', `sembol/periyot: ${s0.sym} ${s0.iv}`);
  ok(s0.n > 100, `bar yüklendi: ${s0.n} bar (son bar ${new Date(s0.t * 1000).toISOString().slice(11, 19)}Z)`);
  ok(s0.age < 300, `son mum TAZE: şu andan ${s0.age} sn geride (mumlar geliyor)`);
  ok(s0.seri && s0.seri.time === s0.t + TZ, `son mum grafikte veriyle hizalı (seri ${s0.seri && s0.seri.time} = veri ${s0.t + TZ})`);

  // A) aynı periyot içi tick → son mum YERİNDE güncellenmeli, yeni mum açılmamalı
  const A = await ev(() => { const V = window.velaChart, b = V.state.bars, L = b[b.length - 1];
    const b0 = { n: b.length, t: L.time, c: L.close };
    V.applyQuote({ lp: L.close + 7, lp_time: L.time + 10 });
    const L1 = V.state.bars[V.state.bars.length - 1];
    return { b0, n: V.state.bars.length, t: L1.time, c: L1.close, h: L1.high,
      seri: V.main.data().slice(-1)[0] }; });
  ok(A.n === A.b0.n && A.t === A.b0.t, `A) aynı periyot: bar sayısı ${A.b0.n}→${A.n}, mum zamanı sabit`);
  ok(Math.abs(A.c - (A.b0.c + 7)) < 1e-6 && Math.abs(A.seri.close - (A.b0.c + 7)) < 1e-6,
    `A) mum canlı fiyatla güncellendi (${A.b0.c} → ${A.c}) ve grafiğe işlendi`);
  ok(A.h >= A.b0.c + 7, `A) high canlı fiyata çekildi: ${A.h}`);

  // B) periyot devri → YENİ MUM AÇILMALI (asıl hata buydu)
  const B = await ev(() => { const V = window.velaChart, b = V.state.bars, L = b[b.length - 1];
    const b0 = { n: b.length, t: L.time, c: L.close };
    V.applyQuote({ lp: L.close + 15, lp_time: L.time + 70 });   // tam 1 periyot ileri
    const L1 = V.state.bars[V.state.bars.length - 1];
    return { b0, n: V.state.bars.length, t: L1.time, o: L1.open, c: L1.close,
      seri: V.main.data().slice(-1)[0] }; });
  ok(B.n === B.b0.n + 1, `B) YENİ MUM AÇILDI: ${B.b0.n} → ${B.n}`);
  ok(B.t === B.b0.t + 60, `B) yeni mumun zamanı tam 1 periyot ileri (+60 sn)`);
  ok(B.o === B.b0.c + 15 && B.c === B.b0.c + 15, `B) yeni mum canlı fiyatla açıldı (A/Y/D/K = ${B.o})`);
  ok(B.seri && B.seri.time === B.b0.t + 60 + TZ, `B) yeni mum GRAFİĞE çizildi (seri zamanı ${B.seri && B.seri.time})`);

  // C) korumalar: eski damga ve dev boşluk yeni mum açmamalı (uzlaştırma devralır)
  const C = await ev(() => { const V = window.velaChart, L = V.state.bars.slice(-1)[0];
    const n0 = V.state.bars.length;
    V.applyQuote({ lp: L.close + 1, lp_time: L.time + 5 });        // eski damga
    const n1 = V.state.bars.length;
    V.applyQuote({ lp: L.close + 99, lp_time: L.time + 10 * 60 }); // dev boşluk
    const n2 = V.state.bars.length;
    return { n0, n1, n2 }; });
  ok(C.n1 === C.n0 && C.n2 === C.n0, `C) koruma: eski damga ve dev boşluk mum açmadı (${C.n0}/${C.n1}/${C.n2})`);

  // D) uzlaştırma tazelemesi (fresh=1) veriyi tazelemeli ama zoom'u bozmamalı
  const D = await ev(async () => { const V = window.velaChart;
    const r0 = V.chart.timeScale().getVisibleLogicalRange();
    const t0 = V.state.bars.slice(-1)[0].time;
    await V.loadBars(true, true, true);
    const r1 = V.chart.timeScale().getVisibleLogicalRange();
    const t1 = V.state.bars.slice(-1)[0].time;
    return { r0: r0 && [r0.from, r0.to], r1: r1 && [r1.from, r1.to], t0, t1 }; });
  const drift = (D.r0 && D.r1) ? Math.max(Math.abs(D.r0[0] - D.r1[0]), Math.abs(D.r0[1] - D.r1[1])) : 999;
  ok(drift < 3, `D) uzlaştırma görünür aralığı bozmadı (kayma ${drift.toFixed(2)} bar)`);
  ok(D.t1 >= D.t0, `D) veri tazelendi (son bar ${D.t0} → ${D.t1})`);

  // E) GERÇEK canlı akış: mum kendiliğinden ilerlemeli
  /* ONEMLI: B adimi seriye GELECEK damgali sentetik mum basar. O mum temizlenmezse
     gercek veri ona yetisene kadar E yanlislikla "ilerlemedi" gorunur (test kusuru).
     Bu yuzden once seriyi sunucudan temiz bastan kuru, sonra olcume basla. */
  await ev(() => window.velaChart.pickSymbol('BINANCE:BTCUSDT'));
  await page.waitForFunction(() => { const V = window.velaChart, b = V.state.bars;
    const L = b[b.length - 1], now = Math.floor(Date.now() / 1000);
    return b.length > 100 && L.time <= now + 5 && L.time > now - 400; }, { timeout: 45000 });
  console.log('  … seri sunucudan temiz kuruldu, gerçek canlı akış izleniyor: 90 sn');
  await wait(1000);
  const tBegin = await ev(() => window.velaChart.state.bars.slice(-1)[0].time);
  console.log(`  … olcum baslangici bar: ${new Date(tBegin * 1000).toISOString().slice(11, 19)}Z`);
  await wait(90000);
  const E = await ev(() => ({ t: window.velaChart.state.bars.slice(-1)[0].time,
    c: window.velaChart.state.bars.slice(-1)[0].close,
    seri: window.velaChart.main.data().slice(-1)[0].time,
    live: document.getElementById('livetxt').textContent,
    dot: document.getElementById('livedot').classList.contains('on') }));
  ok(E.t > tBegin, `E) CANLI: mum kendiliğinden ilerledi (+${(E.t - tBegin) / 60} dk), son fiyat ${E.c}`);
  ok(Math.floor(Date.now() / 1000) - E.t < 120, `E) son mum TAZE (şu andan ${Math.floor(Date.now() / 1000) - E.t} sn geride)`);
  ok(E.seri === E.t + TZ, `E) ilerleyen mum grafikte (seri ${E.seri} = veri ${E.t + TZ})`);
  ok(E.dot && /canlı/i.test(E.live), `E) canlı bağlantı göstergesi: "${E.live}"`);

  ok(errs.length === 0, `JS hatası: ${errs.length}${errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''}`);

  console.log('\n' + '='.repeat(46));
  console.log(fails.length ? `BAŞARISIZ (${fails.length}):\n - ` + fails.join('\n - ') : 'CANLI MUM TESTLERİ GEÇTİ ✓');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ:', e.message); process.exit(2); });
