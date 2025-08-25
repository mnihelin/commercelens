#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
from pymongo import MongoClient
from datetime import datetime
import time
import sys
import json
import re

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

def extract_product_name_from_url(url):
    """AliExpress URL'sinden ürün adını çıkar"""
    try:
        # URL'den ürün ID'sini çıkar
        if '/item/' in url:
            product_part = url.split('/item/')[1]
            if '.html' in product_part:
                product_id = product_part.split('.html')[0]
                # Sadece ID varsa generic bir isim döndür
                return f"aliexpress_product_{product_id}"
            else:
                return f"aliexpress_product_{product_part}"
        return "aliexpress_product"
    except Exception as e:
        print(f"⚠️ URL'den ürün adı çıkarılamadı: {e}", file=sys.stderr)
        return "aliexpress_product"

def extract_price_from_product_page(driver, product_url):
    """AliExpress ürün sayfasından fiyat bilgisini çıkar"""
    price = None
    try:
        # Ana sayfadan fiyat çıkarma denemeleri
        price_selectors = [
            ".notranslate",
            "[class*='price']",
            "[class*='Price']",
            ".price",
            ".product-price"
        ]
        
        for selector in price_selectors:
            try:
                price_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for elem in price_elements:
                    text = elem.text.strip()
                    # Fiyat pattern'ini ara (TL, $ veya sadece rakam)
                    price_match = re.search(r'([\d.,]+)\s*(?:TL|₺|\$|)', text)
                    if price_match:
                        price_str = price_match.group(1).replace('.', '').replace(',', '.')
                        try:
                            price = float(price_str)
                            print(f"    💰 Fiyat bulundu ({selector}): {price}", file=sys.stderr)
                            break
                        except ValueError:
                            continue
                if price:
                    break
            except Exception:
                continue
        
    except Exception as e:
        print(f"    ⚠️ Fiyat çıkarma hatası: {e}", file=sys.stderr)
    
    return price

def scrape_aliexpress_product(product_url, max_scrolls=10):
    """AliExpress ürününden yorumları çek"""
    
    print(f"🚀 AliExpress scraping başlatılıyor...", file=sys.stderr)
    print(f"📱 Ürün URL: {product_url}", file=sys.stderr)
    print(f"🔄 Maksimum scroll: {max_scrolls}", file=sys.stderr)
    
    # MongoDB bağlantısı
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        print("✅ MongoDB bağlantısı başarılı", file=sys.stderr)
    except Exception as e:
        print(f"❌ MongoDB bağlantı hatası: {e}", file=sys.stderr)
        return {"success": False, "error": f"MongoDB bağlantı hatası: {e}"}

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
            return {"success": False, "error": f"ChromeDriver hatası: {e} | Sistem Chrome hatası: {e2}"}

    yorumlar = set()
    
    try:
        # Ürün adını URL'den çıkar
        product_name = extract_product_name_from_url(product_url)
        print(f"📦 Ürün adı: {product_name}", file=sys.stderr)
        
        # Koleksiyon adını oluştur
        collection_name = create_safe_collection_name(product_name, "aliexpress")
        print(f"🗄️ Koleksiyon adı: {collection_name}", file=sys.stderr)
        
        # Koleksiyonu temizle
        collection = db[collection_name]
        collection.delete_many({})
        print(f"🗑️ Eski veriler temizlendi", file=sys.stderr)
        
        # Sayfayı aç
        driver.get(product_url)
        time.sleep(4)
        
        # Fiyat bilgisini al
        price = extract_price_from_product_page(driver, product_url)
        
        # "Daha fazlasını görüntüle" butonuna tıkla (varsa)
        try:
            btn = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//button[contains(@class,'v3--btn--KaygomA')]"))
            )
            driver.execute_script("arguments[0].click();", btn)
            time.sleep(3)
            print("✅ 'Daha fazla' butonuna tıklandı", file=sys.stderr)
        except:
            print("ℹ️ 'Daha fazla' butonu bulunamadı, doğrudan devam ediliyor.", file=sys.stderr)

        # Scroll yapılacak yorum alanı bulunuyor
        try:
            container = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "comet-v2-modal-body"))
            )
            print("✅ Scroll yapılacak alan bulundu.", file=sys.stderr)
        except:
            print("❌ Scroll konteyneri bulunamadı. Sayfa yapısı değişmiş olabilir.", file=sys.stderr)
            # Alternatif scroll container'ları dene
            try:
                container = driver.find_element(By.TAG_NAME, "body")
                print("✅ Body ile scroll yapılacak", file=sys.stderr)
            except:
                driver.quit()
                return {"success": False, "error": "Scroll konteyneri bulunamadı"}

        # Olası yorum kutusu class'ları
        css_list = [
            "div[class^='list--itemBox--']",
            "div[class^='list--itemReview--']",
            "div.product-review-item",
            "div.eva-card-review"
        ]
        
        sel = None
        for css in css_list:
            if driver.find_elements(By.CSS_SELECTOR, css):
                sel = css
                break
        
        if not sel:
            print("⚠️ Yorum kutusu bulunamadı.", file=sys.stderr)
            driver.quit()
            return {"success": False, "error": "Yorum kutusu bulunamadı"}

        print(f"🔍 Yorum selector bulundu: {sel}", file=sys.stderr)

        # Scroll yaparak yorumları topla
        for i in range(max_scrolls):
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", container)
            time.sleep(1.5)

            for e in driver.find_elements(By.CSS_SELECTOR, sel):
                txt = e.text.strip()
                if len(txt) > 10:
                    yorumlar.add(txt)

            print(f"📦 Scroll {i+1}: {len(yorumlar)} yorum toplandı", file=sys.stderr)
            
            if len(yorumlar) % 50 == 0 and len(yorumlar) > 0:
                print(f"    💾 {len(yorumlar)} yorum işlendi...", file=sys.stderr)

        # MongoDB'ye kaydet
        review_index = 1
        for yorum_text in yorumlar:
            review_data = {
                'platform': 'aliexpress',
                'comment': yorum_text,
                'timestamp': datetime.now(),
                'product_url': product_url,
                'product_name': product_name,
                'scroll_number': max_scrolls,
                'review_index': review_index,
                'price': price,
                'likes': 0  # AliExpress'te beğeni sistemi farklı, şimdilik 0
            }
            
            collection.insert_one(review_data)
            review_index += 1

    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    
    finally:
        try:
            driver.quit()
            print("🔒 Driver kapatıldı", file=sys.stderr)
        except:
            pass

    # Excel çıktısı oluştur
    try:
        if yorumlar:
            df = pd.DataFrame({"Yorum": list(yorumlar)})
            excel_filename = f"aliexpress_{product_name.replace(' ', '_')}_yorumlar.xlsx"
            df.to_excel(excel_filename, index=False)
            print(f"📁 Excel dosyası oluşturuldu: {excel_filename}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Excel oluşturma hatası: {e}", file=sys.stderr)

    print(f"\n✅ AliExpress scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam yorum: {len(yorumlar)}", file=sys.stderr)
    print(f"🗄️ Koleksiyon: {collection_name}", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": len(yorumlar),
        "collection_name": collection_name,
        "product_name": product_name,
        "platform": "aliexpress",
        "price": price
    }

if __name__ == "__main__":
    # Test için örnek URL
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        max_scrolls = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    else:
        test_url = "https://tr.aliexpress.com/item/1005006728027200.html"
        max_scrolls = 10
    
    result = scrape_aliexpress_product(test_url, max_scrolls)