# VELA CHART ↔ TradingView PARİTE ANALİZİ (GAP)

Tarih: 2026-09-24 · Temel: r82-alert-arm kodu + canlı inceleme (web 1440px / mobil 390px ekran görüntüleri)
Amaç: TradingView web + mobilde olup Vela Chart'ta olmayan özellikleri tek tek listelemek ve uygulanabilir olanları hayata geçirmek.

---

## A) MEVCUT DURUM (r82 itibarıyla Vela'da OLANLAR — özet)

| Alan | Vela'da var |
|---|---|
| Grafik motoru | LWC 5.2.1, mumlar/bar/çizgi/alan/heikin ashi, log ölçek, sol eksen seçeneği, geri sayım, çapraz kılavuz, ızgara aç/kapa |
| Zaman dilimleri | 1m 5m 15m 30m 1h 4h 1D 1W 1M |
| Göstergeler | 66 gösterge (MA/Bant/Osilatör/Trend/Hacim/Volatilite/SR/İstatistik), Pine-benzeri özel gösterge editörü, alt paneller, gizle/göster, parametre penceresi |
| Çizim | ~75 araç (fib/gann/pitchfork ailesi, desenler, pozisyon/ölçüm), mıknatıs, favori araç, kilit, nesne ağacı, geri al/yinele, şablon (çizim), sembol başına saklama, JSON dışa aktarım |
| Alarm | Fiyat ≥/≤ çizgi, armed-crossing semantiği, beep + tarayıcı bildirimi, çizgi sürükleme, 15sn REST kontrolü |
| Replay | Basit: %70'ten başlat, sağ ok ile ileri adım, çıkış |
| İzleme listesi | 29 liste/6021 sembol, bölümler + başına/ortasına sürükleme (layout modeli), Fiyat/%/ÖS% kolonları (genişlik + aç/kapa), tek seferlik sıralama, bayrak (3 renk) ayrı listeler, sağ-tık menü, IO JSON/CSV, klavye ↑↓ |
| Hesap | Kayıt/giriş/şifre değiştirme, tüm vela.* ayarları sunucu senkronu, push/pull |
| Veri | TV köprüsü: bars (adjustment: splits/dividends/none), extended session, quotes (lp/ch/chp/volume/rtc/rchp/prev_close), WS canlı ilk 40, arama |
| Görünüm | Koyu/açık tema, zoom hafızası (periyot bazlı, göreli w/off), aralık şeridi 1D…Tümü |
| Arama | TV global search v3 + lokal fallback |

---

## B) EKSİKLER — TAM LİSTE (TV web + mobil'de var, Vela'da yok)

> ✅ = r83'te uygulandı · 🔶 = kısmi/emülasyon · ⛔ = veri kaynağı/ölçek gerekçesiyle şimdilik yok · 📅 = sonraki faz

### B1. Zaman dilimleri
- ✅ **3m** · ✅ **45m** · ✅ **2h** · ✅ **3h** · ✅ **3M (çeyrek)** · ✅ **6M (yarım yıl)**
- ⛔ **Saniye (1s/5s/15s/30s)** — TV köprüsü `seconds_not_entitled` (TV'de de ücretli plan gerektirir). Altyapı hazır: INT listesine satır eklemek yeterli.
- ⛔ **2m/4m/90m/2D/3D/12M** — köprü `custom_resolution` hatası veriyor (TV'de de yok).
- 📅 **Özel aralık (custom interval)** girişi.
- 🔶 Favori TF şeridine yeni dilimler eklendi (sağ tık ile favorileme zaten var).

### B2. Grafik tipleri
- ✅ **Boş mumlar (Hollow Candles)** — per-bar renk emülasyonu (gövde şeffaf, kenar renkli)
- ✅ **Baseline** (baz çizgili alan) — LWC BaselineSeries
- ✅ **Adımlı çizgi (Stepped)** — LineType.WithSteps
- ✅ **İşaretli çizgi (Line with markers)** — pointMarkersVisible
- ✅ **Kolonlar (Columns)** — HistogramSeries ana ölçekte
- ✅ **Yüksek-Düşük (High-Low)** — ince bar emülasyonu
- ✅ **Renko** (müşteri tarafı dönüşüm, % tabanlı otomatik tuğla)
- ✅ **Line Break (3)** — müşteri tarafı dönüşüm
- 📅 Kagi, Point & Figure, Range bars — dönüşüm algoritmaları daha karmaşık; sonraki faz
- ⛔ TV'nin "Elemanlar/Taban" grafik türleri (breadth vb.) — veri yok

### B3. Çizim araçları (Vela ~75 araçla zaten TV'nin ana setinin üzerinde; eksikler)
- ✅ **Risk/Ödül**: Long/Short Pozisyon araçlarında giriş/stop/hedef kutusu + R:R oranı + hedef/stop etiketleri zaten mevcut (TV Risk/Reward çiziminin karşılığı)
- ✅ **Cetvel geliştirme (r83)**: ölçülen alan gölgelendirmesi + etikete toplam işlem hacmi satırı (TV ölçüm aracı paritesi)
- 📅 Kalın/ince uçlu "Path" varyantları, Wave, Rectangle Grid, "H hepsine uzat" — sonraki faz
- 🔶 Mevcut araçlarda TV'deki özellik ekranı (renk/stil/düzey/uçlarda fiyat-zaman rozetleri) — r83'te sağ-tık menü genişletildi (arka plan dolgusu, çapraz ekranda görünür uç etiketi)

### B4. Göstergeler
- ✅ Yeni 17 gösterge: **Williams Alligator, Williams Fractals, Gator Osilatör, Accelerator Osilatör (AC), Balance of Power, Bull Power, Bear Power, Chaikin Osilatör, Chande Kroll Stop, Chandelier Exit, Klinger, KST, McGinley Dynamic, Net Hacim, Fiyat Osilatörü, SMI, ZigZag** (toplam 83)
- ✅ **Gösterge şablonları**: aktif gösterge setini adla kaydet/uygula/sil (vela.indTpl)
- ✅ **Grafik düzeni kaydet/yükle** (vela.layouts): sembol+periyot+tür+göstergeler tek adla (TV Chart Layout)
- 📅 Kaynak parametresi (open/hl2/hlc3/cc) tüm göstergelere; gösterge-üzerine-gösterge; MTF (çoklu zaman dilimi) göstergeleri
- ⛔ Community/Pine script kütüphanesi (kendi editörümüz Pine-benzeri ama TV script yayınlama yok)

### B5. Alarmlar (TV'nin alarm sistemiyle karşılaştırma)
- ✅ **Koşul tipleri**: Fiyat ≥/≤ seviye (var) + **Gösterge koşulu** (gösterge değeri ≥/≤ seviye; yalnız grafikte açık sembolde) + **Fiyat çizgiyi keser** (cross — önceki tick ile kesişim)
- ✅ **Frekans**: Yalnız bir kez / Her tetikte (60 sn soğuma) / Bar kapanışında bir kez (periyot kadar soğuma)
- ✅ **Geçerlilik**: 1 gün / 1 hafta / kaldırılana dek (süre dolunca otomatik arşive)
- ✅ **Alarm geçmişi (log)**: tetiklenenler vela.alertLog'a (son 100) + panelde Geçmiş sekmesi
- ✅ Koşul tipi seçimi (Fiyat/Gösterge/Kesişim), frekans/süre seçicileri, beklemede rozeti
- ⛔ Webhook / e-posta / push (sunucu tarafı çalıştırma) — sunucu mimarisi gereği ileride; tarayıcı bildirimi var

### B6. Bar Replay
- ✅ **Oynat/Duraklat + hız (1x/2x/4x/10x)**, ✅ **geri adım**, ✅ ileri adım (var), ✅ kontrol çubuğu UI
- 📅 Grafiğin herhangi bir barından başlatma (tıkla-başla), anlık zıplama

### B7. İzleme listesi
- ✅ **Yeni kolonlar**: Açılış, Yüksek, Düşük, Hacim, Boşluk % (gap) — `/api/quotes` open/high/low alanları eklendi
- ✅ **Sembol bilgi penceresi** (satır sağ-tık): fiyat/OHLC/hacim/önceki kapanış + sektör, sanayi, piyasa değeri, F/K, HDD, temettü verimi, beta, bid/ask, para birimi, seans durumu
- 📅 Kolon sürükleyerek yeniden sıralama; kolon hazır ayarları (preset)
- 📅 **Detay görünümü** (satıra genişleyen mini grafik); TV'deki 8 renk bayrak (bizde 3)
- ✅ Grup/bölüm katlama zaten var; bayrak listeleri var

### B8. Grafik ayarları & ölçekler
- ✅ **Yüzde ölçek (%)** — PriceScaleMode.Percentage
- ✅ **Watermark** (soluk sembol + periyot filigranı)
- ✅ **Önceki kapanış çizgisi** (noktalı, aç/kapa)
- ✅ **Görünür aralık En Yüksek/En Düşük etiketleri**
- ✅ **Seans kırılım dikey çizgileri** (intraday gün başları)
- ✅ **Çapraz kılavuz stili** (kesik/noktalı/düz) ayarı
- 📅 Grafik arka plan/grid özel renk seçimi; kenar boşluğu; saatin konumu
- 📅 **Saat dilimi seçici** — bar sınırı TZ=+3 sabit; değişken borsa saat dilimi mimari değişikliği ister
- ⛔ Temettü/bölünme/kazanç tarihi markerları — TV özel veri akışı; köprüde hazır uç yok

### B9. UX / paneller
- ✅ **Karşılaştır (Compare)** — başka sembolü % normalize edilmiş ayrı ölçekte üstüne bindirme
- ✅ **Sembol ekle (Overlay)** — ayrı sembolü gerçek fiyatıyla bindirme
- ✅ **Fiyat ekseni sağ-tık menüsü** — otomatik sığdır, log, yüzde, kilitle, fiyati kopyala, sıfırla
- ✅ **Zaman ekseni sağ-tık menüsü** — Tarihe git…, bugüne dön
- ✅ **Tarihe git (Go to date)** diyaloğu
- ✅ **Klavye kısayolları penceresi** (⌨ butonu + modal)
- ✅ **Bar verisini CSV dışa aktar** + ✅ **ekran görüntüsünü panoya kopyala**
- ✅ **Arama filtreleri + son arananlar** (Hisse/Endeks/Kripto/Forex/Emtia çipleri + vela.recent)
- ✅ **Grafik düzeni kaydet/yükle** (adla: sembol+periyot+göstergeler, vela.layouts)
- ✅ **Mobil ⋯ taşma menüsü** — mobilde gizlenen tüm üst çubuk işlevleri (alarm, replay, geri al, tema, ekran görüntüsü, tam ekran, kısayollar…) TV mobilindeki alt menü paritesi
- 📅 **Çoklu grafik düzeni (2x2/4 grafik + senkron)** — büyük mimari iş; sonraki faz
- 📅 Pişman olmayan emir/paper trading paneli, DOM/derinlik
- 📅 Haber paneli, ekonomik takvim, tarama (screener), ısı haritası, fikirler — ayrı ürün alanları (ayrı veri kaynakları gerekir)
- ⛔ Yayınla/paylaş (TV sosyal katmanı), sohbet

### B10. Mobil farkları (TV app)
- ✅ Mobilde üst çubuk ⋯ menüsüyle tüm işlevlere erişim
- 🔶 Alt şerit (drawbar + ticker + dilim tekerleği) zaten mobilde var; TV'deki tam alt-tab bar (Borsa/Haber/Takvim) veri alanı gerektirir 📅
- 🔶 TV mobil push bildirimi ↔ bizde tarayıcı Notification API (kuruluysa çalışır)

---

## C) r83 FAZ-1 UYGULAMA NOTLARI (yapıldı + tarayıcıda doğrulandı)

- Yeni zaman dilimleri INT eşlemeleri: 3m→'3', 45m→'45', 2h→'120', 3h→'180', 3M→'3M', 6M→'6M'. Saniye dilimleri köprüde yetkisiz (denendi, `seconds_not_entitled`); 2m/4m/90m/2D/3D köprüde `custom_resolution` hatası (TV'de de yok).
- Hollow candles: CandlestickSeries + per-bar `color:'rgba(0,0,0,0)'` (yükseliş gövdesi boş), kenar/fitil yön rengi.
- Renko: kapanış serisinden brick=ortalama fiyatın %0.5'i (2 anlamlı basamağa yuvarlanır); sentetik OHLC, zaman = tuğla oluş barı.
- LineBreak(3): son 3 çizginin en yüksek/en düşük kapanış kuralı + open=önceki n çizginin open ortalaması.
- Compare (⧉ düğmesi / grafik sağ-tık): ayrı 'cmp' priceScaleId; % modunda veri normalize edilir (ilk ortak bar = %0), bindirme modunda gerçek fiyat. Çip ✕ ile kaldırılır.
- Alarm v3: `newAlert(symbol, price, dir, {cond, freq, exp, indKey})`; kesişim koşulu `alertPrevLp` sembol-bazlı önceki tick ile; `alertCool` frekans soğuması; gösterge değeri `indLastVals`'ten (yalnız açık sembol).
- Replay v2: `state.replay={i, playing, speed}`; `replayTimer` 1000/hız ms; kontrol çubuğu #replayctl (#chartarea içinde).
- Mobil ⋯ menüsü (#mobmore, ≤900px'te görünür): masaüstünde gizlenen 9 düğme + kısayollar/tarihe git/bindir.
- /api/quotes yeni alanları: open/high/low, bid/ask, currency, sector, industry, market_cap, pe, eps, div_yield, beta, type (TV quote session'ının alanları aynen taşınıyor).
- Doğrulama (yerel 3011, canlı tick): build=r83-tv-parity; 15 dilim menüde; 13 grafik tipi; 83 gösterge; renko çizimi + filigran + ÖK çizgisi + ▼/▲ etiketleri ekran görüntüsüyle; alarm paneli (Aktif/Geçmiş, koşul/frekans/süre seçicileri, gösterge seçimi 4 aktiften); replay kontrol çubuğu (oynat=playing:true, çıkış); sembol bilgi penceresi (F/K, Piyasa Değer, sektör); mobil ⋯ menü 12 öğe.

## D) SONRAKİ FAZLAR (önerilen sıra)
1. Kagi / Point&Figure / Range tipi dönüşümleri
2. Kolon yeniden sıralama + watchlist detay mini-grafiği
3. Çoklu grafik düzeni (layout 2/4 + senkron sembol/periyot)
4. Saat dilimi seçici (borsa saat dilimi metadata köprüden çekilir)
5. Screener/takvim/haber panelleri — ayrı veri kaynağı tasarımla
6. Sunucu tarafı alarm çalıştırıcı (webhook/e-posta)
