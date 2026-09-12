/* KAPSAM DENETLEYICI — "v3 IIFE kapsami tuzagi" sinifini statik olarak yakalar.
   Sorun: index.html'de tek bir global <script> var; v3 modulu anonim bir IIFE icine
   enjekte edilmis. IIFE icindeki fonksiyonlar (pinDD, renderListBar, createList ...)
   DISARIDAN ciplak cagrilamaz (strict modda "not defined") → sayfa hatasi.
   Cozum deseni: window.velaChart koprusu.

   Bu script: her fonksiyon/blok kapsamini AST ile cikarir, Program seviyesindeki
   (IIFE disindaki) ciplak referanslari toplar ve yalnizca IIFE icinde tanimli olanlari
   IHLAL olarak bildirir. Temizse sessizce 0 ile cikar.
   Kullanim: node tools/scope-check.cjs [index.html] */
const fs = require('fs');
const path = require('path');
const acorn = require('/opt/hermes/node_modules/acorn');

const FILE = process.argv[2] || path.join(__dirname, '..', 'public', 'index.html');
const GLOBALS = new Set(('window document console setTimeout clearTimeout setInterval clearInterval ' +
  'requestAnimationFrame cancelAnimationFrame Math JSON Date Number String Boolean Array Object parseInt ' +
  'parseFloat isNaN isFinite Infinity NaN undefined null true false this arguments fetch alert prompt confirm ' +
  'Error TypeError Promise Set Map WeakMap Symbol Proxy Reflect RegExp Function encodeURIComponent ' +
  'decodeURIComponent encodeURI decodeURI localStorage sessionStorage navigator location history screen ' +
  'innerWidth innerHeight outerWidth outerHeight devicePixelRatio performance ResizeObserver IntersectionObserver ' +
  'MutationObserver WebSocket Event CustomEvent Blob File FileReader URL URLSearchParams TextDecoder TextEncoder ' +
  'AudioContext webkitAudioContext Image Option AbortController queueMicrotask structuredClone btoa atob ' +
  'getComputedStyle matchMedia scrollTo open close frames parent top self globalThis LightweightCharts velaChart').split(/\s+/));

const html = fs.readFileSync(FILE, 'utf8');
const lines = html.split('\n');
const sIdx = lines.findIndex(l => l.trim() === '<script>');
const eIdx = lines.findIndex((l, i) => i > sIdx && l.trim() === '</script>');
if (sIdx < 0 || eIdx < 0) { console.error('inline <script> blogu bulunamadi'); process.exit(2); }
const OFFSET = sIdx + 1;                                  /* AST satir -> dosya satiri */
const code = lines.slice(sIdx + 1, eIdx).join('\n');
const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true, allowReturnOutsideFunction: true });

/* --- kapsam agaci kur --- */
let scopeId = 0;
function newScope(parent, kind, label) {
  const s = { id: ++scopeId, parent, kind, label, decls: new Map(), refs: [], kids: [] };
  if (parent) parent.kids.push(s);          /* agac kenarlari dogrudan kurulur */
  return s;
}
const root = newScope(null, 'program', 'Program');

const declKey = (kind, name) => kind + ':' + name;

function hoistDecls(node, scope) {
  /* var + function declarations kapsam boyunca; let/const/class blokta */
  switch (node.type) {
    case 'VariableDeclaration':
      node.declarations.forEach(d => {
        const t = node.kind === 'var' ? 'var' : 'lex';
        if (d.id && d.id.type === 'Identifier') scope.decls.set(declKey(t, d.id.name), t);
        else collectPatternNames(d.id, scope, t);
      });
      break;
    case 'FunctionDeclaration':
      if (node.id) scope.decls.set(declKey('fn', node.id.name), 'fn');
      break;
    case 'ClassDeclaration':
      if (node.id) scope.decls.set(declKey('lex', node.id.name), 'lex');
      break;
  }
}
function collectPatternNames(pat, scope, t) {
  if (!pat) return;
  if (pat.type === 'Identifier') scope.decls.set(declKey(t, pat.name), t);
  else if (pat.type === 'ObjectPattern') pat.properties.forEach(p => collectPatternNames(p.value || p.argument, scope, t));
  else if (pat.type === 'ArrayPattern') pat.elements.forEach(e => collectPatternNames(e, scope, t));
  else if (pat.type === 'AssignmentPattern') collectPatternNames(pat.left, scope, t);
  else if (pat.type === 'RestElement') collectPatternNames(pat.argument, scope, t);
}

const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
function bodyOf(n) { return n.type === 'ArrowFunctionExpression' && n.body.type !== 'BlockStatement' ? null : n.body; }

function build(node, scope) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    /* statement listesi: once tum bildirimleri hoist et, sonra gezin */
    node.forEach(n => n && hoistDecls(n, scope));
    node.forEach(n => build(n, scope));
    return;
  }
  const t = node.type;
  if (t === 'Program') { node.body.forEach(n => hoistDecls(n, scope)); node.body.forEach(n => build(n, scope)); return; }
  if (FN.has(t)) {
    const nm = (node.id && node.id.name) || '(anon)';
    const s = newScope(scope, 'function', nm + '@L' + (node.loc.start.line + OFFSET));
    /* parametreler + fonksiyon adi kendi kapsaminda */
    if (node.id) s.decls.set(declKey('fn', node.id.name), 'fn');
    node.params.forEach(p => collectPatternNames(p, s, 'param'));
    /* var/function hoisting */
    const b = bodyOf(node);
    if (b) b.body.forEach(n => hoistDecls(n, s));
    if (b) build(b, s);
    return;
  }
  if (t === 'BlockStatement' || t === 'CatchClause' || t === 'ForStatement' || t === 'ForInStatement' ||
      t === 'ForOfStatement' || t === 'SwitchStatement' || t === 'TryStatement') {
    const s = newScope(scope, 'block', t + '@L' + (node.loc.start.line + OFFSET));
    const stmts = t === 'CatchClause' ? (node.body.body || []) : (node.body && node.body.body) || [];
    stmts.forEach(n => hoistDecls(n, s));
    /* for(let i=..) / for(const x of ..) bildirimleri dongu kapsaminda yasar */
    if (t === 'ForStatement' && node.init) hoistDecls(node.init, s);
    if ((t === 'ForInStatement' || t === 'ForOfStatement') && node.left) hoistDecls(node.left, s);
    if (t === 'CatchClause' && node.param) collectPatternNames(node.param, s, 'param');
    for (const k of Object.keys(node)) {
      if (['loc', 'start', 'end', 'type'].includes(k)) continue;
      build(node[k], s);
    }
    return;
  }
  if (t === 'Identifier') { scope.refs.push({ name: node.name, line: node.loc.start.line + OFFSET, col: node.loc.start.column + 1 }); return; }
  if (t === 'MemberExpression' && !node.computed) { build(node.object, scope); return; }
  if (t === 'Property' && !node.computed) { build(node.value, scope); return; }   /* anahtar adi referans degil */
  if (t === 'LabeledStatement') { build(node.body, scope); return; }
  for (const k of Object.keys(node)) {
    if (['loc', 'start', 'end', 'type'].includes(k)) continue;
    build(node[k], scope);
  }
}
build(ast, root);

/* --- tum kapsamlari topla (kids kenarlari uzerinden) --- */
const all = [root];
(function collect(s) { s.kids.forEach(c => { all.push(c); collect(c); }); })(root);

function lookup(scope, name) {
  for (let s = scope; s; s = s.parent) for (const k of s.decls.keys()) if (k.endsWith(':' + name)) return s;
  return null;
}

/* --- ihlalleri bul: cozulemeyen referans, IIFE-benzeri bir kapsamda TANIMLI ise --- */
const violations = [];
(function walkScopes(s) {
  for (const r of s.refs) {
    if (GLOBALS.has(r.name)) continue;
    if (lookup(s, r.name)) continue;                        /* normal cozum */
    const definedIn = all.filter(x => [...x.decls.keys()].some(k => k.endsWith(':' + r.name)))
                      .map(x => x.label).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).join(', ') || '?';
    if (definedIn && definedIn !== '?') {
      violations.push({ name: r.name, line: r.line, col: r.col, scope: s.label, definedIn });
    }
  }
  s.kids.forEach(walkScopes);
})(root);

if (process.env.SCOPE_DEBUG) {
  const want = process.env.SCOPE_DEBUG;
  console.log('--- DEBUG ' + want + ' ---');
  console.log('toplam kapsam:', all.length);
  console.log('root decls:', [...root.decls.keys()].length);
  all.forEach(s => {
    const has = [...s.decls.keys()].filter(k => k.endsWith(':' + want));
    if (has.length) console.log('  TANIM  ' + s.label + '  ' + has.join(','));
    s.refs.filter(r => r.name === want).forEach(r => console.log('  REF    ' + s.label + '  satir ' + r.line));
  });
  console.log('--- /DEBUG ---');
}

if (!violations.length) { console.log('scope-check TEMIZ — kapsam disi cagri yok'); process.exit(0); }
console.log('scope-check IHLAL ' + violations.length + ' adet:\n');
const seen = new Map();
violations.forEach(v => { const k = v.name + '|' + v.scope; if (!seen.has(k)) seen.set(k, v); });
[...seen.values()].forEach(v => {
  console.log(`  index.html:${v.line}  '${v.name}'  [kapsam: ${v.scope}]`);
  console.log(`      tanimli: ${v.definedIn}`);
});
console.log(`\n  ozet: ${violations.length} referans, ${seen.size} benzersiz (isim x kapsam)`);
console.log('  NOT: v3 IIFE kapsamindaki bir ismi disaridan cagirmak yerine window.velaChart koprusunu kullan.');
process.exit(1);
