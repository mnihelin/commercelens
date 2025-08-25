#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from pymongo import MongoClient
from datetime import datetime
import time
import sys
import json
import re

def extract_product_name_from_url(url):
    """URL'den ürün adını çıkar"""
    try:
        if 'trendyol.com' in url:
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
        return "Trendyol Ürünü"
    except Exception as e:
        return "Trendyol Ürünü"

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

def scrape_trendyol_reviews(product_url, scroll_count=40):
    # MongoDB bağlantısı
    client = MongoClient('mongodb://localhost:27017/')
    db = client['ecommerce_analytics']
    
    # Ürün adını çıkar
    product_name = extract_product_name_from_url(product_url)
    
    # Ürüne özel koleksiyon adı oluştur
    collection_name = create_safe_collection_name(product_name, "Trendyol")
    product_collection = db[collection_name]
    
    # Genel koleksiyonlar da korunsun
    trendyol_collection = db['trendyol_reviews']
    all_reviews_collection = db['all_reviews']
    
    print(f"📦 Koleksiyon adı: {collection_name}", file=sys.stderr)
    
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
            try:
                driver_path = "/Users/helinaydin/Desktop/chromedriver"
                service = Service(driver_path)
                driver = webdriver.Chrome(service=service, options=options)
                print("✅ Manuel path başarılı", file=sys.stderr)
            except Exception as e3:
                return {"success": False, "error": f"ChromeDriver hatası: {e} | Sistem Chrome: {e2} | Manuel: {e3}"}
    
    yorumlar = []
    
    try:
        # URL'yi yorum sayfasına dönüştür
        if not 'yorumlar' in product_url:
            base_url = product_url.split('?')[0]
            if base_url.endswith('/'):
                base_url = base_url[:-1]
            base_url += '/yorumlar'
        else:
            base_url = product_url
            
        driver.get(base_url)
        time.sleep(3)
        
        # Yorum div'leri yüklenene kadar bekle
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "comment"))
        )
        
        # === SCROLL (Jupyter notebook ile aynı mantık) ===
        for i in range(scroll_count):
            driver.execute_script("window.scrollBy(0, 500);")
            time.sleep(1)
            print(f"📜 Scroll {i+1}/{scroll_count} tamamlandı.", file=sys.stderr)
        
        # === Yorumları Çek (Jupyter notebook mantığı) ===
        yorum_divleri = driver.find_elements(By.CLASS_NAME, "comment")
        for yorum in yorum_divleri:
            try:
                # Yorum metnini al
                metin = yorum.text.strip()
                if not metin or len(metin) <= 5:
                    continue
                    
                # Yorum tarihini al (comment-info-item class'ından)
                yorum_tarihi = None
                try:
                    tarih_elements = yorum.find_elements(By.CLASS_NAME, "comment-info-item")
                    for element in tarih_elements:
                        element_text = element.text.strip()
                        # Tarih formatlarını kontrol et (örn: "12 Ocak 2024", "2 gün önce", "1 hafta önce")
                        if any(keyword in element_text.lower() for keyword in ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 
                                                                              'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
                                                                              'gün önce', 'hafta önce', 'ay önce', 'yıl önce']):
                            yorum_tarihi = element_text
                            break
                    
                    # Eğer tarih bulunamazsa, comment-info-item'ların içeriğini kontrol et
                    if not yorum_tarihi and tarih_elements:
                        for element in tarih_elements:
                            element_text = element.text.strip()
                            # Sayı içeren ve tarih benzeri metinleri kontrol et
                            if re.search(r'\d+', element_text) and len(element_text) > 3:
                                yorum_tarihi = element_text
                                break
                except Exception as tarih_hatasi:
                    print(f"⚠️ Tarih çekme hatası: {tarih_hatasi}", file=sys.stderr)
                    yorum_tarihi = None
                
                # Dublika kontrolü
                if metin not in yorumlar:
                    yorumlar.append(metin)
                    
                    # MongoDB'ye kaydet - artık 3 koleksiyona da kaydet
                    review_data = {
                        'platform': 'Trendyol',
                        'product_name': product_name,
                        'comment': metin,
                        'comment_date': yorum_tarihi,  # Gerçek yorum tarihi
                        'timestamp': datetime.now(),   # Çekilme tarihi
                        'product_url': product_url,
                        'source': 'web_scraper',
                        'collection_name': collection_name
                    }
                    
                    # 1. Ürüne özel koleksiyon
                    product_collection.insert_one(review_data.copy())
                    
                    # 2. Genel Trendyol koleksiyonu (eski sistem uyumluluğu)
                    trendyol_collection.insert_one(review_data.copy())
                    
                    # 3. Tüm yorumlar koleksiyonu
                    all_reviews_collection.insert_one(review_data.copy())
                    
                    # Debug: Tarih bilgisini yazdır
                    if yorum_tarihi:
                        print(f"📅 Yorum tarihi bulundu: {yorum_tarihi}", file=sys.stderr)
                        
            except Exception as yorum_hatasi:
                print(f"⚠️ Yorum işleme hatası: {yorum_hatasi}", file=sys.stderr)
                continue
        
        print(f"Toplam {len(yorumlar)} yorum çekildi", file=sys.stderr)
        
    except Exception as e:
        print(f"❌ Yorum çekme hatası: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    finally:
        driver.quit()
    
    return {
        "success": True,
        "product_name": product_name,
        "total_reviews": len(yorumlar),
        "platform": "Trendyol",
        "collection_name": collection_name
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL parametresi gerekli"}))
        sys.exit(1)
    
    url = sys.argv[1]
    scroll_count = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    
    result = scrape_trendyol_reviews(url, scroll_count)
    print(json.dumps(result, ensure_ascii=False))