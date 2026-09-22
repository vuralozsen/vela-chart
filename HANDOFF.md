# VELA CHART — HANDOFF (yeni oturum için)

Tarih: 2026-09-16 · Canlı sürüm: **r66-os-rozet-siz** (commit `31306e0`)
Bu belge, önceki oturumda bitirilemeyen eksikleri çalacak kişi içindir. Önce "Proje kimliği",
sonra "Bilinen eksikler" (öncelik sıralı), en sonda "Nasıl test edilir" bölümünü oku.

---

## 1) PROJE KİMLİĞİ

| Konu | Değer |
|---|---|
| Yerel dizin | `C:\Users\v_ozs\ZCodeProject\vela-chart` |
| GitHub | `https://github.com/vuralozsen/vela-chart.git` (branch `main`) |
| Canlı | `https://chart.vuralozsen.com.tr` |
| Deploy | Dokploy compose `cjVaTFzSsl7Lhtqzl9Jwt` (appName `vela-chart-hnwwkb`) — push to main → otomatik build (Dockerfile, kod image içine gömülü) |
| Dokploy API | anahtar `~/.zcode/cli/config.json` → `mcp.servers.dokploy.env.DOKPLOY_API_KEY` + `DOKPLOY_URL` (**ASLA çıktıya yazdırma**). Elle tetikleme: `POST {url}/api/compose.deploy` body `{"composeId":"cjVaTFzSsl7Lhtqzl9Jwt"}` header `x-api-key` |
| Hesap | kullanıcı `vural` — şifre **repoda saklanmaz** (kurulum sırasında belirlendi; unutulduysa `/api/auth/change` ile yenile ya da `data/vela-store.json` sıfırlanıp yeniden kayıt) |
| Sunucu | Node/Express `server.mjs`, port 3010, Docker volume `vela-data:/app/data` (hesap deposu `data/vela-store.json`) |

### Dosyalar
- `server.mjs` (279 satır) — Express + `@mathieuc/tradingview` v3.5.2 köprüsü: `/api/bars`, `/api/quotes`, `/api/search`, `/ws/quote`, hesap sistemi (`/api/auth/*`, `/api/state`, scrypt + token, `data/vela-store.json`), bar/quote önbellekleri.
- `public/index.html` (5376 satır) — TEK DOSYA frontend: LWC v5 chart, çizim motoru (canvas `#overlay`), gösterge listesi, izleme listesi, hesap modülü. `VELA_BUILD` sabiti sürüm damgası (status çubuğunda görünür).
- `public/ind-core.js` + `public/ind-catalog.js` — gösterge motoru + 60+ gösterge tanımı.
- `seed/tv-watchlists.json` — 29 listenin kanonik hali (6021 sembol). "USA" listesi bozulursa buradan geri yazılır.
- `tests/`, `tools/`, `ws-probe.mjs` — yardımcılar.

### Veri akışı (kritik)
- İzleme listesi fiyatları: REST `/api/quotes` (60 sn'de bir + liste/sembol değişiminde, 40'lık parçalar) + WS `/ws/quote` (canlı tick, abonelik = `[sembol, ...izleme listesi, ...favoriler]` İLK 40).
- Grafik: `/api/bars` (n=1500) + WS tick ile canlı bar (`applyQuote`), mum sınırı duvar saatine göre (`rolloverBar`), 15-30 sn'de bir `loadBars(true,true,true)` → `upsertTail` uzlaştırma.
- Tüm kullanıcı ayarları `localStorage` `vela.*` anahtarlarında; hesap açıksa 4 sn debounce ile `PUT /api/state` senkronu. Çizimler sembol başına `vela.drw.<SEMBOl>`.

---

## 2) BİLİNEN EKSİKLER (öncelik sırasıyla)

### 2.1 — HESAP SENKRONU ÇALIŞMIYOR (401) — EN KRİTİK
Belirtiler: tarayıcıda `vela.acctToken` var ama sunucu `/api/auth/me` ve `/api/state`'e **401** veriyor; `store.state['vural']` **BOŞ** (0 anahtar). Yani listeler/ayarlar/çizimler yalnızca cihazın localStorage'ında, sunucuya hiç gitmiyor.
- Muhtemel sebep: sunucu deposu (`data/vela-store.json`) bir noktada sıfırlanmış; `users.vural` yeniden oluşmuş ama eski token geçersiz.
- Yapılan: r49'da açılışta 401 → token temizleniyor + "Oturum düştü — yeniden giriş yap" toast'ı.
- **Yapılacaklar (senden):**
  1. Kullanıcıyı uygulamadan tekrar giriş yapmaya yönlendir; girişte `pullOrPush(true)` sunucuda veri yoksa yerelini push ediyor ✓ (doğrula: giriş sonrası `/api/state` anahtar sayısı > 0 olmalı).
  2. **Volume kalıcılığını test et**: deploy sonrası `users.vural` + `sessions` hâlâ duruyor mu? (volume kayboluyorsa her deploy'da herkesin oturumu düşer — compose `vela-data` volume'ünü ve Dockerfile'ı `data/` içermemesi nedeniyle kontrol et.)
  3. ~~Şifre değiştirme ekranı YOK~~ **r59'da YAPILDI**: `/api/auth/change` (eski şifre doğrulanır, yeni ≥4 karakter) + hesap panelinde "Eski/Yeni şifre" alanları (curl + UI ile test edildi).
  4. 401'de token siliniyor ama kullanıcıya girişten sonra otomatik push durumu net gösterecek bir UI yok.

### 2.2 — OTOMATİK DAĞITIM BAZEN TETİKLENMİYOR
Son commit için (r57) webhook çalışmadı; canlıda 5+ dakika eski sürüm kaldı. Elle tetikleme yukarıdaki `compose.deploy` çağrısıyla çözülüyor. **Yapılacak:** Dokploy tarafında push webhook'unu/logs kontrol et; istersen bir CI adımı ekle (push → deploy API çağrısı).

### 2.3 — ~~CETVEL: ekran dışı noktada hiç çizilmiyor~~ **r59'da DÜZELDİ**
`xOfAny(time)` eklendi (görünür bardan mantıksal indeksle ileri/geri uzatır); cetvel artık ekran dışı uçta da çiziliyor, etiket görünür kenara kelepçeleniyor, tutamaçlar yalnız ekran içi uçlarda. Canvas sarma testiyle doğrulandı (tamamen ekran dışı cetvel etiket üretiyor). Kalan (isteğe bağlı): TV'deki gibi ölçülen alan gölgelendirmesi ve etikete işlem hacmi satırı.

### 2.4 — GİZLİ GÖSTERGENİN ÇİP DEĞERİ CANLI GÜNCELLENMİYOR
Gizli göstergenin serisi kaldırılıyor (performans), çipte **son bilinen değer** gösteriliyor (canlı güncellenmez). İstenirse: gizli göstergeler için de hesap yapılıp (seri oluşturmadan) değer güncellenebilir — ama 1500 bar × gösterge hesap maliyeti var (ölçüm: 4 gösterge ~160 ms).

### 2.5 — BÜYÜK LİSTEDE CANLI AKIŞ YALNIZ İLK 40 SEMBOL
`connectWS` aboneliği `.slice(0,40)` ile kısıtlı; USA listesi (487) gibi listelerde 40'tan sonraki satırlar yalnızca 60 sn'de bir REST ile güncelleniyor. Çözüm önerisi: görünür aralıktaki satırları dinamik abone etme (WS key değişimi = sunucuda yeni TV oturumu, kotaya dikkat) veya REST sıklığını görünürlüğe göre ayarlama.

### 2.6 — SOĞUK PERİYOT GEÇİŞİ ~1.2 sn
Hiç bakılmamış bir sembol/periyoda ilk geçişte TV turu bekleniyor (ölçüm: 30m=1224 ms). Sunucuda bar önbelleği var (taze 30/120 sn, bayat 15 dk'ya kadar anında dönüyor) ama ilk kez gidilen yerde ister istemez TV turu var. Çözüm önerisi: sembol açılınca komşu periyotları arka planda ısıtma (TV kota riski — kullanıcı onayıyla).

### 2.7 — KÜÇÜK KALEMLER
- ~~Eski `vela.wSort` anahtarı~~ **r59'da temizleniyor** (açılışta `localStorage.removeItem`).
- "band" tipi çipler (RSI üst/alt sınır) çipte değer göstermiyor — bilinçli.
- BTCUSDT grafiğinde kullanıcının 1 çizimi, önceki oturumun hatalı temizlik döngüsü (forEach+splice) sırasında silinmiş olabilir — **geri yok** (yeni oturumda kullanıcıya sorulabilir).
- Yeni izleme listesi oluşturma/bölüm yeniden adlandırma akışları son oturumda dokunulmadı; bölüm ▲▼ + sürükleme r59'da yeniden yazıldı ve test edildi (aşağıda).

### 2.8 — r59/r60 OTURUMUNDA YAPILANLAR
- **r60-LAYOUT MODELİ (kullanıcı isteği)**: bölümler artık yalnız kendi aralarında değil, ticker'ların **başına/ortasına/arasına** sürüklenip bırakılabiliyor (TV gibi). Yeni `l.layout` alanı üst-düzey sırayı tutar: `["BIST:T1", {sec:"S1"}, "BIST:T2", ...]` (string=üst-düzey ticker, {sec}=bölüm). `l.items`/`l.sections` türetilir (üyelik sections'ta kalır).
  · `ensureLayout/layoutSyncLists/flatListItems` **GLOBAL bölgede** tanımlı (sortNow'ın hemen üstünde). DİKKAT: bu üçü ilk denemede v3 bölgesinde (dosyanın aşağısında) tanımlanınca `window`'a bağlanmadı ve renderWatch "ensureLayout is not defined" verdi — bu dosyada aşağı satırlarda tanımlı fonksiyonlar her zaman global bağ OLMUYOR; erken bölgeden çağrılacaksa yukarıda tanımla.
  · Boot'taki liste normalleştirme map'i `layout` alanını taşımalı (ilk denemede düşmüştü → reload'da sıralama eski düzene dönüyordu).
  · Sürükleme: bölüm bloğu (başlık+üyeleri) imleci takip eder; bırakma hedefi HERHANGİ bir satır/başlık olabilir. Üye satıra bırakılırsa o bölümün başlığına yaslanır. Satırlar `data-top="1"` ile üst-düzey işaretlenir; satır bırakılınca üyeliği üstündeki ilk işaretçiden (başlık=üye, data-top/liste başı=üst-düzey) hesaplanır.
  · "Buraya bölüm ekle" (sağ tık): üst-düzey satıra → tam üstüne BOŞ bölüm (hiçbir sembol taşınmaz); bölüm üyesine → bölüm o noktadan bölünür; başlığa → üstüne; boş alan → sona; #whead → en üste.
  · Bölüm silme/ad değiştirme: üyeler başlığın olduğu yerde üst-düzey kalır. ▲▼ komşu bölüm girdileri arasında taşır (aradaki ticker'lar sabit). Sıralama (tek seferlik) düzeni standarta döner (düz tickerlar üstte + bölümler) — bilinçli.
- **r61-GAP (kullanıcı isteği)**: efsane/legend'deki değişim yüzdesi artık ÖNCEKİ barın kapanışına göre (TV gibi) — gapli mumlarda eskiden yalnız mum gövdesi (close-open) hesaplanıyordu. `drawLegend()` içinde `b.indexOf(legendBar)` ile önceki bar bulunur (legendBar state.bars referansıdır ✓). İlk barda önceki olmadığından gövdeye düşer. A/Y/D/K renkleri mum yönünde kalır; fiyat+değişim rengi değişim işaretine göre. Hover yolu da aynı kod: yapay gap ile test edildi (açılış yarıya indirildi → legend +%100 değil %0 gösterdi ✓).
- **r62-BAYRAK (kullanıcı isteği, TV watchlist flag paritesi)**: izleme listesinde satıra sağ tık → "Bayrak: kırmızı/mavi/sarı" (menüde renk noktası, mevcut renk ✓ ile işaretli) + "Bayrağı kaldır". Bayraklı semboller panelde ÜÇÜNCÜ sekme "⚑ Bayrak"ta ayrı koleksiyon gibi listelenir (Favoriler deseni: state.tab='flagtab'). Satırlarda renkli ⚑ rozeti (tüm sekmelerde). flagtab'da ✕ = bayrağı kaldır; sürükleme yok (drag guard flagtab'ı dışlar). Depo: `vela.flags` = {SEM:'red'|'blue'|'yellow'} (LS + hesap senkronu otomatik — vela.* snapshot). Sekmeye geçişte refreshQuotes. DİKKAT: `const FLAGS` top-level `const` olduğundan window.FLAGS GÖRÜNMEZ (normal) — testlerde window üzerinden sorgulama.
- **r63-BAYRAK-FİLTRE**: ⚑ Bayrak sekmesinde renk filtresi çipleri (Tümü/kırmızı/mavi/sarı — adet sayılı, seçili vurgulu, `vela.flagFilter` ile kalıcı). Filtre seçili renkteki bayraklıları gösterir. (r64'te bu yaklaşım TERK EDİLDİ — kullanıcı her rengin ayrı liste olmasını istedi.)
- **r64-BAYRAK-LİSTE (kullanıcı isteği — GEÇERLİ YAKLAŞIM)**: tek "⚑ Bayrak" sekmesi ve renk filtresi KALDIRILDI. Artık **HER RENK AYRI BİR İZLEME LİSTESİ** gibi: liste seçicide (`#listdd`, düz listelerin altında) kendi renkli ⚑ ikonuyla "Kırmızı bayraklar / Mavi bayraklar / Sarı bayraklar" girişleri, her biri adet sayılı. Birine tıklayınca o renkteki bayraklı tickerlar listelenir.
  · Görünüm `state.flagView` ('red'|'blue'|'yellow'|null) ile temsil edilir — `#wphead2`/sekme yok, panel başlığı (`#listsel .lnm`) "⚑ Kırmızı bayraklar" olur ve `#whead` yerine `#wflaghead` bilgi çubuğu gelir.
  · ÇIKIŞ: "İzleme Listesi"/"Favoriler" sekmesine tıklamak, liste seçiciden gerçek bir liste seçmek veya `switchList()` — hepsi `state.flagView=null` yapar.
  · Bayrak listesinde ✕ = BAYRAĞI KALDIRIR, izleme listesinden çıkarmaz (liste içeriği değişmez — test edildi). Sürükleme kapalı (drag guard), sağ tık menüsü favori+bayrak öğeleri.
  · KAPSAM UYARISI: `enterFlagView()` v3 bölgesinde (renderListBar/switchList ile aynı IIFE) TANIMLI olmalı; global bölgeye konursa `renderListBar is not defined` verir — bu tam olarak r64 geliştirmesinde yaşandı ve `window.enterFlagView === undefined` ile doğrulandı. Global bölgede yalnız FLAGS/FLAG_COLORS/FLAG_NAMES/saveFlags/flagBadge/flagViewHeadHTML kalır (renderWatch & wrowHTML bunları kullanır).
  · Test notu: çok sayıda eski iab sekmesi biriktiğinde stale kod üzerinde test yapılıp yanlış sonuca varılabiliyor (r61/r62/r63 sekmeleri açıkken yaşandı) — test öncesi sekmeyi yenile veya yeni sekme aç.
  · `quotes` top-level `let` olduğundan window'a BAĞLI DEĞİL (`window.quotes` undefined). Test için sahte quote enjekte etmek istersen `window.fetch`'i sarıp `/api/quotes` yanıtını taklit et, sonra `await refreshQuotes()` çağır (gerçek yol: fetchChunk → updateWatchPrices). Bu, yerinde güncelleme yolunu da test eder.
- **r65-OS-KOLON (kullanıcı isteği)**: izleme listesinde uzatılmış seans getirisi AYRI kolonda — başlıklar: `Ad | Fiyat | % | ÖS %`.
  · `%` (p2) = DÜNKÜ GETİRİ: önceki kapanışa göre günlük değişim (TV'nin `chp`'si). Artık uzatılmış seans değeri bunu EZMİYOR (eskiden `quoteView` piyasa dışında `chp`'yi `ext.pct` ile değiştiriyordu — r65'te kaldırıldı).
  · `ÖS %` (p3) = UZATILMIŞ SEANS getirisi: normal seans kapanışından (`rtc`) bu yana %, yalnız `current_session` pre/post_market iken dolu.
  · Kolon, hiçbir satırda ext verisi yoksa `#wlist.noext` ile tamamen gizlenir; seans geçişinde `updateWatchPrices` içindeki `extVar !== wlHasExt` kontrolü sınıfı açıp kapatır (yeniden render gerekmez).
  · `wlHasExt` global bölgede `let` — renderWatch ve updateWatchPrices paylaşır. p3 tooltip'i yerinde güncellemede ayrıca yazılır (`yaz()` yalnız metin+sınıf yazar).
  · Doğrulama (post-market senaryosu): önceki kapanış 100 / normal kapanış 110 / piyasa sonrası 112.2 → p2=+12.20%, p3=+2.00%, rozet SS. Pre-market: p2=+1.00%, p3=+1.00%, rozet ÖS. Normal seans: p3 gizli.
- **r66-OS-ROZET-SİZ (kullanıcı isteği)**: satırdaki ÖS/SS rozeti (`.s1 .exb`) KALDIRILDI — uzatılmış seans bilgisi artık "ÖS %" kolonunda olduğu için satır sadeleşti. Ön seans / sonrası seans ayrımı yalnız satır tooltip'inde (`extTip`) kalır. Kullanılmayan `.exb` CSS'i ve `updateWatchPrices` içindeki rozet oluştur/sil + `rozetDegisti → renderWStrip` mantığı temizlendi; yerine satır `title`'ı yerinde güncellenir. NOT: BIST kapanışta olsa bile listede ABD sembolü varsa (örn. AMEX:RSP ön seansta) "ÖS %" kolonu görünür kalır — bu doğru davranıştır, `noext` yalnız hiçbir satırda uzatılmış veri yoksa uygulanır.
- **r59**: bölüm sürükleme blok takipli; izleme listesinde SAĞ TIK menüsü (`#wctx`, browser menüsü engellenir); cetvel ekran dışı uçta çizilir (`xOfAny`, 2.3 ✓); şifre değiştirme `/api/auth/change` + hesap paneli (2.1.3 ✓); `vela.wSort` temizliği (2.7 ✓). r58'deki "sürükleme katlı bölümleri kalıcı açıyordu" hatası düzeltildi (geçici açılır, bırakınca geri katlanır).
- r58'deki satır sürükleme (DOM sırası → model yeniden kurma) layout-farkındalıklı olarak korundu; tümü sentetik event + canvas sarma ile test edildi.

---

## 3) BİLİNÇLİ DAVRANIŞ KARARLARI (değiştirme — kullanıcı istedi)
- **Sıralama TEK SEFERLİK**: başlığa tıkla → sıralanır ve model yazılır → elle taşıma serbest. Kalıcı sıralı mod yok, ok/gösterge yok, canlı tick sıralamaz. Bölüm adları/bölüm sırası sıralanmaz, satırlar bölüm içinde sıralanır.
- **Çizim tıkla-tıkla**: 2 noktalı araçlarda basılı tutma yok; 1. tık başlangıç, önizleme mıknatısla izler, 2. tık tamamlar. Araç tek kullanımlık (çift tık = kilit).
- **Uç tutamacı**: bir uçtan çekince karşı uç sabit; çizim bitince nesne seçili kalır.
- **Cetvel** ilk araç grubunda (cursor, crosshair, ruler) — taşma nedeniyle en sona alınmıştı, kullanıcı bulamamıştı.
- **Gizli gösterge çipi**: tamamen solmaz; yalnız ad soluk+üstü çizili, değer okunur kalır.
- **İzleme listesi satırı**: yalnız ticker + Fiyat + % kolonları; başlıklar sticky, sıralama tıklaması tek seferlik (yukarıda).
- **Uzatılmış seans rozetleri (ÖS/SS)** izleme listesinde her zaman açık (grafikteki "Uzatılmış seans" düğmesinden bağımsız). — **r66'da DEĞİŞTİ**: rozetler kaldırıldı, bilgi "ÖS %" kolonunda (bkz. 2.8).

---

## 4) NASIL TEST EDİLİR (bu oturumda işe yarayan yöntem)

1. **Yerel sunucu**: proje dizininde `npm ci` (node_modules silinmişse) → `PORT=3010 node server.mjs`. localStorage canlıdan ayrı olduğundan test verisi için `V.addToList/addSection/saveLists` köprüleri kullanılır.
2. **Tarayıcı**: ZCode in-app browser (browser-use). **Dikkat:** bu ortamda `requestAnimationFrame` 0 kez çalışıyor (render donuk) → görsel doğrulama yerine:
   - DOM/model ölçümleri (`#wlist .wrow`, `V.state.*`, `V.seriesKeys()`, `V.getDrawings()`),
   - sentetik `PointerEvent`/`MouseEvent` (bubbles, clientX/Y = rect.left + px),
   - canvas çıktı doğrulaması: `CanvasRenderingContext2D.prototype.fillText/stroke` sarıp çağrıları/renkleri kaydet (cetvel etiketi ve mıknatıs kılavuzu böyle doğrulandı).
3. **Kritik tuzaklar**: `V.getDrawings().forEach(x=>V.removeDrawing(x))` YAPMA — canlıda kullanıcı çizimini siler (bu oturumda başına geldi). Kopya al: `ds.slice()` veya splice(0). Ayrıca `V.setInt('5')` geçersiz (doğru: `'5m'`) — bozuk interval kaydı sayfa açılışını kilitliyordu, artık '1D'ye düşüyor (INT guard).
4. **Sözdizimi kontrolü**: `index.html` içindeki script'i `new Function(body)` ile derle; `server.mjs` için `node --check`.
5. **Sürüm damgası**: her değişiklikte `VELA_BUILD` sabitini yükselt (kullanıcı Ctrl+Shift+R yapmadan göremez), commit + push → canlıda `curl` ile `VELA_BUILD` doğrula. Deploy tetiklenmezse Dokploy API'den elle tetikle (2.2).
6. **Kullanıcının verisine dokunma**: 953 satırlık "USA" listesi ve çizimleri onun verisi. Testte değiştirirsen kanonik sırayı `seed/tv-watchlists.json`'dan geri yaz (referans: `switchList` + `l.items=...` + `saveLists()` + `switchList(listIdx)`).

---

## 5) SON OTURUMDA YAPILANLAR (özet, r42→r58)
- Çizim: tıkla-tıkla modu, uç tutamacı ile tek nokta düzenleme, cetvelin çalışması + ölçüm etiketi (miktar/%/mum/süre) ve görünürlüğü.
- İzleme listesi: Fiyat/% ayrı kolonlar + sticky başlıklar, tek seferlik sıralama (Ad/Fiyat/%), yalnız ticker + büyük punto, uzatılmış seans rozetleri (ÖS/SS) + piyasa dışı fiyat, sürükleme düzeltmeleri, bölüm ▲▼/sürükleme doğrulaması.
- Performans: tick güncellemesi yalnız değişen hücre + 200 ms birleştirme (44k/sn DOM değişimi → ~0; 4 sn'de 3.3 sn ana iş parçacığı tıkanması → 0), sembol değişiminde liste baştan çizilmez, WS gereksiz yeniden kurulum yok, sunucuda bar için bayat-ama-anında önbellek.
- Hacim: son barın canlı hacmi sunucu tazelemesinde sıfırlanmıyor; 1D = günün toplam hacmi.
- Hesap: 401'de sessiz kalınmıyor (toast). — **kendisi hâlâ düzeltilmeli (2.1)**
- Veri: /api/quotes 10 sn önbellek + bayat veri dönüşü ("veriler bazen görünmüyor" sorunu).
