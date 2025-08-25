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
    if len(safe_name) > 80:
        safe_name = safe_name[:80]
    
    return f"{platform.lower()}_reviews_{safe_name}"

def extract_product_name_from_url(url):
    """Amazon URL'den ürün adını çıkar"""
    try:
        # Amazon ürün adı genellikle /dp/ ve /ref arasında olur
        if '/dp/' in url:
            # ASIN kodunu al
            asin_match = re.search(r'/dp/([A-Z0-9]{10})', url)
            if asin_match:
                asin = asin_match.group(1)
                return f"amazon_product_{asin}"
        
        # URL'den ürün adını çıkarmaya çalış
        url_parts = url.split('/')
        for part in url_parts:
            if len(part) > 10 and not part.startswith('http') and 'amazon' not in part and 'dp' not in part:
                # URL'deki tire ve %20'leri boşluklarla değiştir
                product_name = part.replace('-', ' ').replace('%20', ' ')
                # Sayıları ve özel karakterleri temizle
                product_name = re.sub(r'[^a-zA-Z\s]', '', product_name)
                if len(product_name.strip()) > 5:
                    return product_name.strip()
        
        return "amazon_product_unknown"
    except Exception as e:
        print(f"Ürün adı çıkarma hatası: {e}", file=sys.stderr)
        return "amazon_product_error"

def extract_asin_from_url(url):
    """Amazon URL'den ASIN kodunu çıkar"""
    asin_match = re.search(r'/dp/([A-Z0-9]{10})', url)
    if asin_match:
        return asin_match.group(1)
    return None

def scrape_amazon_product(product_url, max_pages=10, enable_login=True):
    """Amazon ürününden yorumları çek"""
    
    print(f"🚀 Amazon scraping başlatılıyor...", file=sys.stderr)
    print(f"📱 Ürün URL: {product_url}", file=sys.stderr)
    print(f"📄 Maksimum sayfa: {max_pages}", file=sys.stderr)
    print(f"🔐 Giriş: {'Aktif' if enable_login else 'Pasif'}", file=sys.stderr)
    
    # ASIN kodunu çıkar
    asin = extract_asin_from_url(product_url)
    if not asin:
        return {"success": False, "error": "ASIN kodu çıkarılamadı"}
    
    print(f"🔖 ASIN: {asin}", file=sys.stderr)
    
    # MongoDB bağlantısı
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        print("✅ MongoDB bağlantısı başarılı", file=sys.stderr)
    except Exception as e:
        print(f"❌ MongoDB bağlantı hatası: {e}", file=sys.stderr)
        return {"success": False, "error": f"MongoDB bağlantı hatası: {e}"}

    # Chrome ayarları
    options = Options()
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        print("✅ ChromeDriver başlatıldı", file=sys.stderr)
    except Exception as e:
        print(f"❌ ChromeDriver hatası: {e}", file=sys.stderr)
        return {"success": False, "error": f"ChromeDriver hatası: {e}"}

    yorumlar = []
    
    try:
        # Amazon'a giriş yap (isteğe bağlı)
        if enable_login:
            print("🔐 Amazon'a giriş yapılıyor...", file=sys.stderr)
            try:
                driver.get("https://www.amazon.com.tr/ap/signin?openid.pape.max_auth_age=900&"
                          "openid.return_to=https%3A%2F%2Fwww.amazon.com.tr%2Fgp%2Fyourstore%2Fhome"
                          "%3Fpath%3D%252Fgp%252Fyourstore%252Fhome%26signIn%3D1%26useRedirectOnSuccess"
                          "%3D1%26action%3Dsign-out%26ref_%3Dnav_AccountFlyout_gno_signout&"
                          "openid.assoc_handle=trflex&openid.mode=checkid_setup&"
                          "openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0")
                
                # Email gir
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "ap_email"))
                ).send_keys("ay3738176@gmail.com")
                driver.find_element(By.ID, "continue").click()
                
                # Şifre gir
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "ap_password"))
                ).send_keys("theclico2134")
                driver.find_element(By.ID, "signInSubmit").click()
                
                # Giriş başarılı mı kontrol et
                time.sleep(3)
                driver.switch_to.window(driver.window_handles[-1])
                print("✅ Amazon girişi başarılı", file=sys.stderr)
                
            except Exception as login_error:
                print(f"⚠️ Amazon giriş hatası: {login_error}", file=sys.stderr)
                print("🔄 Giriş yapmadan devam ediliyor...", file=sys.stderr)
        
        # Ürün adını URL'den çıkar
        product_name = extract_product_name_from_url(product_url)
        print(f"📦 Ürün adı: {product_name}", file=sys.stderr)
        
        # Koleksiyon adını oluştur
        collection_name = create_safe_collection_name(product_name, "amazon")
        print(f"🗄️ Koleksiyon adı: {collection_name}", file=sys.stderr)
        
        # Koleksiyonu temizle
        collection = db[collection_name]
        collection.delete_many({})
        print(f"🗑️ Eski veriler temizlendi", file=sys.stderr)
        
        # Yorum URL'sini oluştur
        base_url = f"https://www.amazon.com.tr/product-reviews/{asin}/?ie=UTF8&reviewerType=all_reviews&pageNumber="
        
        # Fiyat bilgisini almaya çalış
        price = None
        try:
            driver.get(product_url)
            time.sleep(2)
            price_selectors = [
                ".a-price-whole",
                ".a-price .a-offscreen",
                ".a-color-price",
                "[data-testid='price-current']"
            ]
            
            for selector in price_selectors:
                try:
                    price_element = driver.find_element(By.CSS_SELECTOR, selector)
                    price_text = price_element.text.strip()
                    price_match = re.search(r'[\d.,]+', price_text.replace('.', '').replace(',', '.'))
                    if price_match:
                        price = float(price_match.group(0))
                        print(f"💰 Fiyat bulundu: {price} TL", file=sys.stderr)
                        break
                except:
                    continue
        except Exception as price_error:
            print(f"⚠️ Fiyat alma hatası: {price_error}", file=sys.stderr)
        
        # Sayfa sayfa yorumları çek
        for page in range(1, max_pages + 1):
            url = base_url + str(page)
            print(f"\n📄 Sayfa {page}/{max_pages} yükleniyor...", file=sys.stderr)
            
            try:
                driver.get(url)
                time.sleep(2)
                
                # Yorumları bekle - Amazon yapısı değiştiği için farklı selector'lar dene
                page_loaded = False
                try:
                    # İlk deneme: review-body
                    kutular = WebDriverWait(driver, 5).until(
                        EC.presence_of_all_elements_located(
                            (By.CSS_SELECTOR, 'span[data-hook="review-body"]')
                        )
                    )
                    page_loaded = True
                    print(f"✅ Sayfa {page}: Review-body ile yorum bulundu", file=sys.stderr)
                except:
                    try:
                        # İkinci deneme: review container'ları
                        kutular = WebDriverWait(driver, 5).until(
                            EC.presence_of_all_elements_located(
                                (By.CSS_SELECTOR, '[data-hook="review"]')
                            )
                        )
                        page_loaded = True
                        print(f"✅ Sayfa {page}: Review container ile yorum bulundu", file=sys.stderr)
                    except:
                        try:
                            # Üçüncü deneme: genel review sınıfı
                            kutular = WebDriverWait(driver, 5).until(
                                EC.presence_of_all_elements_located(
                                    (By.CSS_SELECTOR, '.review')
                                )
                            )
                            page_loaded = True
                            print(f"✅ Sayfa {page}: .review sınıfı ile yorum bulundu", file=sys.stderr)
                        except:
                            print(f"⚠️ Sayfa {page}: Hiçbir selector ile yorum bulunamadı", file=sys.stderr)
                
                if not page_loaded:
                    print(f"🚫 Sayfa {page}: Yorumlar yüklenemedi, sonraki sayfaya geçiliyor", file=sys.stderr)
                    continue
                
                yeni_yorumlar = 0
                
                # Amazon yorumlar için tüm yorum container'larını al
                review_containers = driver.find_elements(By.CSS_SELECTOR, '[data-hook="review"]')
                print(f"🔍 Bulunan yorum container sayısı: {len(review_containers)}", file=sys.stderr)
                
                # Eğer container bulunamazsa alternatif selector'lar dene
                if len(review_containers) == 0:
                    print("⚠️ [data-hook='review'] bulunamadı, alternatif selector deneniyor...", file=sys.stderr)
                    review_containers = driver.find_elements(By.CSS_SELECTOR, '.review')
                    print(f"🔍 .review ile bulunan: {len(review_containers)}", file=sys.stderr)
                
                if len(review_containers) == 0:
                    review_containers = driver.find_elements(By.CSS_SELECTOR, '.a-section.review')
                    print(f"🔍 .a-section.review ile bulunan: {len(review_containers)}", file=sys.stderr)
                
                for idx, container in enumerate(review_containers):
                    try:
                        # Yorum metnini al
                        try:
                            yorum_element = container.find_element(By.CSS_SELECTOR, 'span[data-hook="review-body"]')
                            yorum_text = yorum_element.text.strip()
                        except Exception as review_text_error:
                            # Alternatif yorum metni selector'ları dene
                            try:
                                yorum_element = container.find_element(By.CSS_SELECTOR, '[data-hook="review-body"] span')
                                yorum_text = yorum_element.text.strip()
                            except:
                                try:
                                    yorum_element = container.find_element(By.CSS_SELECTOR, '.review-text')
                                    yorum_text = yorum_element.text.strip()
                                except:
                                    print(f"⚠️ Yorum metni bulunamadı container {idx+1}: {review_text_error}", file=sys.stderr)
                                    continue
                            
                        if yorum_text and len(yorum_text) > 5:
                            # Tekrar eden yorumları kontrol et
                            if yorum_text not in [y for y in yorumlar]:
                                
                                # Amazon yorum tarihini çek
                                comment_date = None
                                try:
                                    date_element = container.find_element(By.CSS_SELECTOR, '[data-hook="review-date"]')
                                    if date_element:
                                        date_text = date_element.text.strip()
                                        if date_text:
                                            # "Türkiye'de 26 Haziran 2025 tarihinde değerlendirildi" formatından tarihi çıkar
                                            date_match = re.search(r'(\d{1,2}\s+\w+\s+\d{4})', date_text)
                                            if date_match:
                                                comment_date = date_match.group(1)
                                                print(f"📅 Amazon yorum tarihi bulundu: {comment_date}", file=sys.stderr)
                                            else:
                                                comment_date = date_text  # Tam metni kaydet
                                except:
                                    pass  # Tarih bulunamazsa devam et
                                
                                yorumlar.append(yorum_text)
                                yeni_yorumlar += 1
                                
                                # MongoDB'ye kaydet
                                review_data = {
                                    'platform': 'amazon',
                                    'comment': yorum_text,
                                    'comment_date': comment_date,
                                    'timestamp': datetime.now(),
                                    'product_url': product_url,
                                    'product_name': product_name,
                                    'asin': asin,
                                    'page_number': page,
                                    'review_index': idx + 1,
                                    'price': price,
                                    'likes': 0
                                }
                                
                                collection.insert_one(review_data)
                                
                    except Exception as inner_e:
                        print(f"    ⚠️ Yorum işleme hatası: {inner_e}", file=sys.stderr)
                        continue
                
                print(f"✅ Sayfa {page}: {yeni_yorumlar} yeni yorum eklendi", file=sys.stderr)
                
                # Son sayfa kontrolü
                if driver.find_elements(By.CSS_SELECTOR, "li.a-disabled.a-last"):
                    print("🚫 Son sayfa, işlem tamamlandı", file=sys.stderr)
                    break
                    
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
            excel_filename = f"amazon_{product_name.replace(' ', '_')}_yorumlar.xlsx"
            df.to_excel(excel_filename, index=False)
            print(f"📁 Excel dosyası oluşturuldu: {excel_filename}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Excel oluşturma hatası: {e}", file=sys.stderr)

    print(f"\n✅ Amazon scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam yorum: {len(yorumlar)}", file=sys.stderr)
    print(f"🗄️ Koleksiyon: {collection_name}", file=sys.stderr)
    
    return {
        "success": True,
        "total_reviews": len(yorumlar),
        "collection_name": collection_name,
        "product_name": product_name,
        "platform": "amazon",
        "asin": asin,
        "price": price
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        enable_login = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else True
    else:
        test_url = "https://www.amazon.com.tr/Apple-iPhone-16-Pro-Max/dp/B0DGHXM2CL"
        max_pages = 10
        enable_login = True
    
    result = scrape_amazon_product(test_url, max_pages, enable_login)
    print(json.dumps(result, ensure_ascii=False, indent=2)) 