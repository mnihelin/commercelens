#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import time
import re
import pandas as pd
from datetime import datetime
from pymongo import MongoClient
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

def create_safe_collection_name(product_name, platform):
    """Güvenli koleksiyon adı oluştur"""
    # Türkçe karakterleri değiştir
    turkish_chars = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'C', 'Ğ': 'G', 'I': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    }
    
    for turkish, english in turkish_chars.items():
        product_name = product_name.replace(turkish, english)
    
    # Özel karakterleri temizle ve MongoDB koleksiyon adı kurallarına uygun hale getir
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', product_name.lower())
    safe_name = re.sub(r'_+', '_', safe_name)  # Birden fazla _ karakterini tek _ yap
    safe_name = safe_name.strip('_')  # Başında ve sonunda _ varsa kaldır
    
    # Uzunluk sınırı (MongoDB koleksiyon adı 120 karakter max)
    if len(safe_name) > 60:
        safe_name = safe_name[:60]
    
    return f"{platform.lower()}_reviews_{safe_name}"

def convert_to_real_amazon_url(driver, raw_link):
    """Sponsored linklerden gerçek Amazon product URL'sine çevir"""
    try:
        # Eğer zaten düz dp/ linki ise, olduğu gibi döndür
        if '/dp/' in raw_link and 'sspa/click' not in raw_link:
            return raw_link
        
        # Sponsored linki ise gerçek URL'yi çıkar
        if 'sspa/click' in raw_link:
            # URL'den ASIN kodunu bul
            asin_match = re.search(r'%2Fdp%2F([A-Z0-9]{10})', raw_link)
            if asin_match:
                asin = asin_match.group(1)
                return f"https://www.amazon.com.tr/dp/{asin}"
        
        # Backup: Linke git ve gerçek URL'yi al
        current_url = driver.current_url
        driver.get(raw_link)
        time.sleep(1)
        
        real_url = driver.current_url
        if '/dp/' in real_url:
            driver.get(current_url)  # Geri dön
            return real_url
        
        driver.get(current_url)  # Geri dön
        return raw_link
        
    except Exception as e:
        print(f"  ⚠️ URL dönüştürme hatası: {e}", file=sys.stderr)
        return raw_link

def amazon_login(driver, email="ay3738176@gmail.com", password="theclico2134"):
    """Amazon'a giriş yap"""
    try:
        print("🔐 Amazon'a giriş yapılıyor...", file=sys.stderr)
        
        login_url = ("https://www.amazon.com.tr/ap/signin?openid.pape.max_auth_age=900&"
                    "openid.return_to=https%3A%2F%2Fwww.amazon.com.tr%2Fgp%2Fyourstore%2Fhome"
                    "%3Fpath%3D%252Fgp%252Fyourstore%252Fhome%26signIn%3D1%26useRedirectOnSuccess"
                    "%3D1%26action%3Dsign-out%26ref_%3Dnav_AccountFlyout_gno_signout&"
                    "openid.assoc_handle=trflex&openid.mode=checkid_setup&"
                    "openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0")
        
        driver.get(login_url)
        
        # E-mail girişi
        email_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "ap_email"))
        )
        email_field.clear()
        email_field.send_keys(email)
        driver.find_element(By.ID, "continue").click()
        
        # Şifre girişi
        password_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "ap_password"))
        )
        password_field.clear()
        password_field.send_keys(password)
        driver.find_element(By.ID, "signInSubmit").click()
        
        # Giriş başarılı mı kontrol et
        time.sleep(1)
        
        # Yeni pencere açıldıysa geç
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[-1])
        
        print("✅ Amazon girişi başarılı", file=sys.stderr)
        return True
        
    except Exception as e:
        print(f"⚠️ Amazon giriş hatası: {e}", file=sys.stderr)
        return False

def search_products_on_amazon(driver, search_term, max_products=5):
    """Amazon'da ürün arama ve sonuçları çek"""
    try:
        # Ana sayfaya git
        driver.get("https://www.amazon.com.tr")
        time.sleep(1)
        
        # Arama kutusunu bul ve arama yap
        search_box = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "twotabsearchtextbox"))
        )
        search_box.clear()
        search_box.send_keys(search_term)
        search_box.send_keys(Keys.RETURN)
        
        time.sleep(1)
        print(f"🔍 '{search_term}' aranıyor...", file=sys.stderr)
        
        # Ürün sonuçlarını bul
        product_links = []
        product_names = []
        product_prices = []
        
        # Farklı ürün selector'ları dene
        product_selectors = [
            "[data-component-type='s-search-result']",
            ".s-result-item",
            ".s-card-container"
        ]
        
        products_found = []
        for selector in product_selectors:
            try:
                products = driver.find_elements(By.CSS_SELECTOR, selector)
                if products:
                    products_found = products
                    break
            except:
                continue
        
        if not products_found:
            print("❌ Ürün bulunamadı", file=sys.stderr)
            return []
        
        print(f"📦 {len(products_found)} ürün bulundu", file=sys.stderr)
        
        # İlk max_products kadar ürünü işle
        for i, product in enumerate(products_found[:max_products]):
            try:
                # Ürün linkini bul
                link_element = product.find_element(By.CSS_SELECTOR, "h2 a, .a-link-normal")
                raw_link = link_element.get_attribute("href")
                
                # Gerçek Amazon product URL'sine çevir
                product_link = convert_to_real_amazon_url(driver, raw_link)
                
                # Ürün adını bul
                try:
                    name_element = product.find_element(By.CSS_SELECTOR, "h2 span, .a-size-base-plus")
                    product_name = name_element.text.strip()
                except:
                    product_name = f"Amazon Ürün {i+1}"
                
                # Fiyatı bul
                price = None
                price_selectors = [
                    ".a-price-whole",
                    ".a-price .a-offscreen",
                    ".a-color-price"
                ]
                
                for price_selector in price_selectors:
                    try:
                        price_element = product.find_element(By.CSS_SELECTOR, price_selector)
                        price_text = price_element.text.strip()
                        price_match = re.search(r'[\d.,]+', price_text.replace('.', '').replace(',', '.'))
                        if price_match:
                            price = float(price_match.group(0))
                            break
                    except:
                        continue
                
                if product_link and product_name:
                    product_links.append(product_link)
                    product_names.append(product_name)
                    product_prices.append(price)
                    print(f"  📱 Ürün {i+1}: {product_name[:50]}... ({price} TL)" if price else f"  📱 Ürün {i+1}: {product_name[:50]}...", file=sys.stderr)
                
            except Exception as e:
                print(f"  ⚠️ Ürün {i+1} işleme hatası: {e}", file=sys.stderr)
                continue
        
        print(f"✅ {len(product_links)} ürün başarıyla çıkarıldı", file=sys.stderr)
        return list(zip(product_links, product_names, product_prices))
        
    except Exception as e:
        print(f"❌ Arama hatası: {e}", file=sys.stderr)
        return []

def extract_amazon_product_rating(driver, product_url):
    """Amazon ürün sayfasından ortalama rating skorunu çek"""
    rating = 0.0
    
    try:
        # Ana ürün sayfasına git
        driver.get(product_url)
        time.sleep(2)
        
        # Rating çıkarma denemeleri (öncelik sırasına göre)
        rating_selectors = [
            "a[role='button'][class*='popover'] span.a-size-small",  # Verdiğiniz yapı
            ".a-popover-trigger span.a-size-small",  # Popover içindeki rating
            "span[data-hook='rating-out-of-text']",  # Amazon rating text
            ".cr-widget-rating .a-link-normal",  # Customer review rating
            "span.a-icon-alt",  # Icon alt text'inde rating
            "[data-asin] .a-offscreen",  # Offscreen rating
            ".a-size-base.a-color-base",  # Rating number
            "span.a-size-medium.a-color-base"  # Medium size rating
        ]
        
        for selector in rating_selectors:
            try:
                rating_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for rating_element in rating_elements:
                    rating_text = rating_element.text.strip()
                    
                    # Rating'i sayıya çevir
                    if rating_text:
                        # "4,7" veya "4.7" formatını çevir
                        rating_text = rating_text.replace(',', '.')
                        
                        # Sadece sayı kısmını al (ör: "4.7 yıldız" -> "4.7")
                        import re
                        rating_match = re.search(r'(\d+[.,]\d+|\d+)', rating_text)
                        if rating_match:
                            rating_val = float(rating_match.group(1).replace(',', '.'))
                            if 0 <= rating_val <= 5:
                                rating = rating_val
                                print(f"    ⭐ Amazon rating bulundu ({selector}): {rating}", file=sys.stderr)
                                return rating
                                
                    # Alternatif: aria-label'dan rating çek
                    aria_label = rating_element.get_attribute("aria-label") or ""
                    if aria_label:
                        rating_match = re.search(r'(\d+[.,]\d+|\d+)', aria_label)
                        if rating_match:
                            rating_val = float(rating_match.group(1).replace(',', '.'))
                            if 0 <= rating_val <= 5:
                                rating = rating_val
                                print(f"    ⭐ Amazon rating (aria-label): {rating}", file=sys.stderr)
                                return rating
                            
            except Exception:
                continue
        
        # Son deneme: Sayfa kaynağında rating ara
        if rating == 0:
            try:
                page_source = driver.page_source
                # "4,7 üzerinden 5" benzeri kalıplar ara
                rating_patterns = [
                    r'(\d+[.,]\d+)\s*üzerinden\s*5',
                    r'(\d+[.,]\d+)\s*yıldız',
                    r'(\d+[.,]\d+)\s*star',
                    r'"ratingValue"\s*:\s*"?(\d+[.,]\d+)"?',
                    r'rating.*?(\d+[.,]\d+)'
                ]
                
                for pattern in rating_patterns:
                    matches = re.findall(pattern, page_source, re.IGNORECASE)
                    if matches:
                        rating_val = float(matches[0].replace(',', '.'))
                        if 0 <= rating_val <= 5:
                            rating = rating_val
                            print(f"    ⭐ Amazon rating (page source): {rating}", file=sys.stderr)
                            break
                            
            except Exception:
                pass
        
    except Exception as e:
        print(f"    ⚠️ Amazon rating çıkarma hatası: {e}", file=sys.stderr)
    
    return rating

def scrape_product_reviews(driver, product_url, product_name, price, max_pages=3):
    """Tek üründen yorumları çek"""
    try:
        # ASIN kodunu çıkar
        asin_match = re.search(r'/dp/([A-Z0-9]{10})', product_url)
        if not asin_match:
            print(f"  ❌ ASIN bulunamadı: {product_url}", file=sys.stderr)
            return []
        
        asin = asin_match.group(1)
        print(f"  🔖 ASIN: {asin}", file=sys.stderr)
        
        # Yorum sayfasına git
        review_url = f"https://www.amazon.com.tr/product-reviews/{asin}/?ie=UTF8&reviewerType=all_reviews&pageNumber=1"
        driver.get(review_url)
        time.sleep(1)
        
        reviews = []
        page = 1
        
        while page <= max_pages:
            try:
                # Yorumları bekle
                review_elements = WebDriverWait(driver, 10).until(
                    EC.presence_of_all_elements_located(
                        (By.CSS_SELECTOR, 'span[data-hook="review-body"] span')
                    )
                )
                
                page_reviews = 0
                for idx, review_element in enumerate(review_elements):
                    try:
                        review_text = review_element.text.strip()
                        if review_text and len(review_text) > 10:
                            # Tekrar kontrolü için sadece text kısmını kontrol et
                            existing_texts = [r['comment'] if isinstance(r, dict) else r for r in reviews]
                            if review_text not in existing_texts:
                                # MongoDB için format oluştur
                                review_data = {
                                    'platform': 'amazon',
                                    'comment': review_text,
                                    'comment_date': None,  # Amazon'da yorum tarihi zor çekilir
                                    'rating': 0,  # Amazon'da individual rating zor çekilir
                                    'likes_count': 0,
                                    'timestamp': datetime.now(),
                                    'product_url': product_url,
                                    'product_name': product_name,
                                    'page_number': page,
                                    'review_index': len(reviews) + 1,
                                    'price': price,
                                    'search_term': None  # Ana fonksiyonda eklenecek
                                }
                                
                                reviews.append(review_data)
                                page_reviews += 1
                    except:
                        continue
                
                print(f"    📄 Sayfa {page}: {page_reviews} yorum", file=sys.stderr)
                
                # Sonraki sayfa var mı kontrol et
                if page < max_pages:
                    try:
                        next_button = driver.find_element(By.CSS_SELECTOR, "li.a-last:not(.a-disabled) a")
                        if next_button:
                            driver.execute_script("arguments[0].click();", next_button)
                            time.sleep(1)
                            page += 1
                        else:
                            break
                    except:
                        break
                else:
                    break
                    
            except Exception as page_error:
                print(f"    ⚠️ Sayfa {page} hatası: {page_error}", file=sys.stderr)
                break
        
        print(f"  ✅ Toplam {len(reviews)} yorum çekildi", file=sys.stderr)
        return reviews
        
    except Exception as e:
        print(f"  ❌ Yorum çekme hatası: {e}", file=sys.stderr)
        return []

def amazon_search_scrape(search_term, max_products=5, max_pages_per_product=3):
    """Amazon arama yapıp çoklu ürün yorumları çek"""
    
    print(f"🚀 Amazon arama scraping başlatılıyor...", file=sys.stderr)
    print(f"🔍 Arama terimi: {search_term}", file=sys.stderr)
    print(f"📦 Maksimum ürün: {max_products}", file=sys.stderr)
    print(f"📄 Ürün başına maksimum sayfa: {max_pages_per_product}", file=sys.stderr)
    
    # Chrome ayarları
    options = Options()
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    try:
        # Önce manuel path dene, sonra otomatik
        try:
            driver_path = "/opt/homebrew/bin/chromedriver"
            driver = webdriver.Chrome(service=Service(driver_path), options=options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            print(f"✅ ChromeDriver başlatıldı: {driver_path}", file=sys.stderr)
        except Exception as e:
            print(f"❌ Manuel path başarısız, otomatik indirme deneniyor: {e}", file=sys.stderr)
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            print("✅ ChromeDriver otomatik başlatıldı", file=sys.stderr)
    except Exception as e:
        print(f"❌ ChromeDriver hatası: {e}", file=sys.stderr)
        return {"success": False, "error": f"ChromeDriver hatası: {e}"}

    results = []
    total_reviews = 0
    
    try:
        # Amazon'a giriş yap
        login_success = amazon_login(driver)
        if not login_success:
            print("⚠️ Giriş başarısız, giriş yapmadan devam ediliyor", file=sys.stderr)
        
        # Ürün arama
        products = search_products_on_amazon(driver, search_term, max_products)
        
        if not products:
            return {"success": False, "error": "Ürün bulunamadı"}
        
        # Her ürün için yorumları çek
        for i, (product_url, product_name, price) in enumerate(products):
            print(f"\n📱 Ürün {i+1}/{len(products)}: {product_name[:50]}...", file=sys.stderr)
            
            # Koleksiyon adını oluştur
            collection_name = create_safe_collection_name(product_name, "amazon")
            
            # Ürün rating'ini çek
            product_rating = extract_amazon_product_rating(driver, product_url)
            
            # Yorumları çek
            reviews = scrape_product_reviews(driver, product_url, product_name, price, max_pages_per_product)
            
            # Search term ve rating'i her yoruma ekle
            for review in reviews:
                if isinstance(review, dict):
                    review['search_term'] = search_term
                    review['rating'] = product_rating  # Ürün rating'ini yorumlara ekle
            
            # Sonuçları topla (URL'yi güvenli hale getir)
            safe_product_url = product_url.split('?')[0] if '?' in product_url else product_url
            # Ürün adını da güvenli hale getir
            safe_product_name = product_name.replace('"', '').replace('\n', ' ').replace('\r', '').strip()
            if len(safe_product_name) > 100:
                safe_product_name = safe_product_name[:100] + "..."
                
            product_result = {
                "success": True,
                "total_reviews": len(reviews),
                "collection_name": collection_name,
                "product_name": safe_product_name,
                "platform": "amazon",
                "price": price,
                "product_url": safe_product_url,
                "reviews": reviews  # Yorumları da ekle
            }
            
            results.append(product_result)
            total_reviews += len(reviews)
            
            print(f"  ✅ {len(reviews)} yorum çekildi", file=sys.stderr)

    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    
    finally:
        try:
            driver.quit()
            print("🔒 Driver kapatıldı", file=sys.stderr)
        except:
            pass

    print(f"\n✅ Amazon arama scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam ürün: {len(results)}", file=sys.stderr)
    print(f"💬 Toplam yorum: {total_reviews}", file=sys.stderr)
    
    # Tüm yorumları tek listede topla ve MongoDB'ye kaydet
    all_reviews = []
    for result in results:
        if "reviews" in result:
            all_reviews.extend(result["reviews"])
    
    # MongoDB'ye kaydet
    try:
        print(f"💾 MongoDB'ye kaydediliyor...", file=sys.stderr)
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        
        # Güvenli koleksiyon adı oluştur
        safe_search_term = re.sub(r'[^a-zA-Z0-9]', '_', search_term.lower())
        collection_name = f"amazon_reviews_{safe_search_term}"
        coll = db[collection_name]
        
        if all_reviews:
            # Basit ID üret
            for idx, review in enumerate(all_reviews):
                if 'id' not in review:
                    review['id'] = f"amazon_{idx}_{int(time.time())}"
                    
            coll.insert_many(all_reviews, ordered=False)
            print(f"    ✅ {len(all_reviews)} yorum MongoDB'ye kaydedildi", file=sys.stderr)
        else:
            print(f"    ⚠️ Kaydedilecek yorum yok", file=sys.stderr)
            
        client.close()
    except Exception as e:
        print(f"    ❌ MongoDB kaydetme hatası: {e}", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": total_reviews,
        "products_processed": len(results),
        "platform": "amazon",
        "search_term": search_term,
        "results": results,
        "all_reviews": all_reviews
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search_term = sys.argv[1]
        max_products = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    else:
        search_term = "iphone 16"
        max_products = 5
        max_pages = 3
    
    result = amazon_search_scrape(search_term, max_products, max_pages)
    
    # JSON çıktısından önce tüm string değerlerini temizle
    def clean_json_strings(obj):
        if isinstance(obj, dict):
            return {k: clean_json_strings(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_json_strings(item) for item in obj]
        elif isinstance(obj, str):
            # Problemli karakterleri temizle
            cleaned = obj.replace('"', '').replace('\n', ' ').replace('\r', '').replace('\t', ' ')
            return cleaned.strip()
        else:
            return obj
    
    cleaned_result = clean_json_strings(result)
    print(json.dumps(cleaned_result, ensure_ascii=False, indent=2, default=str)) 