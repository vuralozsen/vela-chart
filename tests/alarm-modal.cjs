/* r112-alarmmodal regresyon: kalıcı alarm uyarısı.
   Kullanıcı isteği: alarm tetiklendiğinde hangi ticker açık olursa olsun ekranda uyarı çıkmalı,
   KULLANICI kapatana kadar kaybolmamalı; ekran kapalıyken/sayfa kapalıyken tetiklenmişse
   açılışta gösterilmeli.
   Çalıştır: node tests/alarm-modal.cjs  (sunucu çalışır olmalı: node server.mjs) */
const PW = process.env.PW_CORE || 'C:/Users/v_ozs/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Users/v_ozs/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const { chromium } = require(PW);

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => console.log('  PAGEERROR:', e.message));

  const modalState = () => page.evaluate(() => {
    const m = document.getElementById('alarmModal');
    if (!m) return { open: false };
    const cs = getComputedStyle(m);
    const items = [...m.querySelectorAll('.aitem')].map(it => ({
      sym: it.querySelector('.sym')?.textContent,
      txt: it.querySelector('.atxt')?.textContent,
    }));
    return { open: cs.display !== 'none', z: +cs.zIndex, items,
      aboveVmodal: +cs.zIndex >= 300, count: m.querySelector('.acnt')?.textContent };
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.velaChart, null, { timeout: 60000 });
  await wait(1500);

  /* açılışta uyarı yok (temiz profil) */
  ok(!(await modalState()).open, 'temiz açılışta alarm uyarısı çıkmaz');

  const curSym = await page.evaluate(() => window.velaChart.state.symbol);

  /* 1) BAŞKA TICKER AÇIKKEN BAŞKA SEMBOLÜN ALARMI: ekranın ortasında çıkar */
  await page.evaluate(() => window.velaChart.fireAlertTest('BIST:GARAN', 100, 101));
  await wait(300);
  let st = await modalState();
  ok(st.open, 'alarm tetiklenince uyarı ekranda (kapatılana kadar kalıcı)');
  ok(st.aboveVmodal, 'uyarı z-index 300+ — her panel/modalin üstünde', st.z);
  ok(st.items.length === 1 && st.items[0].sym === 'BIST:GARAN', 'uyarıda tetiklenen sembol görünür', st.items);
  ok(st.items[0] && /hedef\s*100/.test(st.items[0].txt || ''), 'uyarı metni hedefi içerir', st.items[0] && st.items[0].txt);
  const shownSym = await page.evaluate(() => window.velaChart.state.symbol);
  ok(shownSym === curSym, 'uyarı açık tickeri değiştirmez (hangi semboldeysek o kalır)', { curSym, shownSym });

  /* 2) KALICILIK: 6 sn sonra hâlâ ekranda (eski toast 4.2 sn'de kayboluyordu) */
  await wait(6000);
  ok((await modalState()).open, '6 sn sonra hâlâ ekranda — kendiliğinden gitmez');

  /* 3) localStorage'a yazıldı (kapatıp açınca tekrar gösterilecek) */
  const unack = await page.evaluate(() => window.velaChart.alarmUnack());
  ok(Array.isArray(unack) && unack.length === 1 && unack[0].symbol === 'BIST:GARAN',
    'tetikleme kalıcı listede (vela.alarmUnack)', unack && unack.length);

  /* 4) İKİNCİ ALARM ÜSTÜNE EKLENİR (aracı kapatmadan başka alarm da tetiklenirse) */
  await page.evaluate(() => window.velaChart.fireAlertTest('BIST:ASELS', 55, 56));
  await wait(300);
  st = await modalState();
  ok(st.open && st.items.length === 2, 'ikinci alarm aynı uyarıya eklenir', st.items && st.items.length);
  ok(/2 alarm/.test(st.count || ''), 'sayaç 2 alarmı gösterir', st.count);

  /* 5) satır tıklaması uyarıyı kapatmaz; ✕ tek tek kapatır */
  await page.click('#alarmModal .aitem .sym');
  await wait(400);
  ok((await modalState()).open, 'satıra tıklamak uyarıyı kapatmaz');
  await page.click('#alarmModal .aitem .ax');   /* en üstteki (en yeni: ASELS) */
  await wait(300);
  st = await modalState();
  ok(st.open && st.items.length === 1 && st.items[0].sym === 'BIST:GARAN', '✕ yalnız ilgili alarmı kaldırır', st.items);
  await page.click('#alarmModal .aitem .ax');
  await wait(300);
  st = await modalState();
  ok(!st.open, 'son alarm ✕ ile kapatılınca uyarı gider');
  ok((await page.evaluate(() => window.velaChart.alarmUnack())).length === 0, 'kapatılınca kalıcı liste boşalır');

  /* 6) SAYFA KAPALIYKEN/ÖNCEKİ OTURUMDA TETİKLENMİŞ: açılışta gösterilir */
  await page.evaluate(() => window.velaChart.fireAlertTest('BIST:THYAO', 300, 301));
  await wait(200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.velaChart, null, { timeout: 60000 });
  await wait(800);
  st = await modalState();
  ok(st.open, 'yeni açılışta bekleyen (kapatılmamış) tetikleme gösterilir');
  ok(st.items.length === 1 && st.items[0].sym === 'BIST:THYAO', 'açılış uyarısı doğru sembolü gösterir', st.items);

  /* 7) 'Tümünü kapat' hepsini temizler ve yeniden açılışta çıkmaz */
  await page.click('#alarmAllAck');
  await wait(300);
  ok(!(await modalState()).open, "'Tümünü kapat' uyarıyı kapatır");
  ok((await page.evaluate(() => window.velaChart.alarmUnack())).length === 0, "'Tümünü kapat' kalıcı listeyi boşaltır");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.velaChart, null, { timeout: 60000 });
  await wait(800);
  ok(!(await modalState()).open, 'temizlendikten sonraki açılışta uyarı çıkmaz');

  await browser.close();
  console.log(fails ? `\n${fails} TEST BAŞARISIZ` : '\nTÜM TESTLER GEÇTİ');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST HATASI:', e); process.exit(2); });
