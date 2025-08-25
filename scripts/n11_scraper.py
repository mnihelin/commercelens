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
    """N11 URL'sinden ürün adını çıkar"""
    try:
        # URL'den ürün adını çıkarma
        if '/urun/' in url:
            product_part = url.split('/urun/')[1]
            if '?' in product_part:
                product_part = product_part.split('?')[0]
            if '-' in product_part:
                # Son kısmı ID olarak kabul et ve öncesini al
                parts = product_part.split('-')
                if len(parts) > 1:
                    # Son part'ı kontrol et (ID gibi görünüyorsa kaldır)
                    last_part = parts[-1]
                    if last_part.isdigit() or any(char.isdigit() for char in last_part):
                        product_name = '-'.join(parts[:-1])
                    else:
                        product_name = product_part
                else:
                    product_name = product_part
            else:
                product_name = product_part
            
            # URL encoding'i temizle ve normalize et
            product_name = product_name.replace('-', ' ').replace('_', ' ')
            # Fazla boşlukları temizle
            product_name = ' '.join(product_name.split())
            
            return product_name
    except Exception as e:
        print(f"⚠️ URL'den ürün adı çıkarılamadı: {e}", file=sys.stderr)
    
    return "bilinmeyen_urun"

def extract_price_from_product_page(driver, product_url):
    """N11 ürün sayfasından fiyat bilgisini çıkar"""
    price = None
    try:
        # Yorumlar URL'sinden ana ürün URL'sine çevir
        main_product_url = product_url.split('?')[0]
        
        # Yeni sekmede açarak mevcut scraping'i bozmayalım
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[1])
        
        driver.get(main_product_url)
        time.sleep(2)
        
        # N11 fiyat selectors
        price_selectors = [
            ".newPrice",
            ".price",
            ".product-price",
            ".ins",
            ".priceContainer .newPrice",
            "[class*='price']",
            "[class*='Price']"
        ]
        
        for selector in price_selectors:
            try:
                price_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for elem in price_elements:
                    text = elem.text.strip()
                    # Fiyat pattern'ini ara (TL, ₺ veya sadece rakam)
                    price_match = re.search(r'([\d.,]+)\s*(?:TL|₺|)', text)
                    if price_match:
                        price_str = price_match.group(1).replace('.', '').replace(',', '.')
                        try:
                            price = float(price_str)
                            print(f"    💰 Fiyat bulundu ({selector}): {price} TL", file=sys.stderr)
                            break
                        except ValueError:
                            continue
                if price:
                    break
            except Exception:
                continue
        
        # Sekmeyi kapat ve ana sekmeye dön
        driver.close()
        driver.switch_to.window(driver.window_handles[0])
        
    except Exception as e:
        print(f"    ⚠️ Fiyat çıkarma hatası: {e}", file=sys.stderr)
        # Hata durumunda doğru sekmeye döndüğümüzden emin ol
        try:
            if len(driver.window_handles) > 1:
                driver.close()
            driver.switch_to.window(driver.window_handles[0])
        except:
            pass
    
    return price

def scrape_n11_product(product_url, max_pages=8):
    """N11 ürününden yorumları çek"""
    
    print(f"🚀 N11 scraping başlatılıyor...", file=sys.stderr)
    print(f"📱 Ürün URL: {product_url}", file=sys.stderr)
    print(f"📄 Maksimum sayfa: {max_pages}", file=sys.stderr)
    
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
    # options.add_argument("--disable-images")  # Yorumlar için resimler gerekebilir
    # options.add_argument("--disable-javascript")  # Yorumlar JavaScript ile yüklenebilir
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        # ChromeDriverManager'da Apple Silicon için özel ayarlar
        from webdriver_manager.chrome import ChromeDriverManager
        from webdriver_manager.core.os_manager import PATTERN
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print("✅ ChromeDriver başlatıldı (Apple Silicon)", file=sys.stderr)
    except Exception as e:
        print(f"❌ ChromeDriver hatası: {e}", file=sys.stderr)
        # Alternatif olarak sistem Chrome'unu kullanmayı dene
        try:
            print("🔄 Sistem Chrome'u deneniyor...", file=sys.stderr)
            options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            service = Service("/usr/local/bin/chromedriver")  # Homebrew yolu
            driver = webdriver.Chrome(service=service, options=options)
            print("✅ Sistem Chrome'u başarılı", file=sys.stderr)
        except Exception as e2:
            print(f"❌ Sistem Chrome hatası: {e2}", file=sys.stderr)
            return {"success": False, "error": f"ChromeDriver hatası: {e} | Sistem Chrome hatası: {e2}"}

    yorumlar = []
    
    try:
        # Ürün adını URL'den çıkar
        product_name = extract_product_name_from_url(product_url)
        print(f"📦 Ürün adı: {product_name}", file=sys.stderr)
        
        # Koleksiyon adını oluştur
        collection_name = create_safe_collection_name(product_name, "n11")
        print(f"🗄️ Koleksiyon adı: {collection_name}", file=sys.stderr)
        
        # Koleksiyonu temizle
        collection = db[collection_name]
        collection.delete_many({})
        print(f"🗑️ Eski veriler temizlendi", file=sys.stderr)
        
        # Fiyat bilgisini al
        price = extract_price_from_product_page(driver, product_url)
        
        for page in range(1, max_pages + 1):
            yorum_url = f"{product_url}?pg={page}"
            print(f"\n📄 Sayfa {page}/{max_pages} işleniyor...", file=sys.stderr)
            
            try:
                driver.get(yorum_url)
                time.sleep(3)

                # Yorumları bekle
                try:
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "li.comment"))
                    )
                except:
                    print(f"⚠️ Sayfa {page}: Yorum bulunamadı", file=sys.stderr)
                    continue

                # Yorumları bul
                yorum_ogeleri = driver.find_elements(By.CSS_SELECTOR, "li.comment")
                print(f"🔍 {len(yorum_ogeleri)} yorum bulundu", file=sys.stderr)

                for idx, item in enumerate(yorum_ogeleri):
                    try:
                        yorum_text = item.text.strip()
                        if yorum_text and len(yorum_text) > 10:
                            yorumlar.append(yorum_text)
                            
                            # N11 yorum tarihi çek
                            comment_date = None
                            try:
                                date_element = item.find_element(By.CSS_SELECTOR, "span.commentDate")
                                if date_element:
                                    date_text = date_element.text.strip()
                                    if date_text:
                                        comment_date = date_text
                                        print(f"📅 N11 yorum tarihi bulundu: {comment_date}", file=sys.stderr)
                            except:
                                pass  # Tarih bulunamazsa devam et
                            
                            # MongoDB'ye kaydet
                            review_data = {
                                'platform': 'n11',
                                'comment': yorum_text,
                                'comment_date': comment_date,
                                'timestamp': datetime.now(),
                                'product_url': product_url,
                                'product_name': product_name,
                                'page_number': page,
                                'review_index': idx + 1,
                                'price': price,
                                'likes': 0  # N11'de beğeni sistemi farklı, şimdilik 0
                            }
                            
                            collection.insert_one(review_data)
                            
                            if len(yorumlar) % 10 == 0:
                                print(f"    💾 {len(yorumlar)} yorum kaydedildi...", file=sys.stderr)
                                
                    except Exception as inner_e:
                        print(f"    ⚠️ Yorum işleme hatası: {inner_e}", file=sys.stderr)
                        continue

            except Exception as page_error:
                print(f"🚫 Sayfa {page} hatası: {page_error}", file=sys.stderr)
                continue

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
            df = pd.DataFrame({"Yorum": yorumlar})
            excel_filename = f"n11_{product_name.replace(' ', '_')}_yorumlar.xlsx"
            df.to_excel(excel_filename, index=False)
            print(f"📁 Excel dosyası oluşturuldu: {excel_filename}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Excel oluşturma hatası: {e}", file=sys.stderr)

    print(f"\n✅ N11 scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam yorum: {len(yorumlar)}", file=sys.stderr)
    print(f"🗄️ Koleksiyon: {collection_name}", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": len(yorumlar),
        "collection_name": collection_name,
        "product_name": product_name,
        "platform": "n11",
        "price": price
    }

if __name__ == "__main__":
    # Test için örnek URL
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    else:
        test_url = "https://www.n11.com/urun/forlife-60w-solar-gunes-enerjili-sarjli-isildak-38266647?magaza=cinarelk"
        max_pages = 8
    
    result = scrape_n11_product(test_url, max_pages)
    print(json.dumps(result, ensure_ascii=False, indent=2)) 