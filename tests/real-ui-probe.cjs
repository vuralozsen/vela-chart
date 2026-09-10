
/* GERCEK FARE testi: sag tik menusu + dropdown satir tiklamasi gercekten calisiyor mu?
   (E2E sentetik event gonderiyor; gercek fare farkli davranabilir.) */
const puppeteer = require('/tmp/vela-test/node_modules/puppeteer');
const CHROME = '/opt/data/.pw-browsers/chromium-1208/chrome-linux64/chrome';
const URL = process.env.VELA_URL || 'http://127.0.0.1:3010/';
const wait = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME, headless:'new', protocolTimeout:600000,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const p=await b.newPage(); await p.setViewport({width:1600,height:900});
  await p.goto(URL,{waitUntil:'networkidle2'}); await wait(3000);
  const ev=(f,...a)=>p.evaluate(f,...a);

  // 1) GERCEK sag tik — bos alan
  const box = await p.$eval('#overlay', el=>{ const r=el.getBoundingClientRect(); return {x:r.left+r.width*0.5, y:r.top+r.height*0.5}; });
  await p.mouse.click(box.x, box.y, {button:'right'});
  await wait(600);
  const ctx1 = await ev(()=>{ const m=document.getElementById('ctxmenu');
    return {open:!!m&&getComputedStyle(m).display!=='none'&&m.classList.contains('open'), items:m?m.querySelectorAll('.ci').length:0}; });
  console.log(`  1) GERCEK sag tik (bos alan): menu acildi=${ctx1.open} oge=${ctx1.items}`);

  // 2) menuden bir ogeye GERCEK tiklama (Nesne agacini acan oge) -> kapanmali
  if(ctx1.open){
    const item = await p.evaluateHandle(()=>document.querySelector('#ctxmenu .ci[data-a="tree"]'));
    const ib = await item.asElement().boundingBox();
    await p.mouse.click(ib.x+ib.width/2, ib.y+ib.height/2);
    await wait(600);
    const after = await ev(()=>({menu:document.getElementById('ctxmenu').classList.contains('open'),
      tree:!!document.querySelector('.otree.open, #objtree.open, #otree.open')||/Nesne Ağacı/.test(document.body.innerHTML)}));
    console.log(`  2) menu ogesine gercek tik: menu kapandi=${!after.menu} nesne_agaci_acildi=${after.tree}`);
  }

  // 3) zaman dilimi dropdown: GERCEK tikla
  const ir = await p.$eval('#intbtn', el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  await p.mouse.click(ir.x, ir.y); await wait(500);
  const iv0 = await ev(()=>window.velaChart.state.interval);
  const row = await p.evaluateHandle(()=>{ const d=[...document.querySelectorAll('.dd')].find(x=>x.querySelector('[data-int="15m"]')); return d?d.querySelector('[data-int="15m"]'):null; });
  const rb = row.asElement() ? await row.asElement().boundingBox() : null;
  if(rb){ await p.mouse.click(rb.x+rb.width/2, rb.y+rb.height/2); await wait(4000); }
  const iv1 = await ev(()=>window.velaChart.state.interval);
  console.log(`  3) zaman dilimi GERCEK tik: ${iv0} -> ${iv1}  ${iv1==='15m'?'✓':'✗'}`);

  // 4) fiyat ekseni: BTC -> ETH gecisinde aralik guncelleniyor mu
  await ev(()=>window.velaChart.pickSymbol('BINANCE:BTCUSDT')); await wait(4500);
  const btc = await ev(()=>{ const V=window.velaChart, s=V.main; return {lo:s.priceToCoordinate(Math.min(...V.main.data().slice(-50).map(d=>d.low||d.value))), last:V.main.data().slice(-1)[0].close}; });
  await ev(()=>window.velaChart.pickSymbol('BINANCE:ETHUSDT')); await wait(4500);
  const eth = await ev(()=>{ const V=window.velaChart; const d=V.main.data().slice(-50).filter(x=>x.low!==undefined);
    const mn=Math.min(...d.map(x=>x.low)), mx=Math.max(...d.map(x=>x.high));
    const r=V.chart.priceScale('right');
    // gorunur fiyat araligi: koordinat eslemesinden turet
    const c1=V.main.priceToCoordinate(mx), c2=V.main.priceToCoordinate(mn);
    return {last:V.main.data().slice(-1)[0].close, mx, mn, c1, c2, h:document.getElementById('chart').clientHeight}; });
  console.log(`  4) fiyat ekseni: BTC son=${btc.last}  ETH son=${eth.last}`);
  console.log(`     ETH gorunur aralik ${eth.mn}–${eth.mx} -> y=${eth.c1?.toFixed(0)}..${eth.c2?.toFixed(0)} (panel yuksekligi ${eth.h})  ${(eth.c1>0&&eth.c1<eth.h)?'✓ gorunur':'✗ EKRAN DISI (BTC araliginda kalmis)'}`);

  // 5) mum saga yapisiyor mu: son mumun x koordinati vs panel genisligi
  const edge = await ev(()=>{ const V=window.velaChart; const d=V.main.data().slice(-1)[0];
    const x=V.chart.timeScale().timeToCoordinate(d.time); const w=document.getElementById('chart').clientWidth;
    return {x, w}; });
  console.log(`  5) son mum x=${edge.x?.toFixed(0)} panel=${edge.w} → sag bosluk ${(edge.w-edge.x)?.toFixed(0)}px ${(edge.w-edge.x)>20?'✓':'✗ YAPISIK'}`);
  await b.close();
})().catch(e=>{console.error('COKTU',e.message);process.exit(2);});
