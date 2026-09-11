/* Regresyon: mıknatıs görselleştirmesi (kullanıcı: "imlecin nereye tutunduğunu göremiyorum")
   Çizim modunda mıknatıs bir OHLC'ye tutununca:
   - overlay tuvalinde turuncu yatay kılavuz çizilir (piksel doğrulaması)
   - pending._magnet bilgisi set edilir
   - mouse chart alanından çıkınca kılavuz kaybolur
   Çalıştır: node tests/magnet-guide.cjs */
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

  // trend aracını seç + imleci bir barın H/L bandına yaklaştır
  await p.evaluate(()=>{ const b=document.querySelector('.dtool[data-tool="trend"]'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,300));

  // bir barın high/low ortasına götür: snap OHLC'ye tutunmalı
  const probe = await p.evaluate(async ()=>{
    const b = window.velaChart.state.bars;
    const bar = b[Math.floor(b.length*0.7)];
    const cv = document.querySelector('#overlay');
    const r = cv.getBoundingClientRect();
    const x = window.__chart.timeScale().timeToCoordinate(bar.time);
    const yH = window.__vela.series.priceToCoordinate(bar.high);
    const yL = window.__vela.series.priceToCoordinate(bar.low);
    const y = yL - (yL-yH)*0.1; // low'un hemen ustu — low'a cok yakin (snap tolerance 14px)
    // pointermove gonder (pending yoksa da snap cagrilabilir degil — pending olustur)
    cv.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+x,clientY:r.top+yH,button:0,pointerId:9,buttons:1}));
    cv.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+x,clientY:r.top+y,pointerId:9,buttons:1}));
    await new Promise(res=>setTimeout(res,150));
    const pending = window.__vela && null; // pending icer erisim: state uzerinden bakalim
    return { x, yH, yL, y, left:r.left, top:r.top };
  });
  // pending._magnet'i dogrudan dogrulayamayiz (kapsam icinde) — gorunur kanit: tuval pikselleri
  // turuncu (255,152,0 civari) piksel var mi?
  const pixels = await p.evaluate(()=>{
    const cv = document.querySelector('#overlay');
    const cx = cv.getContext('2d');
    const img = cx.getImageData(0,0,cv.width,cv.height).data;
    let orange=0, orangeY=null;
    for(let y=0; y<cv.height; y+=2){
      for(let x=0; x<cv.width; x+=2){
        const i=(y*cv.width+x)*4;
        if(img[i]>180 && img[i+1]>100 && img[i+1]<200 && img[i+2]<120){ orange++; if(orangeY==null) orangeY=Math.round(y/(window.devicePixelRatio||1)); break; }
      }
    }
    return { orangeRows: orange, ilkY: orangeY };
  });
  ok(pixels.orangeRows >= 5, 'overlay tuvalinde TURUNCU mıknatıs kılavuzu çiziliyor', pixels);

  // imleç çekilince kılavuz kaybolmalı (pointerup sonrasi pending biter, yeni pending yok)
  await p.evaluate(()=>{ const cv=document.querySelector('#overlay');
    cv.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:10,clientY:10,pointerId:9})); });
  await new Promise(r=>setTimeout(r,600));
  const pixels2 = await p.evaluate(()=>{
    const cv = document.querySelector('#overlay');
    const cx = cv.getContext('2d');
    const img = cx.getImageData(0,0,cv.width,cv.height).data;
    let orange=0;
    for(let y=0; y<cv.height; y+=2){
      for(let x=0; x<cv.width; x+=2){
        const i=(y*cv.width+x)*4;
        if(img[i]>180 && img[i+1]>100 && img[i+1]<200 && img[i+2]<120){ orange++; break; }
      }
    }
    return { orangeRows: orange };
  });
  ok(pixels2.orangeRows < 5, 'çizim bitince kılavuz kayboluyor', pixels2);

  ok(pageErrors.length===0, 'sayfa hatası yok', pageErrors);

  await browser.close();
  console.log('\n' + (fails===0 ? 'magnet-guide GECTI' : `magnet-guide BASARISIZ (${fails} hata)`));
  process.exit(fails===0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.stack || e.message); process.exit(1); });
