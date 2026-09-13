/* TV sembol aramasıyla watchlist ticker'larını EXCHANGE:SYMBOL'a çözer.
   Kullanım: node tools/resolve-watchlists.mjs  → tools/seed-out.json yazar */
const TV = (q) => `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(q)}&hl=1&exchange=&lang=tr&search_type=undefined&domain=production&sort_by_country=TR&limit=30`;

const BIST = ['BIST'];
const FX = ['FX', 'OANDA', 'FOREXCOM', 'FXCM', 'PEPPERSTONE', 'FX_IDC', 'CAPITALCOM'];

const LISTS = [
  { name: 'Kırmızı liste', items: [
    ['ALARK', BIST], ['TOASO', BIST], ['KRDMD', BIST], ['KCHOL', BIST],
    ['EKGYO', BIST], ['BRSAN', BIST], ['ODAS', BIST],
    ['BIMAS', BIST], ['SOKM', BIST], ['ASTOR', BIST], ['EREGL', BIST], ['TCELL', BIST], ['DOHOL', BIST],
    ['ASELS', BIST], ['CIMSA', BIST], ['ENKAI', BIST], ['OYAKC', BIST],
    ['BLCYT', BIST], ['KARTN', BIST], ['DFDV', ['NASDAQ']], ['VAKBN', BIST], ['SAHOL', BIST],
  ]},
  { name: '1-Takip', items: [
    ['XU100', BIST], ['XU030', BIST],
    ['NVDA', ['NASDAQ']], ['CVX', ['NYSE']], ['SLB', ['NYSE']], ['CCL', ['NYSE']],
    ['ETHUSDT', ['BINANCE']], ['XAUUSD', ['OANDA', 'TVC', 'FOREXCOM']], ['XAGUSD', ['OANDA', 'TVC']],
    ['XAUTUSDT', ['BITFINEX', 'BYBIT', 'OKX', 'BINANCE']],
    ['VIX', ['TVC', 'CBOE']], ['NASDAQ', ['NASDAQ'], 'TECH 100'], ['QQQ', ['NASDAQ']],
  ]},
  { name: '2-FX', items: [
    ['DXY', ['TVC', 'ICEUS']],
    ['NAS100', ['NASDAQ', 'PEPPERSTONE', 'FXCM', 'FOREXCOM'], 'US 100'],
    ['NASDAQ', ['NASDAQ'], 'TECH 100'],
    ['USTECH100CFD', ['CAPITALCOM', 'PEPPERSTONE', 'FXCM', 'FOREXCOM'], 'TECH 100'],
    ['NDX', ['NASDAQ', 'TVC']], ['RSP', ['AMEX']], ['SPX', ['SP', 'TVC']], ['US30', ['DJ', 'TVC', 'FOREXCOM']],
    ['JP225USD', ['TVC', 'CAPITALCOM', 'PEPPERSTONE'], '225'],
    ['HK50', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'HONG KONG'],
    ['NL25', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'NETHERLANDS'],
    ['STOXX50', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'STOXX 50'],
    ['GER40', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'GERMANY'],
    ['SPAIN35', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'SPAIN'],
    ['DE30EUR', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'GERMANY'],
    ['UK100', ['CBOEUK', 'CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'FTSE'],
    ['SA40', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'SOUTH AFRICA'],
    ['FR40EUR', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'FRANCE'],
    ['SWISS20', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'SWITZERLAND'],
    ['IT40', ['CAPITALCOM', 'PEPPERSTONE', 'FOREXCOM'], 'ITALY'],
    ...['USDCHF','GBPCHF','USDHUF','EURCHF','NZDUSD','GBPJPY','USDNOK','EURNOK','USDJPY','AUDUSD',
        'EURJPY','USDDKK','EURGBP','GBPTRY','GBPUSD','EURUSD','AUDNZD','USDSGD','CADCHF','USDPLN',
        'EURTRY','EURSGD','CHFJPY','GBPAUD','EURAUD','GBPNZD','USDCNH','EURNZD','GBPPLN','CADJPY']
      .map(t => [t, FX]),
    ['US20Y', ['TVC'], '20 YEAR'],
    ...['USDMXN','USDZAR','GBPZAR','EURZAR'].map(t => [t, FX]),
    ['SCHD', ['AMEX']],
    ...['NZDSGD','EURHKD','GBPHKD','EURMXN','EURDKK','USDHKD','GBPDKK','GBPCZK','GBPNOK','EURCZK',
        'USDCZK','EURSEK','GBPSEK','EURHUF'].map(t => [t, FX]),
    ['XAUUSD', ['OANDA', 'TVC', 'FOREXCOM']], ['XAUTUSDT', ['BITFINEX', 'BYBIT', 'OKX']],
    ['BCOUSD', ['TVC'], 'BRENT'], ['XAGUSD', ['OANDA', 'TVC']],
    ['ZINC', ['TVC'], 'ZINC'], ['COCOA', ['TVC'], 'COCOA'], ['SUGAR', ['TVC'], 'SUGAR'],
    ['COFFEE', ['TVC'], 'COFFEE'], ['COPPER', ['TVC'], 'COPPER'], ['NICKEL', ['TVC'], 'NICKEL'],
    ['ALUMINIUM', ['TVC'], 'ALUMINIUM'], ['WHEAT', ['TVC'], 'WHEAT'],
    ...['NZDCAD','USDTRY','AUDCAD','NZDCHF','AUDCHF','NZDJPY','GBPCAD','USDSEK','EURCAD','USDCAD','AUDJPY']
      .map(t => [t, FX]),
  ]},
];

const cache = new Map();
async function tvSearch(q) {
  if (cache.has(q)) return cache.get(q);
  const r = await fetch(TV(q), { headers: { Origin: 'https://www.tradingview.com', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`tv ${r.status}`);
  const j = await r.json();
  const strip = (v) => String(v ?? '').replace(/<\/?em>/g, '').trim();
  const items = (j.symbols || []).map(s => ({
    full: strip(s.full_name) || `${strip(s.prefix || s.exchange)}:${strip(s.symbol)}`,
    sym: strip(s.symbol), ex: strip(s.exchange || s.prefix), desc: strip(s.description),
  }));
  cache.set(q, items);
  return items;
}

async function resolve([q, pref, descNeed]) {
  let items;
  try { items = await tvSearch(q); } catch (e) { return { q, err: String(e.message) }; }
  let pool = items.filter(s => s.sym.toUpperCase() === q.toUpperCase());
  if (!pool.length) pool = items.filter(s => s.full.toUpperCase().endsWith(':' + q.toUpperCase()));
  if (descNeed) { const m = pool.filter(s => s.desc.toUpperCase().includes(descNeed)); if (m.length) pool = m; }
  for (const p of pref) { const m = pool.filter(s => s.ex.toUpperCase() === p); if (m.length) return { q, full: m[0].full, desc: m[0].desc }; }
  if (pool.length) return { q, full: pool[0].full, desc: pool[0].desc, warn: 'pref-yok' };
  return { q, err: 'bulunamadi' };
}

const jobs = [];
for (const l of LISTS) for (const it of l.items) jobs.push({ list: l.name, it });
const out = [];
let i = 0;
async function worker() {
  while (i < jobs.length) { const j = jobs[i++]; const r = await resolve(j.it); out.push({ list: j.list, ...r }); await new Promise(s => setTimeout(s, 120)); }
}
await Promise.all(Array.from({ length: 5 }, worker));

const byList = {};
for (const l of LISTS) byList[l.name] = [];
for (const r of out) {
  const seen = new Set(byList[r.list]);
  if (r.full && !seen.has(r.full)) byList[r.list].push(r.full);
}
const needFs = await import('node:fs');
needFs.writeFileSync(new URL('./seed-out.json', import.meta.url), JSON.stringify({ byList, raw: out }, null, 1));
for (const r of out) if (r.err) console.log(`[HATA] ${r.list}: ${r.q} → ${r.err}`);
console.log('--- ÖZET ---');
for (const l of LISTS) console.log(`${l.name}: ${byList[l.name].length} sembol`);
