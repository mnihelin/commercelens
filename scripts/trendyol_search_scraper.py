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

def extract_likes_from_review(element):
    """Trendyol yorum elementinden rating puanını çıkar (beğeni yerine)"""
    rating_score = 0
    try:
        # Debug: Yorum elementinin tüm HTML'ini yazdır (ilk 3 yorum için)
        global debug_counter
        if 'debug_counter' not in globals():
            debug_counter = 0
        
        if debug_counter < 3:  # Sadece ilk 3 yorum için debug
            debug_counter += 1
            print(f"\n🐛 DEBUG Yorum {debug_counter}:", file=sys.stderr)
            try:
                print(f"    HTML: {element.get_attribute('innerHTML')[:200]}...", file=sys.stderr)
            except:
                pass
        
        # YÖNTEM 1: Rating puanı - ps-ratings__count-text
        try:
            rating_elements = element.find_elements(By.CSS_SELECTOR, ".ps-ratings__count-text")
            for rating_elem in rating_elements:
                text = rating_elem.text.strip()
                print(f"    🔍 Rating element text: '{text}'", file=sys.stderr)
                # Rating puanını float olarak al (4.1, 3.5 vs.)
                rating_match = re.search(r'(\d+\.?\d*)', text)
                if rating_match:
                    rating_score = float(rating_match.group(1))  # 4.1 olarak tut (decimal format)
                    print(f"    🎯 Rating puanı bulundu: {rating_score} (orijinal: {rating_match.group(1)})", file=sys.stderr)
                    break
        except Exception as e:
            print(f"    ⚠️ ps-ratings__count-text selector hatası: {e}", file=sys.stderr)
        
        # YÖNTEM 2: Alternatif rating selector'ları
        if rating_score == 0:
            rating_selectors = [
                ".rating-score",
                ".star-rating",
                ".review-rating", 
                ".ps-rating",
                "[data-testid*='rating']",
                ".rating-value",
                ".score"
            ]
            
            for selector in rating_selectors:
                try:
                    rating_elements = element.find_elements(By.CSS_SELECTOR, selector)
                    for rating_elem in rating_elements:
                        text = rating_elem.text.strip()
                        rating_match = re.search(r'(\d+\.?\d*)', text)
                        if rating_match:
                            rating_score = float(rating_match.group(1))
                            print(f"    🎯 Rating ({selector}) bulundu: {rating_score}", file=sys.stderr)
                            break
                    if rating_score > 0:
                        break
                except:
                    continue
        
        # YÖNTEM 3: Yıldız sayısına bakarak rating hesapla
        if rating_score == 0:
            try:
                # Dolu yıldızları say
                filled_stars = len(element.find_elements(By.CSS_SELECTOR, ".filled-star, .star-filled, .fa-star"))
                if filled_stars > 0:
                    rating_score = filled_stars  # 5 yıldız = 5.0 puan
                    print(f"    🎯 Yıldız sayısı bulundu: {rating_score} ({filled_stars} yıldız)", file=sys.stderr)
            except:
                pass
        
        # YÖNTEM 4: Genel metin taraması
        if rating_score == 0:
            full_text = element.text
            # Rating pattern'lerini ara
            rating_patterns = [
                r'(\d+\.?\d*)\s*\/\s*5',  # "4.5/5" formatı
                r'(\d+\.?\d*)\s*yıldız',   # "4.1 yıldız" formatı  
                r'Puan:\s*(\d+\.?\d*)',    # "Puan: 4.5" formatı
                r'(\d+\.?\d*)\s*puan'      # "4.2 puan" formatı
            ]
            
            for pattern in rating_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    rating_score = float(match.group(1))
                    print(f"    🎯 Text pattern bulundu: {rating_score} - Pattern: {pattern}", file=sys.stderr)
                    break
        
        # YÖNTEM 5: Sayısal değerleri tara (rating aralığında)
        if rating_score == 0:
            all_numbers = re.findall(r'\b(\d+\.?\d*)\b', element.text)
            if all_numbers and debug_counter <= 3:
                print(f"    🔍 Bulunan tüm sayılar: {all_numbers}", file=sys.stderr)
                # Rating aralığında olanları seç (1.0-5.0 arası)
                for num_str in all_numbers:
                    try:
                        num = float(num_str)
                        if 1.0 <= num <= 5.0:  # Makul rating aralığı
                            rating_score = num
                            print(f"    🎯 Rating tahmin: {rating_score} (orijinal: {num})", file=sys.stderr)
                            break
                    except:
                        continue
                        
    except Exception as e:
        print(f"    ⚠️ Rating çıkarma hatası: {e}", file=sys.stderr)
        rating_score = 0
    
    # Rating puanını float olarak döndür (4.1, 5.0 formatında)
    return float(rating_score)

def extract_price_from_product_page(driver, product_url):
    """Trendyol ürün sayfasından fiyat bilgisini çıkar"""
    price = None
    try:
        # Yorumlar sayfasından ana ürün sayfasına git
        main_product_url = product_url.replace('/yorumlar', '').split('?')[0]
        
        # Yeni sekmede açarak mevcut scraping'i bozmayalım
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[1])
        
        driver.get(main_product_url)
        time.sleep(2)
        
        # Trendyol fiyat selectors - YENİ SELECTOR'LAR EKLENDİ
        price_selectors = [
            ".pr-bx-nm.with-org-prc",  # 🆕 YENİ: Kullanıcının verdiği CSS selector
            ".prc-dsc",
            ".prc-org", 
            ".price-current",
            ".price",
            ".product-price",
            "[data-testid='price-current-price']",
            ".discounted-price",
            ".selling-price",
            ".pr-bx-nm",  # 🆕 YENİ: Ek varyasyon
            ".with-org-prc"  # 🆕 YENİ: Ek varyasyon
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

def extract_product_rating_from_page(driver, product_url):
    """Trendyol ürün sayfasından ana rating puanını çıkar"""
    rating_score = 0
    try:
        # Yorumlar sayfasından ana ürün sayfasına git
        main_product_url = product_url.replace('/yorumlar', '').split('?')[0]
        
        # Yeni sekmede açarak mevcut scraping'i bozmayalım
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[1])
        
        driver.get(main_product_url)
        time.sleep(3)  # Daha fazla bekleme
        
        print(f"    🔍 Debug: {main_product_url}", file=sys.stderr)
        
        # DETAYLI DEBUG: Sayfadaki tüm rating benzeri elementleri bul
        try:
            all_elements = driver.find_elements(By.CSS_SELECTOR, "*")
            rating_keywords = ['rating', 'rate', 'score', 'puan', 'yıldız', 'star']
            
            print(f"    🐛 Sayfada rating arama yapılıyor...", file=sys.stderr)
            potential_ratings = []
            
            for elem in all_elements[:100]:  # İlk 100 element
                try:
                    class_name = elem.get_attribute('class') or ''
                    text_content = elem.text.strip()
                    
                    # Rating benzeri class veya text kontrol et
                    if any(keyword in class_name.lower() for keyword in rating_keywords):
                        potential_ratings.append(f"Class: {class_name}, Text: {text_content[:50]}")
                    
                    # 4.x pattern'i ara
                    if re.search(r'\b[1-5]\.[0-9]\b', text_content):
                        potential_ratings.append(f"Rating Pattern: {text_content[:50]} - Class: {class_name}")
                        
                except:
                    continue
            
            # Sonuçları yazdır
            for i, rating_info in enumerate(potential_ratings[:10]):  # İlk 10 sonuç
                print(f"    🎯 Rating {i+1}: {rating_info}", file=sys.stderr)
                
        except Exception as debug_error:
            print(f"    ⚠️ Debug hatası: {debug_error}", file=sys.stderr)
        
        # GENİŞLETİLMİŞ Trendyol rating selectors
        rating_selectors = [
            ".ps-ratings__count-text",  # 🎯 İSTENEN: 4.1 gibi değerler
            ".rating-score",
            ".product-rating", 
            ".rate-point",
            ".rating-value",
            "[data-testid='rating-score']",
            ".rating",
            ".score",
            ".star-rating",
            ".review-score",
            ".product-score",
            ".rating-text",
            ".rate-value",
            ".puan",
            "[class*='rating']",
            "[class*='score']",
            "[class*='puan']",
            "[class*='rate']"
        ]
        
        for selector in rating_selectors:
            try:
                rating_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                print(f"    🔍 {selector} için {len(rating_elements)} element bulundu", file=sys.stderr)
                
                for elem in rating_elements:
                    text = elem.text.strip()
                    print(f"    📝 Element text: '{text}'", file=sys.stderr)
                    
                    # Rating pattern'ini ara (1.0-5.0 arası değerler)
                    rating_match = re.search(r'^(\d+\.?\d*)$', text)
                    if rating_match:
                        try:
                            rating_value = float(rating_match.group(1))
                            if 1.0 <= rating_value <= 5.0:  # Geçerli rating aralığı
                                rating_score = rating_value  # 4.1 olarak tut
                                print(f"    ⭐ Rating bulundu ({selector}): {rating_value} → {rating_score}", file=sys.stderr)
                                break
                        except ValueError:
                            continue
                            
                    # Alternatif format: "4,2" (virgüllü)
                    rating_match2 = re.search(r'^(\d+),(\d+)$', text)
                    if rating_match2:
                        try:
                            rating_value = float(f"{rating_match2.group(1)}.{rating_match2.group(2)}")
                            if 1.0 <= rating_value <= 5.0:
                                rating_score = rating_value
                                print(f"    ⭐ Rating bulundu (virgüllü) ({selector}): {rating_value} → {rating_score}", file=sys.stderr)
                                break
                        except ValueError:
                            continue
                            
                if rating_score > 0:
                    break
            except Exception as e:
                print(f"    ⚠️ {selector} hatası: {e}", file=sys.stderr)
                continue
        
        # Eğer hiçbir selector çalışmadıysa, sayfanın HTML'ini kısaca incele
        if rating_score == 0:
            try:
                page_html = driver.page_source[:2000]  # İlk 2000 karakter
                rating_matches = re.findall(r'\b[1-5]\.[0-9]\b', page_html)
                if rating_matches:
                    print(f"    🔎 HTML'de bulunan rating pattern'leri: {rating_matches[:5]}", file=sys.stderr)
                    # İlk bulduğunu kullan
                    try:
                        rating_value = float(rating_matches[0])
                        rating_score = rating_value
                        print(f"    ⭐ HTML'den rating alındı: {rating_value} → {rating_score}", file=sys.stderr)
                    except:
                        pass
            except Exception as html_error:
                print(f"    ⚠️ HTML inceleme hatası: {html_error}", file=sys.stderr)
        
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
    
    return rating_score

def scrape_trendyol_by_product_name(product_name, max_products=5):
    # MongoDB bağlantısı
    client = MongoClient('mongodb://localhost:27017/')
    db = client['ecommerce_analytics']
    
    # Search terimi bazında koleksiyon oluştur
    search_collection_name = create_safe_collection_name(product_name, "Trendyol")
    search_collection = db[search_collection_name]
    
    # Genel koleksiyonlar da korunsun
    trendyol_collection = db['trendyol_reviews']
    all_reviews_collection = db['all_reviews']
    
    print(f"📦 Search koleksiyonu: {search_collection_name}", file=sys.stderr)
    
    # Tarayıcı ayarları
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # WebDriver başlat (güncellenmiş ChromeDriver path)
    try:
        driver_path = "/opt/homebrew/bin/chromedriver"
        driver = webdriver.Chrome(service=Service(driver_path), options=options)
        print(f"✅ ChromeDriver başlatıldı: {driver_path}", file=sys.stderr)
    except Exception as e:
        print(f"❌ Manuel path başarısız, otomatik indirme deneniyor: {e}", file=sys.stderr)
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        except Exception as e2:
            print(f"❌ Otomatik indirme de başarısız: {e2}", file=sys.stderr)
            raise Exception("ChromeDriver başlatılamadı")
    
    tum_yorumlar = []
    bulunan_urunler = []
    
    try:
        # Arama sayfasına git
        search_url = f"https://www.trendyol.com/sr?q={product_name.replace(' ', '+')}"
        print(f"🔍 Arama yapılıyor: {search_url}", file=sys.stderr)
        driver.get(search_url)
        time.sleep(3)
        
        # İlk 5 ürünün yorum sayfası URL'lerini al
        yorum_sayfalari = []
        
        try:
            urunler = driver.find_elements(By.CSS_SELECTOR, "div.p-card-wrppr a")[:max_products]
            print(f"📦 {len(urunler)} ürün bulundu", file=sys.stderr)
            
            for i, urun in enumerate(urunler):
                href = urun.get_attribute("href")
                if href:
                    temiz_href = href.split("?")[0]  # URL'den parametreleri temizle
                    yorum_url = temiz_href + "/yorumlar"
                    yorum_sayfalari.append(yorum_url)
                    
                    # Ürün adını URL'den çıkar
                    urun_adi = extract_product_name_from_url(temiz_href)
                    bulunan_urunler.append(urun_adi)
                    print(f"✅ Ürün {i+1}: {urun_adi}", file=sys.stderr)
                    
        except Exception as e:
            print(f"❌ Ürün linkleri alınamadı: {e}", file=sys.stderr)
            return {"success": False, "error": f"Ürün linkleri alınamadı: {str(e)}"}
        
        if not yorum_sayfalari:
            return {"success": False, "error": "Hiç ürün bulunamadı"}
        
        # Her ürünün yorumlarını çek
        for i, url in enumerate(yorum_sayfalari):
            product_name_from_url = bulunan_urunler[i] if i < len(bulunan_urunler) else f"Ürün {i+1}"
            print(f"\n📦 Ürün {i+1}/{len(yorum_sayfalari)} yorum sayfası açılıyor: {product_name_from_url}", file=sys.stderr)
            
            # Ürün fiyatını ve rating'ini al (sadece ilk sayfada bir kez)
            product_price = extract_price_from_product_page(driver, url)
            product_rating = extract_product_rating_from_page(driver, url)
            
            try:
                driver.get(url)
                time.sleep(3)
                
                # Scroll ile yorumların yüklenmesini sağla (40 scroll)
                for scroll in range(40):
                    driver.execute_script("window.scrollBy(0, 500);")
                    time.sleep(0.5)
                    if scroll % 10 == 0:
                        print(f"📜 Scroll {scroll}/40", file=sys.stderr)
                
                # Yorumları çek (class 'comment' kullanılıyor)
                yorum_divleri = driver.find_elements(By.CLASS_NAME, "comment")
                print(f"🔍 {len(yorum_divleri)} yorum bulundu", file=sys.stderr)
                
                urun_yorum_sayisi = 0
                for yorum_div in yorum_divleri:
                    try:
                        yorum_metni = yorum_div.text.strip()
                        if not yorum_metni or len(yorum_metni) <= 10:
                            continue
                            
                        # Yorum tarihini al (comment-info-item class'ından)
                        yorum_tarihi = None
                        try:
                            tarih_elements = yorum_div.find_elements(By.CLASS_NAME, "comment-info-item")
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
                        
                        # ÜRÜN RATING'INI KULLAN (her ürün için sabit)
                        # product_rating zaten ürün sayfasından alındı
                        
                        tum_yorumlar.append(yorum_metni)
                        urun_yorum_sayisi += 1
                        
                        # MongoDB kaydı - GELİŞTİRİLMİŞ VERİ YAPISI
                        review_data = {
                            'platform': 'Trendyol',
                            'product_name': product_name_from_url,
                            'comment': yorum_metni,
                            'comment_date': yorum_tarihi,  # Gerçek yorum tarihi
                            'rating': product_rating,  # ⭐ DÜZELTME: Doğru alan adı
                            'likes_count': 0,  # Gerçek beğeni sayısı (şimdilik 0)
                            'product_price': product_price,  # 💰 YENİ: Ürün fiyatı
                            'timestamp': datetime.now(),    # Çekilme tarihi
                            'product_url': url,
                            'search_term': product_name,
                            'source': 'search_scraper',
                            'collection_name': search_collection_name
                        }
                        
                        # 1. Search terimi özel koleksiyonu
                        search_collection.insert_one(review_data.copy())
                        
                        # 2. Genel Trendyol koleksiyonu
                        trendyol_collection.insert_one(review_data.copy())
                        
                        # 3. Tüm yorumlar koleksiyonu
                        all_reviews_collection.insert_one(review_data.copy())
                        
                        # Debug: Tarih bilgisini yazdır
                        if yorum_tarihi:
                            print(f"    ✅ Yorum: {product_rating} rating, Fiyat: {product_price} TL, Tarih: {yorum_tarihi}", file=sys.stderr)
                        else:
                            print(f"    ✅ Yorum: {product_rating} rating, Fiyat: {product_price} TL", file=sys.stderr)
                            
                    except Exception as yorum_hatasi:
                        print(f"⚠️ Yorum işleme hatası: {yorum_hatasi}", file=sys.stderr)
                        continue
                
                print(f"✅ Ürün {i+1}: {urun_yorum_sayisi} yorum eklendi", file=sys.stderr)
                
            except Exception as e:
                print(f"❌ Ürün {i+1} yorumları alınamadı: {e}", file=sys.stderr)
                continue
    
    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    finally:
        driver.quit()
    
    return {
        "success": True,
        "search_term": product_name,
        "total_reviews": len(tum_yorumlar),
        "total_products": len(bulunan_urunler),
        "platform": "Trendyol",
        "products": bulunan_urunler,
        "collection_name": search_collection_name
    }

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

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Ürün adı parametresi gerekli"}))
        sys.exit(1)
    
    product_name = sys.argv[1]
    max_products = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    result = scrape_trendyol_by_product_name(product_name, max_products)