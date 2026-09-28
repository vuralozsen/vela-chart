/* vela: hesap listelerini tradingview-watchlists-tam-liste.txt'ten senkronize et.
   Kullanım: node tools/sync-watchlists.mjs [--file <txt>] [--url <site>] [--user <ad>] [--pass <şifre>] [--dry]
   Kırmızı liste ayrı liste DEĞİL: içindeki semboller vela.flags'te 'red' bayrak olur. */
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/v_ozs/Documents/Codex/2026-09-14/https-www-tradingview-com-watchlists-14218560-2/outputs/tradingview-watchlists-tam-liste.txt';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = arg('--file', SRC);
const URL0 = (arg('--url', 'https://chart.vuralozsen.com.tr')).replace(/\/+$/, '');
const USER = arg('--user', 'vural');
const PASS = arg('--pass', 'vela2026');
const DRY = argv.includes('--dry');

/* ---------- 1) parse ---------- */
const raw = fs.readFileSync(FILE, 'utf8');
const lists = [];
const redFlags = {};
let cur = null;
for (const line0 of raw.split(/\r?\n/)) {
  const line = line0.trim();
  if (!line || line.startsWith('#')) continue;
  if (line.startsWith('===')) {
    const m = line.match(/^===\s*(.+?)\s*(?:\([^)]*\))?\s*===\s*$/);
    const name = m ? m[1].trim() : line.replace(/=/g, '').trim();
    cur = { name, items: [] };
    lists.push(cur);
    continue;
  }
  const [sym, prov] = line.split('|');
  if (!cur || !sym || !prov) continue;
  cur.items.push(`${prov}:${sym}`);
}
const redList = lists.find(l => l.name === 'Kırmızı liste');
if (redList) redList.items.forEach(s => { redFlags[s] = 'red'; });
const finalLists = lists.filter(l => l.name !== 'Kırmızı liste');
const totSyms = finalLists.reduce((n, l) => n + l.items.length, 0);
console.log(`parse: ${lists.length} liste okundu → ${finalLists.length} liste yazılacak (Kırmızı liste → ${Object.keys(redFlags).length} kırmızı bayrak), toplam ${totSyms} sembol`);
finalLists.forEach(l => {
  const dup = l.items.length - new Set(l.items).size;
  console.log(`  - ${l.name}: ${l.items.length}${dup ? ` (${dup} tekrar)` : ''}`);
});

/* ---------- 2) login + mevcut durum ---------- */
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200)); } };
if (DRY) { console.log('dry: sunucuya dokunulmadı'); process.exit(0); }

const lr = await j(await fetch(URL0 + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: USER, pass: PASS }),
}));
if (!lr.ok || !lr.token) throw new Error('giriş başarısız: ' + JSON.stringify(lr).slice(0, 200));
const H = { Authorization: 'Bearer ' + lr.token, 'Content-Type': 'application/json' };
console.log(`giriş: ${lr.user} (token alındı)`);

const curRes = await j(await fetch(URL0 + '/api/state', { headers: H }));
const curState = curRes.data || {};
const oldLists = (() => { try { return JSON.parse(curState['vela.lists'] || '[]'); } catch { return []; } })();
console.log(`mevcut: ${Object.keys(curState).length} anahtar, ${oldLists.length} liste, ${Object.keys(JSON.parse(curState['vela.flags'] || '{}')).length} bayrak`);

/* yedek */
const bak = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), `backup-vural-state-${Date.now()}.json`);
fs.writeFileSync(bak, JSON.stringify({ at: new Date().toISOString(), url: URL0, user: USER, state: curState }, null, 1));
console.log('yedek: ' + bak);

/* ---------- 3) yeni durumu yaz ---------- */
const newState = { ...curState };
newState['vela.lists'] = JSON.stringify(finalLists.map(l => ({ name: l.name, items: l.items, sections: [], closedSecs: {} })));
newState['vela.listIdx'] = '0';
newState['vela.flags'] = JSON.stringify(redFlags);
newState['vela.lastFlagColor'] = '"red"';

const pr = await j(await fetch(URL0 + '/api/state', { method: 'PUT', headers: H, body: JSON.stringify({ data: newState }) }));
if (!pr.ok) throw new Error('yazma başarısız: ' + JSON.stringify(pr).slice(0, 200));
console.log(`yazıldı: ${pr.keys} anahtar, ${(pr.bytes / 1024).toFixed(1)} KB`);

/* ---------- 4) doğrula ---------- */
const v = await j(await fetch(URL0 + '/api/state', { headers: H }));
const vLists = JSON.parse(v.data['vela.lists'] || '[]');
const vFlags = JSON.parse(v.data['vela.flags'] || '{}');
const vTot = vLists.reduce((n, l) => n + l.items.length, 0);
let ok = vLists.length === finalLists.length && vTot === totSyms
  && JSON.stringify(vFlags) === JSON.stringify(redFlags)
  && vLists.every((l, i) => l.name === finalLists[i].name && l.items.join('\n') === finalLists[i].items.join('\n'));
console.log(`doğrulama: ${ok ? 'TAMAM' : 'HATALI'} — ${vLists.length} liste, ${vTot} sembol, ${Object.keys(vFlags).length} kırmızı bayrak`);
if (!ok) { console.error('uyuşmazlık tespit edildi'); process.exit(1); }
console.log('bitti. Kullanıcı bir sonraki girişte/refresh\'te listeleri çeker (pullOrPush hasState → pull).');
