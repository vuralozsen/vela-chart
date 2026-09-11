/* Regresyon: liste seçici dropdown konumu (kullanıcı: "açılan kutu solda, görünmeyen yerde")
   - listsel (sağ panel) tıklanınca kutu DÜĞMENİN ALTINDA ve GÖRÜNÜR alanda açılmalı
   - mobilde de (dar viewport) görünürlük korunmalı
   Çalıştır: node tests/listdd-position.cjs */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';

let fails = 0;
const ok = (c, m, extra) => { console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };

(async () => {
  const browser = await puppeteer.launch({ headless:'new', executablePath:CHROME,
    args:['--no-sandbox','--disable-dev-shm-usage'] });

  const check = async (vw, vh, label, isMobile) => {
    const p = await (await browser.createBrowserContext()).newPage();
    await p.setViewport({ width:vw, height:vh, hasTouch:isMobile, isMobile });
    await p.goto(URL, { waitUntil:'networkidle2', timeout:60000 });
    await new Promise(r=>setTimeout(r,6000));
    const r = await p.evaluate(()=>{
      /* mobilde once cekmeci AC (gercek kullanim akisi) */
      const wp = document.getElementById('watchpanel');
      if (wp.classList.contains('hide')) {
        const tg = document.getElementById('wptoggle');
        if (tg) tg.click();
      }
      const btn = document.getElementById('listsel');
      btn.click();
      return new Promise(res => setTimeout(()=>{
        const dd = document.getElementById('listdd');
        const b = btn.getBoundingClientRect(), d = dd.getBoundingClientRect();
        res({ open: dd.classList.contains('open'), pos: getComputedStyle(dd).position,
          dd: { l:Math.round(d.left), t:Math.round(d.top), w:Math.round(d.width), h:Math.round(d.height) },
          btn: { l:Math.round(b.left), t:Math.round(b.top), w:Math.round(b.width), h:Math.round(b.height) },
          vw: innerWidth, vh: innerHeight });
      }, 300));
    });
    ok(r.open, `${label}: kutu açılıyor`, r.open);
    ok(r.pos === 'fixed', `${label}: fixed konumlandırma`, r.pos);
    ok(r.dd.l >= 0 && r.dd.l + r.dd.w <= r.vw, `${label}: kutu YATAYDA ekran içinde`, r.dd);
    ok(r.dd.t >= 0 && r.dd.t + Math.min(r.dd.h, 300) <= r.vh, `${label}: kutu DİKEYDE ekran içinde`, r.dd);
    ok(Math.abs(r.dd.l - r.btn.l) < Math.max(40, r.btn.w), `${label}: kutu düğmeyle hizalı (solda kaybolmuyor)`, { dd_l:r.dd.l, btn_l:r.btn.l });
    await p.close();
  };

  console.log('\n[1] Masaüstü (1600×900)');
  await check(1600, 900, 'masaüstü', false);
  console.log('\n[2] Mobil (390×720)');
  await check(390, 720, 'mobil', true);

  await browser.close();
  console.log('\n' + (fails===0 ? 'listdd-position GECTI' : `listdd-position BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
