#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import pandas as pd
from pymongo import MongoClient
from datetime import datetime
import time
import sys
import json
import re
from urllib.parse import quote

def create_safe_collection_name(search_term, platform):
    """Arama teriminden güvenli koleksiyon adı oluştur"""
    # Türkçe karakterleri değiştir ve özel karakterleri temizle
    safe_name = search_term.lower()
    
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
        # Arama terimini kısalt
        max_search_length = 60 - len(f"{platform_short}_reviews_")
        safe_name = safe_name[:max_search_length].rstrip('_')
        collection_name = f"{platform_short}_reviews_{safe_name}"
    
    return collection_name

def extract_price_from_product_element(element):
    """Ürün elementinden fiyat bilgisini çıkar"""
    price = None
    try:
        price_texts = [
            element.text,
            element.get_attribute('innerText') or ''
        ]
        
        for text in price_texts:
            # Fiyat pattern'ini ara (TL, $ veya sadece rakam)
            price_matches = re.findall(r'([\d.,]+)\s*(?:TL|₺|\$)', text)
            if price_matches:
                price_str = price_matches[0].replace('.', '').replace(',', '.')
                try:
                    price = float(price_str)
                    break
                except ValueError:
                    continue
    except Exception:
        pass
    
    return price

def get_product_links_from_search(driver, search_term, max_products=5):
    """AliExpress'te arama yaparak ürün linklerini al"""
    
    print(f"🔍 AliExpress'te '{search_term}' araniyor...", file=sys.stderr)
    
    try:
        # AliExpress TR arama sayfasına git
        search_url = f"https://tr.aliexpress.com/w/wholesale-{quote(search_term)}.html"
        driver.get(search_url)
        time.sleep(3)
        
        # Ürün linklerini topla
        product_links = []
        product_selectors = [
            "a[href*='/item/']",
            "a[href*='aliexpress.com/item']",
            ".product-item a",
            ".item-link"
        ]
        
        for selector in product_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for element in elements:
                    href = element.get_attribute('href')
                    if href and '/item/' in href and 'aliexpress.com' in href:
                        # URL'yi temizle
                        if '?' in href:
                            href = href.split('?')[0]
                        if href not in product_links:
                            product_links.append(href)
                            print(f"    📦 Ürün bulundu: {href[:80]}...", file=sys.stderr)
                        
                        if len(product_links) >= max_products:
                            break
                
                if len(product_links) >= max_products:
                    break
                    
            except Exception as e:
                print(f"    ⚠️ Selector {selector} hatası: {e}", file=sys.stderr)
                continue
        
        print(f"✅ {len(product_links)} ürün linki toplandı", file=sys.stderr)
        return product_links[:max_products]
        
    except Exception as e:
        print(f"❌ Arama hatası: {e}", file=sys.stderr)
        return []

def scrape_aliexpress_product_reviews(product_url, max_scrolls=10, shared_collection=None, shared_db=None, search_term=None):
    """AliExpress ürününden yorumları çek ve paylaşılan koleksiyona kaydet"""
    
    print(f"🚀 AliExpress ürün scraping: {product_url[:60]}...", file=sys.stderr)
    
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
    product_name = None
    price = None
    
    try:
        # Sayfayı aç
        driver.get(product_url)
        time.sleep(4)
        
        # Ürün adını sayfadan çıkar
        try:
            title_selectors = [
                "h1",
                ".product-title",
                "[data-pl='product-title']",
                ".pdp-product-title"
            ]
            
            for selector in title_selectors:
                try:
                    title_element = driver.find_element(By.CSS_SELECTOR, selector)
                    if title_element and title_element.text.strip():
                        product_name = title_element.text.strip()[:100]  # İlk 100 karakter
                        print(f"📦 Ürün adı: {product_name}", file=sys.stderr)
                        break
                except:
                    continue
                    
            if not product_name:
                # URL'den ürün ID'sini çıkar
                if '/item/' in product_url:
                    product_id = product_url.split('/item/')[1].split('.html')[0]
                    product_name = f"aliexpress_product_{product_id}"
                else:
                    product_name = "aliexpress_product"
                    
        except Exception as e:
            print(f"⚠️ Ürün adı çıkarma hatası: {e}", file=sys.stderr)
            product_name = "aliexpress_product"
        
        # Fiyat bilgisini al
        try:
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
                        price_match = re.search(r'([\d.,]+)\s*(?:TL|₺|\$)', text)
                        if price_match:
                            price_str = price_match.group(1).replace('.', '').replace(',', '.')
                            try:
                                price = float(price_str)
                                print(f"    💰 Fiyat: {price}", file=sys.stderr)
                                break
                            except ValueError:
                                continue
                    if price:
                        break
                except Exception:
                    continue
        except Exception as e:
            print(f"    ⚠️ Fiyat çıkarma hatası: {e}", file=sys.stderr)
        
        # "Daha fazlasını görüntüle" butonuna tıkla (varsa)
        try:
            btn = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//button[contains(@class,'v3--btn--KaygomA')]"))
            )
            driver.execute_script("arguments[0].click();", btn)
            time.sleep(3)
            print("✅ 'Daha fazla' butonuna tıklandı", file=sys.stderr)
        except:
            print("ℹ️ 'Daha fazla' butonu bulunamadı", file=sys.stderr)

        # Scroll yapılacak yorum alanı bulunuyor
        try:
            container = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "comet-v2-modal-body"))
            )
            print("✅ Scroll yapılacak alan bulundu", file=sys.stderr)
        except:
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
            print("⚠️ Yorum kutusu bulunamadı", file=sys.stderr)
            driver.quit()
            return {"success": False, "error": "Yorum kutusu bulunamadı"}

        print(f"🔍 Yorum selector: {sel}", file=sys.stderr)

        # Scroll yaparak yorumları topla
        for i in range(max_scrolls):
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", container)
            time.sleep(1.5)

            for e in driver.find_elements(By.CSS_SELECTOR, sel):
                txt = e.text.strip()
                if len(txt) > 10:
                    yorumlar.add(txt)

            if i % 3 == 0:  # Her 3 scroll'da bir rapor et
                print(f"📦 Scroll {i+1}/{max_scrolls}: {len(yorumlar)} yorum", file=sys.stderr)

        # MongoDB'ye kaydet (paylaşılan koleksiyona)
        if shared_collection is not None and shared_db is not None:
            review_index = 1
            for yorum_text in yorumlar:
                review_data = {
                    'platform': 'aliexpress',
                    'comment': yorum_text,
                    'timestamp': datetime.now(),
                    'product_url': product_url,
                    'product_name': product_name,
                    'search_term': search_term,  # Arama terimi eklendi
                    'scroll_number': max_scrolls,
                    'review_index': review_index,
                    'price': price,
                    'likes': 0
                }
                
                shared_collection.insert_one(review_data)
                review_index += 1

    except Exception as e:
        print(f"❌ Scraping hatası: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    
    finally:
        try:
            driver.quit()
        except:
            pass

    print(f"✅ {len(yorumlar)} yorum toplandı: {product_name[:50]}...", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": len(yorumlar),
        "product_name": product_name,
        "platform": "aliexpress",
        "price": price
    }

def scrape_aliexpress_by_search_term(search_term, max_products=5, max_scrolls=10):
    """AliExpress'te arama terimi ile çoklu ürün scraping"""
    
    print(f"🚀 AliExpress arama scraping başlatılıyor...", file=sys.stderr)
    print(f"🔍 Arama terimi: {search_term}", file=sys.stderr)
    print(f"📦 Maksimum ürün: {max_products}", file=sys.stderr)
    print(f"🔄 Ürün başına scroll: {max_scrolls}", file=sys.stderr)
    
    # MongoDB bağlantısı
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        print("✅ MongoDB bağlantısı başarılı", file=sys.stderr)
    except Exception as e:
        print(f"❌ MongoDB bağlantı hatası: {e}", file=sys.stderr)
        return {"success": False, "error": f"MongoDB bağlantı hatası: {e}"}

    # Arama terimine göre koleksiyon adı oluştur
    collection_name = create_safe_collection_name(search_term, "aliexpress")
    collection = db[collection_name]
    
    # Koleksiyonu temizle
    collection.delete_many({})
    print(f"🗄️ Koleksiyon hazırlandı: {collection_name}", file=sys.stderr)
    
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

    try:
        # Ürün linklerini al
        product_links = get_product_links_from_search(driver, search_term, max_products)
        
        if not product_links:
            return {"success": False, "error": "Hiç ürün bulunamadı"}
        
        driver.quit()  # Arama driver'ını kapat
        
        # Her ürün için yorumları çek
        total_reviews = 0
        results = []
        
        for i, product_url in enumerate(product_links, 1):
            print(f"\n{'='*50}", file=sys.stderr)
            print(f"🎯 Ürün {i}/{len(product_links)} işleniyor", file=sys.stderr)
            print(f"🔗 URL: {product_url[:80]}...", file=sys.stderr)
            
            result = scrape_aliexpress_product_reviews(
                product_url, 
                max_scrolls, 
                shared_collection=collection,
                shared_db=db,
                search_term=search_term
            )
            
            if result["success"]:
                total_reviews += result["total_reviews"]
                results.append({
                    "success": True,
                    "total_reviews": result["total_reviews"],
                    "collection_name": collection_name,
                    "product_name": result["product_name"],
                    "platform": "aliexpress",
                    "price": result.get("price")
                })
                print(f"✅ Ürün {i} tamamlandı: {result['total_reviews']} yorum", file=sys.stderr)
            else:
                print(f"❌ Ürün {i} hatası: {result.get('error', 'Bilinmeyen hata')}", file=sys.stderr)
                results.append({
                    "success": False,
                    "error": result.get("error", "Bilinmeyen hata"),
                    "collection_name": collection_name,
                    "product_name": product_url,
                    "platform": "aliexpress"
                })
            
            # Ürünler arası kısa bekleme
            if i < len(product_links):
                time.sleep(2)

    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    
    finally:
        try:
            driver.quit()
        except:
            pass

    print(f"\n🎉 AliExpress arama scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam yorum: {total_reviews}", file=sys.stderr)
    print(f"📦 İşlenen ürün: {len(results)}", file=sys.stderr)
    print(f"🗄️ Koleksiyon: {collection_name}", file=sys.stderr)

    return {
        "success": True,
        "total_reviews": total_reviews,
        "products_processed": len(results),
        "platform": "aliexpress",
        "search_term": search_term,
        "collection_name": collection_name,
        "results": results
    }

if __name__ == "__main__":
    # Test için
    if len(sys.argv) > 1:
        search_term = sys.argv[1]
        max_products = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        max_scrolls = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    else:
        search_term = "iphone"
        max_products = 3
        max_scrolls = 8
    
    result = scrape_aliexpress_by_search_term(search_term, max_products, max_scrolls)