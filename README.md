# CommerceLens 🔍

Trendyol, Hepsiburada, N11 ve AliExpress e-ticaret sitelerinden ürün yorumlarını otomatik olarak çeken ve analiz eden Next.js uygulaması.

## Özellikler

- 🛍️ **Hepsiburada** ürün yorumlarını çekme (10 sayfa)
- 🛒 **Trendyol** ürün yorumlarını çekme (40 scroll)  
- 🏪 **N11** ürün yorumlarını çekme (8 sayfa)
- 🌎 **AliExpress** ürün yorumlarını çekme (10 scroll)
- 💾 **MongoDB** ile veri saklama
- 🔍 **Arama ve filtreleme** özellikleri
- 📱 **Responsive** tasarım
- ⚡ **Gerçek zamanlı** sonuçlar
- 🤖 **AI Analiz** (Gemini entegrasyonu)
- 📊 **Benchmark** karşılaştırmaları

## Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
# Node.js bağımlılıkları
npm install

# Python bağımlılıkları
pip install -r requirements.txt
```

### 2. MongoDB'yi Çalıştırın

```bash
# MongoDB'nin çalıştığından emin olun
mongosh mongodb://localhost:27017/
```

### 3. ChromeDriver Otomatik İndirme

Artık ChromeDriver otomatik olarak indirilir ve yönetilir. Manuel kurulum gerekmez.

### 4. Uygulamayı Çalıştırın

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacaktır.

## Kullanım

### 1. URL ile Scraping
1. Ana sayfada ürün URL'sini girin (Hepsiburada, Trendyol, N11 veya AliExpress)
2. Platform otomatik olarak algılanacaktır
3. "Yorumları Çek" butonuna tıklayın

### 2. Ürün Adı ile Arama
1. "Ürün Adı ile Arama" sekmesinde ürün adını girin
2. Platform seçin (Trendyol, Hepsiburada, N11, AliExpress)
3. İlk 5 ürünün yorumları tek koleksiyonda toplanır

### Platform Özellikleri

| Platform | Sayfa/Scroll | Açıklama |
|----------|-------------|----------|
| Hepsiburada | 10 sayfa | Her sayfada ~10 yorum |
| Trendyol | 40 scroll | Infinite scroll sistemi |
| N11 | 8 sayfa | Her sayfada ~8 yorum |
| AliExpress | 10 scroll | Her scroll'da ~10-20 yorum |

## API Endpoints

### POST /api/scrape
Ürün yorumlarını çeker ve MongoDB'ye kaydeder.

```json
{
  "url": "https://www.hepsiburada.com/urun-p-XXXXX",
  "platform": "hepsiburada",
  "maxPages": 10
}
```

**Ürün Arama İçin:**
```json
{
  "searchTerm": "iphone 15",
  "platform": "n11",
  "searchType": "product_search"
}
```

### GET /api/reviews
Kaydedilen yorumları getirir.

Query parametreleri:
- `productName`: Ürün adına göre filtrele
- `platform`: Platform'a göre filtrele
- `limit`: Maksimum sonuç sayısı

### DELETE /api/reviews
Ürün yorumlarını siler.

Query parametresi:
- `productName`: Silinecek ürün adı

### POST /api/analyze
AI ile yorum analizi yapar.

### POST /api/benchmark
Satıcı benchmark'ları oluşturur.

## MongoDB Koleksiyonları

### Platform Koleksiyonları
- `trendyol_reviews_[arama_terimi]`: Trendyol arama sonuçları
- `hepsiburada_reviews_[arama_terimi]`: Hepsiburada arama sonuçları  
- `n11_reviews_[arama_terimi]`: N11 arama sonuçları
- `aliexpress_reviews_[arama_terimi]`: AliExpress arama sonuçları

### Genel Koleksiyonlar
- `analysis_history`: AI analiz geçmişi
- Database sayfasında tüm koleksiyonlar listelenir

## Veri Yapısı

Her yorum kaydı şu alanları içerir:

```json
{
  "platform": "aliexpress",
  "product_name": "iPhone 15 Pro Max",
  "comment": "Great product, fast shipping...",
  "timestamp": "2024-01-01T00:00:00Z",
  "product_url": "https://tr.aliexpress.com/item/123456.html",
  "product_price": 1200.0,
  "search_term": "iphone 15",
  "scroll_number": 10,
  "review_index": 1,
  "likes": 0
}
```

## Teknolojiler

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB
- **Scraping**: Python, Selenium, ChromeDriver (webdriver-manager)
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS, Glassmorphism

## Özellik Sayfaları

- **Ana Sayfa**: Scraping işlemleri
- **Database**: Koleksiyon görüntüleme ve AI analizi
- **History**: Analiz geçmişi
- **Benchmark**: Satıcı karşılaştırmaları
- **Product Benchmark**: Ürün karşılaştırmaları

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun: `git checkout -b feature/amazing-feature`
3. Commit yapın: `git commit -m 'Add amazing feature'`
4. Push edin: `git push origin feature/amazing-feature`
5. Pull Request açın

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## Not

 # Deploy trigger
