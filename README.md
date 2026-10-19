# Kitap Odası

Okuma hızı geliştirme + test + topluluk uygulaması. Saf HTML/CSS/JS, Firebase (Auth + Firestore).

## Çalıştırma

ES modülleri ve `fetch` kullanıldığı için bir HTTP sunucusu şart (`file://` ile açılmaz):

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
# → http://localhost:8777/
```

`serve.ps1` çift tıklanarak da çalıştırılabilir; istenen portta başka bir
dinleyici varsa onu kapatıp kendini ayağa kaldırır. Geliştirme sırasında
tarayıcının eski ES modülü önbelleğe alıp yeni kodu gölgelemesini önlemek için
yanıtlar `no-store` ile verilir.

## Dosyalar

```
kitap/
├─ index.html            ekran iskeleti
├─ css/
│  └─ style.css          tema, bileşenler, açık/koyu mod
├─ data/
│  ├─ books.js           kitap ve soru verisi
│  └─ texts/             kitap metinleri (1.txt, 2.txt, 3.txt)
├─ js/
│  ├─ main.js            giriş noktası: modülleri bağlar, olayları dinler
│  ├─ app.js             giriş/kayıt ekranı ve oturum yönetimi
│  ├─ core/              çerçeve: durum, Firebase, gezinme, tercihler
│  │  ├─ state.js        paylaşılan durum + okuma sabitleri
│  │  ├─ firebase.js     Firebase kurulumu, auth/db kısayolları
│  │  ├─ progress.js     kullanıcı dokümanı, ilerleme, favoriler
│  │  ├─ dom.js          ekran geçişi, odak modu
│  │  ├─ prefs.js        renk teması, mod, yazı tipi
│  │  ├─ texts.js        kitap metinlerini indirir ve bellekte tutar
│  │  └─ utils.js        kaçış, tarih, bildirim, yıldız bileşeni
│  └─ features/          ekranlar: her biri kendi işini yapar
│     ├─ library.js      kitaplık, filtreler, kapaklar, kitap detayı
│     ├─ reader.js       okuma oturumu, sayfalama, ilerleme
│     ├─ quiz.js         test, puanlama, sonuç
│     ├─ reviews.js      yorum + yıldız puanlama
│     ├─ profile.js      profil ekranı ve sıralama
│     ├─ stats.js        seri, günlük görevler, rozetler
│     ├─ covers.js       kapak üretimi / Open Library araması
│     └─ pagination.js   metni sayfa sayfa böler
├─ firestore.rules       güvenlik kuralları
├─ serve.ps1             yerel geliştirme sunucusu
└─ README.md
```

### Bağımlılık yönü

`core` altındakiler `features` altındakileri bilmez. Özellik modülleri birbirini
de tanımaz; aralarındaki bağlantıyı `main.js` kurar (ör. kitaplıktan okumaya
geçiş `setResumeHandlers` ile enjekte edilir). Böylece bir modülü okuyup
değiştirmek diğerlerini etkilemez.

`firebase.js` tek yerde tanımlı olduğu için `firebase.firestore.FieldValue`
gibi zincirlemeler modüllere dağılmıyor; `serverTime()` ve `increment()` gibi
kısayollar kullanılıyor.

## Önce şunu yap: Firebase API anahtarı

Bu proje **referrer kısıtlaması olan bir API anahtarı** kullanıyor. Kısıtlama
listesinde sitenin adresi yoksa Google tüm istekleri `403` ile reddediyor ve
uygulama hiçbir ekranda açılmıyor.

1. [Google Cloud Console](https://console.cloud.google.com/) → proje: `kitaptest-6bf57`
2. **API'ler ve Hizmetler → Kimlik Bilgileri**
3. **Tarayıcı anahtarları** → `Browser key (auto created by Firebase)`
4. **Web sitesi kısıtlamaları**'nı aç ve sitenin adresini ekle:
   - yerel geliştirme: `http://localhost:8777/*`
   - yayın: `https://<senin-domainin>/*`
5. Kaydet. Kimlik doğrulama ve Firestore anında çalışır.

Uygulama açılışta bunu kendisi yoklar; anahtar engelliyse giriş ekranında
kırmızı bir panelde adresi ve yapılacakları gösterir.

## Firestore kuralları

Kural dosyası eklemediysen kullanıcı belgelerini herkes okuyabilir:

```bash
firebase deploy --only firestore:rules
```

Konsoldan: **Firestore Veritabanı → Kurallar** bölümüne `firestore.rules`
içeriğini yapıştır ve **Yayınla**'ya bas.

**Gerekli değil:** composite index. Tüm sorgular tek alanlıdır
(`where('bookId')`, `where('userId')`, `orderBy('totalTests')`).

## Veri modeli

```
users/{uid}
    firstName, lastName, grade, createdAt
    totalTests, totalCorrect            ← sıralama bu sayaçlardan okur
    lastBookId, lastReadAt
    books/{bookId}: { phase, ratio, elapsed, updatedAt }
        phase ∈ new | reading | quiz | done
        ratio = metindeki scroll oranı (0-1)

readingResults/{autoId}                ← yalnızca sahibi okuyabilir
    userId, bookId, bookTitle, score, total, wpm, timeSpent, date

bookReviews/{bookId}__{uid}            ← kitap+kişi başına tek yorum
    bookId, bookTitle, userId, userName, userGrade, rating (1-5), text (<=500), date
```

### Neden `users.totalTests`?

Sıralama tüm `readingResults` belgelerini istemciye indirip saymak yerine
kullanıcı dokümanındaki artan sayacı okur. Böylece sıralama hem hızlı hem de
kimsenin test geçmişini göremez.

## Yorumlar

- Kullanıcı başına kitap başına **tek** yorum (belge kimliği deterministik).
- Puan zorunlu, metin isteğe bağlı. Kendi yorumunu düzenleyebilir/silebilir.
- Sıralama: en yeni / en yüksek puan / en düşük puan.
- Tüm kullanıcı metinleri `escapeHtml` ile kaçırılır.

## Tasarım ve görünüm

Palet tek bir ton değişkeninden türetilir: `--h` yüzeyleri, `--accent-h`
vurguyu belirler. Tema değişince tüm renkler birlikte döner.

- **5 renk teması** — Kehribar, Gül, Deniz, Çivit, Adaçayı
- **Koyu / açık mod**
- **3 okuma yazı tipi** — Source Serif 4, Literata, Inter (yalnızca kitap metnini etkiler)
- **Odak modu** — okurken arayüzü gizler, metni genişletir

Tercihler `localStorage` (`kitap:prefs`) içinde saklanır ve `index.html`
başındaki küçük blokla ilk boyamadan önce uygulanır, böylece tema titremesi olmaz.

Okuma metni 700px ile sınırlı; satır uzunluğu 60-80 karakterde kalır.

## Özellikler

- Yorum + 1-5 yıldız puanlama (kitap ve kullanıcı başına tek yorum)
- Kaldığın yerden devam (faz + sayfa numarası)
- Favori kitaplar ve kitaplık filtreleri
- Son 7 gün okuma etkinliği grafiği, seri, rozetler
- Günlük görevler, sıralama, profil geçmişi
- Metin gizleme, yazı boyutu ayarı, okuma ilerleme çubuğu

## Açık kitap görünümü

Okuma alanı bir **açık kitap** gibi çalışır:

- **1100px ve üzeri** ekranlarda iki yaprak yan yana (sol ↔ sağ), ortada sırt
  çizgisi; altında tek yaprak
- Yapraklar kâğıt tonunda (`--paper`), kitap yüzeyden ve zeminden ayrışır
- Her yaprağın üstünde **üst şerit** (solda kitap adı, sağda yazar), altında
  **sayfa numarası**
- Metin iki yana yaslı ve heceli; yaprak başına satır 60-70 karakteri geçmez
- Sayfa çevirirken kısa bir yer değiştirme animasyonu
  (`prefers-reduced-motion` açıksa kapalı)
- Okuma boyunca üst çubuk ve yan panel gizlenir, tek ekranda başlık + sayfa +
  sayfa gezinme sığar

Kitap yüksekliği `clamp(340px, calc(100vh - 240px), 64vh)` ile ekrana uyar:
kısa ekranda küçülür, uzun ekranda büyümez. Böylece gezinme çubuğu ekran
dışına taşmaz.

## Sayfa sayfa okuma

Metin tek bir kaydırma alanı yerine, ekrana sığan **sayfalara** bölünür.

- `←` / `→` tuşları veya alttaki düğmelerle çevrilir (açık kitapta iki yaprak)
- Altta sayfa çubuğu ve "Sayfa 3–4 / 20" göstergesi
- Yazı boyutu, okuma yazı tipi veya ekran genişliği değişince otomatik yeniden
  bölünür, okuduğun yer oran korunarak geri yüklenir
- Kaldığın sayfa numarası Firestore'a yazılır
- Metnin başındaki "Başlık - Yazar" satırı atılır; başlık zaten üst şeritte

Bölme `pagination.js` içinde ikili aramayla yapılır: her sayfa için en uzun
sığan karakter aralığı bulunur, sonra kelime sınırına geri çekilir.
Ölçüm, gerçek sayfa elemanının kendisi üzerinde yapılır — ayrı bir ölçüm
kutusu kullanmak padding ve kenar boşluğu farkları yüzünden tutarsız
sonuç veriyordu.

Ölçüm iki tuzaktan korunur:

1. **Yazı tipi yüklenmeden ölçüm yapılmaz.** `document.fonts.ready` tek başına
   yetmiyor: font henüz hiçbir metinde kullanılmadıysa tarayıcı "hazır" diyor,
   sayfalar yedek fontla bölünüyor ve gerçek font gelince taşıyor. Bu yüzden
   `document.fonts.load()` ile kullanılan yazı tipi açıkça yüklenir.
2. **Üst şerit ve sayfa numarasının yüksekliği sabittir.** İlk ölçüm sayfa
   numarası henüz boşken yapıldığı için, içerik kadar yer kaplasalar kapasite
   ~19px fazla hesaplanıyor ve her sayfa taşıyordu.

## Odak modu

Odak modunda üst çubuk, yan panel, soru şeridi ve geri bağlantısı gizlenir.
Bu yüzden **çıkış yolu** ayrıca eklenir:

- Sağ üste sabit "Odaktan çık" düğmesi (yalnızca odak modunda görünür)
- `Esc` tuşu
- Okuma ekranından çıkınca odak modu kendiliğinden kapanır — aksi hâlde
  test ve profil ekranları çıkışsız kalıyordu

## Kitap kapakları

`covers.js` üç katmanlı çalışır:

1. `books.js` içinde `coverUrl` verilmişse o görsel kullanılır
2. Yoksa Open Library'de başlık **ve** yazar eşleşmesi aranır
3. Bulunamazsa (veya çevrimdışıysa) her kitaba özel tasarlanmış kapak
   gösterilir: düz renk, kitaba özgü geometrik işaret, başlık ve yazar

Sonuç `localStorage`'a yazılır, bir daha aranmaz. Eşleşme yalnızca yazara
dayansa yanlış kitap kapağı gelebildiği için (aynı adlı başka eserler var)
başlık + yazar birlikte aranır. Görsel yüklenemezse tasarlanmış kapağa düşer.

## Bilinen sınırlar

- **WPM gerçek okuma ölçmez.** Sabit 5 dakikalık oturumlarda
  `kelime sayısı / geçen süre` hesaplanır; kısa metinli kitaplar yüksek değer verir.
  Ayrıca istemci tarafında ölçüldüğü için tahrif edilebilir. Ciddi kullanımda
  gerçek okuma süresi sunucuda (Cloud Function) doğrulanmalı.
- **Metin gizleme kozmetiktir.** Metin `startSession` anında DOM'a yazılır;
  gelişmiş geliştirici araçlarıyla erişilebilir.
- Firebase SDK **8.10 (eski namespaced API)** ile yükleniyor.
- Kitap metinleri çalışma anında `fetch` ile gelir → çevrimdışı çalışmaz.
