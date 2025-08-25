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
from datetime import datetime
import sys
import json
import re
from pymongo import MongoClient

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

def extract_n11_product_rating(driver, product_url):
    """N11 ürün sayfasından ortalama rating skorunu çek"""
    rating = 0.0
    
    try:
        # Yeni sekme aç
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[-1])
        driver.get(product_url)
        time.sleep(2)
        
        # Rating çıkarma denemeleri (öncelik sırasına göre)
        rating_selectors = [
            "span.reviews-summary-average-rating",  # Önerilen selector
            ".ratingScore",
            ".rating-score", 
            ".review-score",
            "span[class*='rating']",
            "div[class*='rating']",
            ".averageRating",
            "span.rating",
            "div.rating"
        ]
        
        for selector in rating_selectors:
            try:
                rating_element = driver.find_element(By.CSS_SELECTOR, selector)
                rating_text = rating_element.text.strip()
                
                # Rating'i sayıya çevir
                if rating_text:
                    # "4,5" veya "4.5" formatını çevir
                    rating_text = rating_text.replace(',', '.')
                    
                    # Sadece sayı kısmını al (ör: "4.5/5" -> "4.5")
                    import re
                    rating_match = re.search(r'(\d+[.,]\d+|\d+)', rating_text)
                    if rating_match:
                        rating_val = float(rating_match.group(1).replace(',', '.'))
                        if 0 <= rating_val <= 5:
                            rating = rating_val
                            print(f"    ⭐ N11 rating bulundu ({selector}): {rating}", file=sys.stderr)
                            break
                            
            except Exception:
                continue
        
        # Sekmeyi kapat ve ana sekmeye dön
        driver.close()
        driver.switch_to.window(driver.window_handles[0])
        
    except Exception as e:
        print(f"    ⚠️ Rating çıkarma hatası: {e}", file=sys.stderr)
        # Hata durumunda doğru sekmeye döndüğümüzden emin ol
        try:
            if len(driver.window_handles) > 1:
                driver.close()
            driver.switch_to.window(driver.window_handles[0])
        except:
            pass
    
    return rating

def scrape_n11_product_reviews(product_url, max_pages=8, search_term=None, reviews_list=None):
    """Tek N11 ürününden yorumları çek"""
    
    # ChromeDriver ayarları
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver_path = "/opt/homebrew/bin/chromedriver"
        driver = webdriver.Chrome(service=Service(driver_path), options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print(f"✅ ChromeDriver başlatıldı: {driver_path}", file=sys.stderr)
    except Exception as e:
        print(f"❌ Manuel path başarısız, otomatik indirme deneniyor: {e}", file=sys.stderr)
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception as e2:
            print(f"❌ ChromeDriver hatası: {e2}", file=sys.stderr)
        return {"success": False, "error": f"ChromeDriver hatası: {e}"}

    yorumlar = []
    
    try:
        # Ürün adını URL'den çıkar
        product_name = extract_product_name_from_url(product_url)
        print(f"📦 Ürün adı: {product_name}", file=sys.stderr)
        
        # Koleksiyon adını belirle
        collection_name = create_safe_collection_name(product_name, "n11")
        print(f"🗄️ Koleksiyon adı: {collection_name}", file=sys.stderr)
        
        # Fiyat bilgisini al
        price = extract_price_from_product_page(driver, product_url)
        
        # Rating bilgisini al
        product_rating = extract_n11_product_rating(driver, product_url)
        
        for page in range(1, max_pages + 1):
            yorum_url = f"{product_url}?pg={page}"
            print(f"📄 Sayfa {page}/{max_pages} işleniyor...", file=sys.stderr)
            
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
                                'rating': product_rating,  # N11 ürün rating skoru
                                'likes_count': 0,  # N11'de beğeni sistemi farklı, şimdilik 0
                                'timestamp': datetime.now(),
                                'product_url': product_url,
                                'product_name': product_name,
                                'page_number': page,
                                'review_index': idx + 1,
                                'price': price,
                                'search_term': search_term  # Arama terimi eklendi
                            }
                            
                            reviews_list.append(review_data)
                                
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
        except:
            pass

    print(f"✅ {product_name} için {len(yorumlar)} yorum çekildi", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": len(yorumlar),
        "collection_name": collection_name,
        "product_name": product_name,
        "platform": "n11",
        "price": price
    }

def find_n11_products(search_term, max_products=5):
    """N11'de ürün arama yap ve ürün URL'lerini döndür"""
    
    # ChromeDriver ayarları
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver_path = "/opt/homebrew/bin/chromedriver"
        driver = webdriver.Chrome(service=Service(driver_path), options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print(f"✅ ChromeDriver başlatıldı: {driver_path}", file=sys.stderr)
    except Exception as e:
        print(f"❌ ChromeDriver hatası: {e}", file=sys.stderr)
        return []

    product_urls = []
    
    try:
        # N11 arama URL'si
        search_url = f"https://www.n11.com/arama?q={search_term.replace(' ', '+')}"
        print(f"🔍 N11 arama URL'si: {search_url}", file=sys.stderr)
        
        driver.get(search_url)
        time.sleep(3)

        # Ürün linklerini bul
        product_selectors = [
            "a[href*='/urun/']",
            ".productList .column a",
            ".productListContent a[href*='/urun/']"
        ]
        
        all_product_links = []
        
        for selector in product_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for elem in elements:
                    href = elem.get_attribute('href')
                    if href and '/urun/' in href and href not in all_product_links:
                        all_product_links.append(href)
            except Exception as e:
                print(f"    ⚠️ Selector {selector} hatası: {e}", file=sys.stderr)
                continue
        
        print(f"🔍 Toplam {len(all_product_links)} ürün bulundu", file=sys.stderr)
        
        # İlk max_products kadar ürünü al
        product_urls = all_product_links[:max_products]
        
        for i, url in enumerate(product_urls, 1):
            product_name = extract_product_name_from_url(url)
            print(f"    📦 Ürün {i}: {product_name}", file=sys.stderr)

    except Exception as e:
        print(f"❌ N11 arama hatası: {e}", file=sys.stderr)
        return []
    
    finally:
        try:
            driver.quit()
        except:
            pass

    return product_urls

def scrape_n11_by_product_name(product_name, max_products=5, pages_per_product=8):
    """N11'de ürün adına göre arama yap ve yorumları tek koleksiyonda topla"""
    
    print(f"🚀 N11 ürün arama scraping başlatılıyor...", file=sys.stderr)
    print(f"🔍 Arama terimi: {product_name}", file=sys.stderr)
    print(f"📦 Maksimum ürün: {max_products}", file=sys.stderr)
    print(f"📄 Ürün başına sayfa: {pages_per_product}", file=sys.stderr)
    
    # Arama terimine göre tek koleksiyon oluştur
    search_collection_name = create_safe_collection_name(product_name, "n11")
    print(f"🗄️ Arama koleksiyonu: {search_collection_name}", file=sys.stderr)
    
    # Yorumları saklamak için liste
    all_reviews = []

    # Ürünleri ara
    print(f"\n🔍 N11'de '{product_name}' aranıyor...", file=sys.stderr)
    product_urls = find_n11_products(product_name, max_products)
    
    if not product_urls:
        return {"success": False, "error": "Ürün bulunamadı"}
    
    print(f"✅ {len(product_urls)} ürün bulundu, yorumlar tek koleksiyonda toplanıyor...", file=sys.stderr)
    
    # Her ürün için yorumları çek ve aynı koleksiyona kaydet
    all_results = []
    total_reviews = 0
    
    for i, product_url in enumerate(product_urls, 1):
        print(f"\n📦 Ürün {i}/{len(product_urls)} işleniyor...", file=sys.stderr)
        
        # Paylaşılan koleksiyon ve DB'yi geç
        result = scrape_n11_product_reviews(
            product_url, 
            pages_per_product,
            search_term=product_name,  # Arama terimi
            reviews_list=all_reviews  # Ortak liste
        )
        
        if result["success"]:
            all_results.append(result)
            total_reviews += result["total_reviews"]
            print(f"    ✅ {result['product_name']}: {result['total_reviews']} yorum → {search_collection_name}", file=sys.stderr)
        else:
            print(f"    ❌ Ürün {i} hatası: {result.get('error', 'Bilinmeyen hata')}", file=sys.stderr)
        
        # Ürünler arası kısa bekleme
        if i < len(product_urls):
            time.sleep(2)
    
    print(f"\n✅ N11 scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam yorum: {total_reviews}", file=sys.stderr)
    print(f"📦 İşlenen ürün: {len(all_results)}", file=sys.stderr)
    print(f"🗄️ Tüm yorumlar tek koleksiyonda: {search_collection_name}", file=sys.stderr)
    
    # MongoDB'ye kaydet
    try:
        print(f"💾 MongoDB'ye kaydediliyor...", file=sys.stderr)
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        
        # Güvenli koleksiyon adı oluştur
        safe_search_term = re.sub(r'[^a-zA-Z0-9]', '_', product_name.lower())
        collection_name = f"n11_reviews_{safe_search_term}"
        coll = db[collection_name]
        
        if all_reviews:
            # Basit ID üret
            for idx, review in enumerate(all_reviews):
                if 'id' not in review:
                    review['id'] = f"n11_{idx}_{int(time.time())}"
                    
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
        "products_processed": len(all_results),
        "platform": "n11",
        "search_term": product_name,
        "collection_name": search_collection_name,
        "results": all_results,
        "all_reviews": all_reviews
    }

if __name__ == "__main__":
    # Test için örnek kullanım
    if len(sys.argv) > 1:
        search_term = sys.argv[1]
        max_products = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        pages_per_product = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    else:
        search_term = "samsung telefon"
        max_products = 3
        pages_per_product = 8
    
    result = scrape_n11_by_product_name(search_term, max_products, pages_per_product)
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str)) 