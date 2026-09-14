import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3199/ws/quote?symbols=BINANCE:BTCUSDT');
let n=0;
ws.on('message', d=>{
  const m=JSON.parse(d); const q=m.quote||{};
  const now=Date.now()/1000;
  n++;
  if(n<=14) console.log(`${new Date(now*1000).toISOString().slice(11,23)} | lp=${q.lp} | lp_time=${q.lp_time ?? 'YOK'} | lp_time yaşı=${q.lp_time?(now-q.lp_time).toFixed(1)+'s':'-'} | anahtarlar=${Object.keys(q).join(',')}`);
});
setTimeout(()=>{ console.log('toplam mesaj:', n); process.exit(0); }, 12000);
ws.on('error', e=>{ console.log('hata:', e.message); process.exit(1); });
