#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
from pymongo import MongoClient
from datetime import datetime
import sys
import json
import re

def extract_product_name_from_url(url):
    """URL'den ürün adını çıkar"""
    try:
        if 'hepsiburada.com' in url:
            # URL'deki ürün adı kısmını bul
            parts = url.split('/')
            for part in parts:
                if '-p-' in part:
                    # Ürün kodundan önceki kısmı al ve formatla
                    product_name_part = part.split('-p-')[0]
                    # Kelimeleri ayır ve başharflerini büyük yap
                    words = product_name_part.split('-')
                    product_name = ' '.join(word.capitalize() for word in words if word)
                    return product_name
        return "Hepsiburada Ürünü"
    except Exception as e:
        print(f"Ürün adı çıkarılırken hata: {e}")
        return "Hepsiburada Ürünü"

def create_safe_collection_name(product_name, platform):
    """Ürün adından güvenli koleksiyon adı oluştur"""
    # Türkçe karakterleri değiştir ve özel karakterleri temizle
    safe_name = product_name.lower()
    
    # Türkçe karakter dönüşümleri
    char_map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    }
    
    for turkish_char, english_char in char_map.items():
        safe_name = safe_name.replace(turkish_char, english_char)
    
    # Sadece harf, rakam ve alt çizgi bırak
    safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
    # Boşlukları alt çizgi yap
    safe_name = re.sub(r'\s+', '_', safe_name.strip())
    # Birden fazla alt çizgiyi tek yap
    safe_name = re.sub(r'_+', '_', safe_name)
    # Başta ve sonda alt çizgi varsa kaldır
    safe_name = safe_name.strip('_')
    
    # Koleksiyon adını oluştur
    platform_short = platform.lower().replace(' ', '')
    collection_name = f"{platform_short}_reviews_{safe_name}"
    
    # MongoDB koleksiyon adı sınırları (maksimum 64 karakter)
    if len(collection_name) > 60:
        # Ürün adını kısalt
        max_product_length = 60 - len(f"{platform_short}_reviews_")
        safe_name = safe_name[:max_product_length].rstrip('_')
        collection_name = f"{platform_short}_reviews_{safe_name}"
    
    return collection_name

def scrape_hepsiburada_reviews(product_url, max_pages=10):
    # MongoDB bağlantısı
    client = MongoClient('mongodb://localhost:27017/')
    db = client['ecommerce_analytics']
    
    # ChromeDriver ayarları (Apple Silicon M1/M2 optimizasyonu)
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # WebDriver başlat (Apple Silicon için güvenli metod)
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print("✅ ChromeDriver başlatıldı (Apple Silicon)", file=sys.stderr)
    except Exception as e:
        print(f"❌ ChromeDriver hatası: {e}", file=sys.stderr)
        try:
            print("🔄 Sistem Chrome'u deneniyor...", file=sys.stderr)
            options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            service = Service("/usr/local/bin/chromedriver")
            driver = webdriver.Chrome(service=service, options=options)
            print("✅ Sistem Chrome'u başarılı", file=sys.stderr)
        except Exception as e2:
            print(f"❌ Sistem Chrome hatası: {e2}", file=sys.stderr)
            # Son çare olarak eski manuel path'i dene
            try:
                driver_path = "/Users/helinaydin/Desktop/chromedriver"
                service = Service(driver_path)
                driver = webdriver.Chrome(service=service, options=options)
                print("✅ Manuel path başarılı", file=sys.stderr)
            except Exception as e3:
                return {"success": False, "error": f"ChromeDriver hatası: {e} | Sistem Chrome: {e2} | Manuel: {e3}"}
    
    yorumlar = []
    product_name = extract_product_name_from_url(product_url)
    
    # Ürüne özel koleksiyon adı oluştur
    collection_name = create_safe_collection_name(product_name, "Hepsiburada")
    product_collection = db[collection_name]
    
    # Genel koleksiyonlar da korunsun
    hepsiburada_collection = db['hepsiburada_reviews']
    all_reviews_collection = db['all_reviews']
    
    print(f"📦 Koleksiyon adı: {collection_name}", file=sys.stderr)
    
    try:
        # URL transformasyonu - Jupyter mantığı kullan
        # Eğer -yorumlari ile bitmiyorsa ekle
        if 'yorumlari' not in product_url:
            # URL'den product kısmını çıkar ve -yorumlari ekle
            if '-p-' in product_url:
                base_url = product_url.split('?')[0]  # Query parametrelerini kaldır
                if not base_url.endswith('-yorumlari'):
                    base_url += '-yorumlari'
            else:
                base_url = product_url
        else:
            base_url = product_url.split('?')[0]  # Query parametrelerini kaldır
        
        print(f"📝 Ürün adı: {product_name}", file=sys.stderr)
        print(f"🔗 Base URL: {base_url}", file=sys.stderr)
            
        for page in range(1, max_pages + 1):
            print(f"📄 Sayfa {page} yükleniyor...", file=sys.stderr)
            # Jupyter ile aynı URL formatı
            url = f"{base_url}?sayfa={page}"
            driver.get(url)
            
            try:
                # Yorum container'ları yüklenene kadar bekle
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "hermes-ReviewCard-module-dY_oaYMIo0DJcUiSeaVW"))
                )
                
                # Scroll ile yükleme tetikle (Jupyter ile aynı)
                for _ in range(4):
                    driver.execute_script("window.scrollBy(0, 500);")
                    time.sleep(0.5)
                
                # Yorumları bul (Jupyter ile aynı)
                yorum_elements = driver.find_elements(By.CLASS_NAME, "hermes-ReviewCard-module-dY_oaYMIo0DJcUiSeaVW")
                
                page_reviews = []
                for element in yorum_elements:
                    try:
                        metin = element.text.strip()
                        if not metin or len(metin) <= 10:  # çok kısa boş blokları ayıkla
                            continue
                            
                        # Yorum tarihini al (hermes-ReviewCard-module- ile başlayan span'dan)
                        yorum_tarihi = None
                        try:
                            # hermes-ReviewCard-module- ile başlayan class'ları ara
                            tarih_spans = element.find_elements(By.CSS_SELECTOR, "span[class*='hermes-ReviewCard-module-']")
                            for span in tarih_spans:
                                # content attribute'unu kontrol et (ISO format: 2024-09-11)
                                content_attr = span.get_attribute('content')
                                if content_attr and re.match(r'\d{4}-\d{2}-\d{2}', content_attr):
                                    yorum_tarihi = span.text.strip()  # Türkçe format: "11 Eylül 2024, Çarşamba"
                                    break
                                
                                # Eğer content yoksa, span text'ini kontrol et
                                span_text = span.text.strip()
                                if span_text and any(keyword in span_text.lower() for keyword in 
                                    ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 
                                     'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
                                     'gün önce', 'hafta önce', 'ay önce', 'yıl önce']):
                                    yorum_tarihi = span_text
                                    break
                        except Exception as tarih_hatasi:
                            print(f"⚠️ Tarih çekme hatası: {tarih_hatasi}", file=sys.stderr)
                            yorum_tarihi = None
                        
                        yorumlar.append(metin)
                        page_reviews.append(metin)
                        
                        # MongoDB'ye kaydet - artık 3 koleksiyona da kaydet
                        review_data = {
                            'platform': 'Hepsiburada',
                            'product_name': product_name,
                            'comment': metin,
                            'comment_date': yorum_tarihi,  # Gerçek yorum tarihi
                            'timestamp': datetime.now(),   # Çekilme tarihi
                            'product_url': product_url,
                            'page_number': page,
                            'source': 'web_scraper',
                            'collection_name': collection_name
                        }
                        
                        # 1. Ürüne özel koleksiyon
                        product_collection.insert_one(review_data.copy())
                        
                        # 2. Genel Hepsiburada koleksiyonu (eski sistem uyumluluğu)
                        hepsiburada_collection.insert_one(review_data.copy())
                        
                        # 3. Tüm yorumlar koleksiyonu
                        all_reviews_collection.insert_one(review_data.copy())
                        
                        # Debug: Tarih bilgisini yazdır
                        if yorum_tarihi:
                            print(f"📅 Hepsiburada yorum tarihi bulundu: {yorum_tarihi}", file=sys.stderr)
                            
                    except Exception as yorum_hatasi:
                        print(f"⚠️ Yorum işleme hatası: {yorum_hatasi}", file=sys.stderr)
                        continue
                
                print(f"✅ Sayfa {page}'da {len(page_reviews)} yorum bulundu", file=sys.stderr)
                
                if not page_reviews:
                    print(f"🛑 Sayfa {page}'da yorum bulunamadı, durduriliyor.", file=sys.stderr)
                    break
                    
            except Exception as e:
                print(f"❌ Sayfa {page} atlandı: {e}", file=sys.stderr)
                continue
                
    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    finally:
        driver.quit()
    
    return {
        "success": True,
        "product_name": product_name,
        "total_reviews": len(yorumlar),
        "platform": "Hepsiburada",
        "collection_name": collection_name
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL parametresi gerekli"}))
        sys.exit(1)
    
    url = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    result = scrape_hepsiburada_reviews(url, max_pages)