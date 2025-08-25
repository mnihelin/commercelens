#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# --- EN ÜSTE EKLE ---
import os, time
START_TIME = time.time()

def time_left(sec_budget):
    return sec_budget - (time.time() - START_TIME)

def time_is_up(sec_budget, margin=3):
    # margin: güvenlik payı, bitişten birkaç sn önce çık
    return time_left(sec_budget) <= margin

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException
import random, sys, json, re
from pymongo import MongoClient
from datetime import datetime

# -------------------- Yardımcılar --------------------

def create_safe_collection_name(product_name, platform):
    safe_name = product_name.lower()
    char_map = {'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','Ç':'c','Ğ':'g','İ':'i','Ö':'o','Ş':'s','Ü':'u'}
    for tr,en in char_map.items():
        safe_name = safe_name.replace(tr, en)
    safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
    safe_name = re.sub(r'\s+', '_', safe_name.strip())
    safe_name = re.sub(r'_+', '_', safe_name).strip('_')
    platform_short = platform.lower().replace(' ', '')
    collection_name = f"{platform_short}_reviews_{safe_name}"
    if len(collection_name) > 60:
        max_product_length = 60 - len(f"{platform_short}_reviews_")
        safe_name = safe_name[:max_product_length].rstrip('_')
        collection_name = f"{platform_short}_reviews_{safe_name}"
    return collection_name

def is_challenge_page(driver):
    src = driver.page_source.lower()
    return ("captcha" in src) or ("doğrulama" in src) or ("dogrulama" in src) or ("perimeterx" in src) or ("hcaptcha" in src)

def safe_get(driver, url, hard_timeout=5):  # 8 → 5 saniye
    driver.set_page_load_timeout(hard_timeout)
    try:
        driver.get(url)
    except TimeoutException:
        # Tam yükleme takıldıysa yüklemeyi kes ve devam et
        driver.execute_script("window.stop();")

def wait_reviews(driver, timeout=4):  # 6 → 4 saniye
    wait = WebDriverWait(driver, timeout)
    try:
        # Daha spesifik selector - gerçek yorum kartlarını hedefle
        selectors = [
            "div[data-test-id='review-card']",  # Ana yorum kartları
            ".hermes-ReviewCard-module",  # Hepsiburada spesifik
            "[data-test-id*='review'][class*='card']",  # Review card kombinasyonu
            ".review-card",  # Generic review card
        ]
        
        for selector in selectors:
            try:
                elements = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector)))
                if elements and len(elements) <= 20:  # Sayfa başına max 20 yorum olmalı
                    return elements
            except:
                continue
                
        # Fallback: generic ama sınırlı
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, "[data-test-id*='review']")
            return elements[:20]  # Max 20 element al
        except:
            return []
    except Exception:
        return []

def lazy_scroll(driver, times=3, step=1000, pause=0.2):  # 4→3, 800→1000, 0.3→0.2
    for s in range(times):  # i yerine s: dıştaki i'yi gölgelemeyelim
        driver.execute_script(f"window.scrollBy(0,{step});")
        time.sleep(pause)

def extract_likes_from_review(element):
    likes = 0
    try:
        like_elements = element.find_elements(By.XPATH, ".//button[contains(@class, 'helpful')] | .//span[contains(@class, 'helpful')]")
        for like_elem in like_elements:
            text = like_elem.text.strip()
            numbers = re.findall(r'\d+', text)
            if numbers:
                likes = int(numbers[0]); break
        if likes == 0:
            rating_elements = element.find_elements(By.CLASS_NAME, "hermes-AverageRateBox-module-hA0lI9riLKFi7OKbEnBV")
            for rating_elem in rating_elements:
                text = rating_elem.text.strip()
                numbers = re.findall(r'\d+', text)
                if numbers:
                    likes = int(numbers[0]); break
        if likes == 0:
            full_text = element.text
            bildir_match = re.search(r'(\d+)\s*\n\s*\d+\s*\n\s*Bildir', full_text)
            if bildir_match:
                likes = int(bildir_match.group(1))
    except Exception:
        likes = 0
    return likes

def extract_price_from_product_page(driver, product_url):
    price = None
    try:
        main_product_url = product_url.replace('-yorumlari', '').split('?')[0]
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[1])
        safe_get(driver, main_product_url, hard_timeout=6)  # 12 → 6
        time.sleep(0.4)  # 0.8 → 0.4

        price_selectors = [
            ".z7kokklsVwh0K5zFWjIO",
            ".price-current", ".price", ".product-price",
            ".notranslate", "[data-test-id='price-current-price']",
            ".hermes-PriceBox-module", ".price-box"
        ]
        for sel in price_selectors:
            try:
                for elem in driver.find_elements(By.CSS_SELECTOR, sel):
                    text = (elem.text or "").strip()
                    m = re.search(r'([\d.,]+)\s*(?:TL|₺|)', text)
                    if m:
                        price_str = m.group(1).replace('.', '').replace(',', '.')
                        price = float(price_str)
                        break
                if price is not None: break
            except Exception:
                continue
    except Exception:
        pass
    finally:
        try:
            if len(driver.window_handles) > 1:
                driver.close()
            driver.switch_to.window(driver.window_handles[0])
        except Exception:
            pass
    return price

def extract_product_rating_from_page(driver, product_url):
    rating_score = 0.0
    try:
        main_product_url = product_url.replace('-yorumlari', '').split('?')[0]
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[1])
        safe_get(driver, main_product_url, hard_timeout=6)  # 12 → 6
        time.sleep(0.4)  # 0.8 → 0.4

        rating_selectors = [
            ".JYHIcZ8Z_Gz7VXzxFB96",
            ".JHvKSZxdcgryD4RxfgqS .JYHIcZ8Z_Gz7VXzxFB96",
            ".hermes-AverageRateBox-module-hA0lI9riLKFi7OKbEnBV",
            ".rating-score",".product-rating",".rate-point",".rating-value",
            "[data-testid='rating-score']",".rating",".score",".star-rating",
            ".review-score",".product-score",".rating-text",".rate-value",
            ".puan","[class*='rating']","[class*='score']","[class*='puan']","[class*='rate']"
        ]
        for sel in rating_selectors:
            try:
                elems = driver.find_elements(By.CSS_SELECTOR, sel)
                for elem in elems:
                    text = (elem.text or "").strip()
                    m = re.search(r'^(\d+\.?\d*)$', text) or re.search(r'\b([1-5]\.[0-9])\b', text)
                    if m:
                        val = float(m.group(1))
                        if 1.0 <= val <= 5.0:
                            rating_score = val; break
                    m2 = re.search(r'^(\d+),(\d+)$', text)
                    if m2:
                        val = float(f"{m2.group(1)}.{m2.group(2)}")
                        if 1.0 <= val <= 5.0:
                            rating_score = val; break
                if rating_score > 0: break
            except Exception:
                continue
        if rating_score == 0:
            page_html = driver.page_source[:4000]
            m = re.search(r'\b([1-5]\.[0-9])\b', page_html)
            if m:
                rating_score = float(m.group(1))
    except Exception:
        pass
    finally:
        try:
            if len(driver.window_handles) > 1:
                driver.close()
            driver.switch_to.window(driver.window_handles[0])
        except Exception:
            pass
    return rating_score

def extract_product_name_from_url(url):
    try:
        if 'hepsiburada.com' in url:
            for part in url.split('/'):
                if '-p-' in part:
                    name_part = part.split('-p-')[0]
                    words = [w for w in name_part.split('-') if w]
                    return ' '.join(w.capitalize() for w in words)
        return "Hepsiburada Ürünü"
    except Exception:
        return "Hepsiburada Ürünü"

def extract_real_product_name_from_page(driver, url):
    """Yorum sayfasından veya ürün sayfasından gerçek ürün adını çeker"""
    try:
        # Önce yorum sayfasından H1 dene (daha hızlı)
        try:
            h1_elements = driver.find_elements(By.TAG_NAME, "h1")
            for h1 in h1_elements:
                text = h1.text.strip()
                # "iPhone", "Samsung" gibi marka isimleri içeriyorsa ve yeterince uzunsa
                if text and len(text) > 15 and any(brand in text for brand in ['iPhone', 'Samsung', 'Xiaomi', 'Apple', 'Huawei', 'Oppo', 'Vivo', 'Redmi']):
                    print(f"    ✅ H1'den ürün adı: {text}", file=sys.stderr)
                    return text
        except:
            pass
            
        # Sayfa başlığından dene  
        try:
            page_title = driver.title.strip()
            if page_title and 'Hepsiburada' in page_title:
                product_name = page_title.split(' - ')[0].strip()
                if product_name and len(product_name) > 15:
                    print(f"    ✅ Title'dan ürün adı: {product_name}", file=sys.stderr)
                    return product_name
        except:
            pass

        # Breadcrumb'dan dene
        try:
            breadcrumb_links = driver.find_elements(By.CSS_SELECTOR, '[data-test-id="breadcrumb"] a, .breadcrumb a')
            if breadcrumb_links:
                last_link = breadcrumb_links[-1].text.strip()
                if last_link and len(last_link) > 15:
                    print(f"    ✅ Breadcrumb'dan ürün adı: {last_link}", file=sys.stderr)
                    return last_link
        except:
            pass

        # Ürün sayfasına git (son çare)
        if '-yorumlari' in url:
            product_url = url.replace('-yorumlari', '')
            print(f"    🔄 Ürün sayfasına gidiliyor: {product_url}", file=sys.stderr)
            safe_get(driver, product_url, hard_timeout=8)
            time.sleep(1)
            
            # Ürün sayfasında H1 dene
            try:
                h1_element = driver.find_element(By.TAG_NAME, "h1")
                product_name = h1_element.text.strip()
                if product_name and len(product_name) > 15:
                    print(f"    ✅ Ürün sayfası H1'den: {product_name}", file=sys.stderr)
                    return product_name
            except:
                pass
                
            # Meta tag dene
            try:
                meta_element = driver.find_element(By.CSS_SELECTOR, 'meta[property="og:title"]')
                product_name = meta_element.get_attribute('content').strip()
                if product_name and len(product_name) > 15:
                    print(f"    ✅ Meta tag'den ürün adı: {product_name}", file=sys.stderr)
                    return product_name
            except:
                pass
            
    except Exception as e:
        print(f"    ⚠️ Gerçek ürün adı çekilemedi: {e}", file=sys.stderr)
    
    # Fallback: URL'den çıkar
    fallback_name = extract_product_name_from_url(url)
    print(f"    🔄 Fallback URL'den: {fallback_name}", file=sys.stderr)
    return fallback_name

# -------------------- Ana İşlev --------------------

def scrape_hepsiburada_by_product_name(product_name, max_products=5, pages_per_product=3, max_seconds=180):
    print(f"🚀 Hepsiburada arama scraping başlatılıyor...", file=sys.stderr)
    print(f"🔍 Arama terimi: {product_name}", file=sys.stderr)
    print(f"📦 Maksimum ürün: {max_products}", file=sys.stderr)
    print(f"📄 Ürün başına sayfa: {pages_per_product}", file=sys.stderr)
    print(f"⏰ Maksimum süre: {max_seconds} saniye", file=sys.stderr)

    search_collection_name = create_safe_collection_name(product_name, "hepsiburada")
    print(f"🗄️ Arama koleksiyonu: {search_collection_name}", file=sys.stderr)

    all_results, bulunan_urunler = [], []

    # --- Chrome Options - headless ve hızlı ---
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-extensions")
    options.add_argument("--blink-settings=imagesEnabled=false")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.page_load_strategy = "eager"  # kritik

    UAS = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ]
    options.add_argument(f"--user-agent={random.choice(UAS)}")

    # WebDriver (güncellenmiş ChromeDriver path)
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
            print(f"❌ Otomatik indirme de başarısız: {e2}", file=sys.stderr)
            raise Exception("ChromeDriver başlatılamadı")

    try:
        # Arama terimi kontrol
        if not product_name or len(product_name.strip()) < 2:
            print(f"❌ Geçersiz arama terimi: '{product_name}'", file=sys.stderr)
            return {"success": False, "error": f"Geçersiz arama terimi: '{product_name}'"}
        
        # Arama
        clean_search_term = product_name.strip().replace(' ', '+')
        search_url = f"https://www.hepsiburada.com/ara?q={clean_search_term}"
        print(f"🔍 Hepsiburada'da arama: {search_url}", file=sys.stderr)
        print(f"🔍 Temizlenmiş arama terimi: '{clean_search_term}'", file=sys.stderr)
        safe_get(driver, search_url, hard_timeout=5)  # 8 → 5
        time.sleep(0.3 + random.random()*0.3)  # 0.5-1.0 → 0.3-0.6

        # 🎯 PID bazlı DEDUPE sistemi - "tek ürünün çoğalması" sorununu çözer
        try:
            # Tüm ürün linklerini topla
            links = driver.find_elements(By.XPATH, "//a[contains(@href, '-p-')]")
            print(f"📦 {len(links)} potansiyel ürün linki bulundu", file=sys.stderr)
            
            seen, items = set(), []
            for a in links:
                if time_is_up(max_seconds): break  # Süre kontrolü
                
                href = (a.get_attribute("href") or "").split("?")[0]
                if not href or 'adservice' in href or '/event/' in href:
                    continue
                    
                # Ürün ID'sini çıkar (p-XXXXX formatı)
                m = re.search(r"-p-([A-Z0-9]+)", href, re.I)
                if not m:
                    continue
                    
                pid = m.group(1).upper()
                if pid in seen:  # 🔑 Aynı ürün ID'si zaten var, atla
                    continue
                seen.add(pid)
                
                # URL'yi temizle ve yorum sayfası linkini oluştur
                if not href.startswith('http'):
                    href = f"https://www.hepsiburada.com{href}"
                yorum_url = href if href.endswith("-yorumlari") else href + "-yorumlari"
                
                # Gelişmiş ürün adı çıkarma
                name = ""
                
                # 1) title attribute'u dene
                title = a.get_attribute("title")
                if title and len(title.strip()) > 10 and not any(x in title.lower() for x in ["kampanya", "taksit", "fiyat", "puan"]):
                    name = title.strip()
                
                # 2) link text'i dene (temizlenmiş)
                if not name:
                    text = (a.text or "").strip()
                    # Çok uzun veya karışık HTML içeriklerini filtrele
                    if text and len(text) < 200 and not any(x in text.lower() for x in ["kampanya", "taksit", "fiyat", "puan", "değerlendirme"]):
                        # Sadece ürün adı benzeri metinleri al
                        clean_text = text.split('\n')[0].strip()  # İlk satırı al
                        if len(clean_text) > 10:
                            name = clean_text
                
                # 3) Parent element'ten ürün adı bul
                if not name:
                    try:
                        parent = a.find_element(By.XPATH, './ancestor::*[contains(@class,"product") or contains(@data-test-id,"product")]')
                        name_els = parent.find_elements(By.CSS_SELECTOR, '[data-test-id*="product-name"], [class*="product-name"], [class*="productName"], h3, .title')
                        for el in name_els:
                            candidate = (el.text or "").strip()
                            if candidate and len(candidate) > 10 and len(candidate) < 150:
                                name = candidate
                                break
                    except Exception:
                        pass
                
                # 4) URL'den çıkar (fallback)
                if not name:
                    name = extract_product_name_from_url(href)
                
                # 5) Son fallback
                if not name or len(name) < 5:
                    name = f"Hepsiburada Ürünü {len(items)+1}"
                
                items.append((yorum_url, name))
                print(f"✅ Benzersiz Ürün {len(items)}: {name} (PID: {pid})", file=sys.stderr)
                print(f"    🔗 URL: {yorum_url}", file=sys.stderr)
                
                if len(items) == max_products:
                    break
            
            # Sonuçları ayır
            yorum_sayfalari = [u for u, _ in items]
            bulunan_urunler = [n for _, n in items]
            
            print(f"🎯 DEDUPE sonucu: {len(yorum_sayfalari)} benzersiz ürün (hedef: {max_products})", file=sys.stderr)
        except Exception as e:
            print(f"❌ Ürün linkleri alınamadı: {e}", file=sys.stderr)
            return {"success": False, "error": f"Ürün linkleri alınamadı: {str(e)}"}

        if not yorum_sayfalari:
            print(f"❌ DEDUPE sonrası hiç ürün kalmadı. Potansiyel linkler: {len(candidate_links)}", file=sys.stderr)
            print(f"❌ Canon_seen içeriği: {list(canon_seen)[:5]}", file=sys.stderr)
            return {"success": False, "error": "Hiç ürün bulunamadı", "debug": {"potential_links": len(candidate_links), "seen_pids": list(canon_seen)[:5]}}

        # Her ürün
        for i, base_url in enumerate(yorum_sayfalari):
            if time_is_up(max_seconds): break  # Süre kontrolü
            product_idx = i  # i'yi güvenceye al
            # Arama sayfasından çekilen ürün adını kullan
            real_product_name = bulunan_urunler[i] if i < len(bulunan_urunler) else f"Ürün {i+1}"
            print(f"\n📦 Ürün {i+1}/{len(yorum_sayfalari)}: {real_product_name}", file=sys.stderr)

            # Fiyat & rating (her ürün için bir kez)
            product_price = extract_price_from_product_page(driver, base_url)
            product_rating = extract_product_rating_from_page(driver, base_url)
            print(f"    💰 Fiyat: {product_price} | ⭐ Rating: {product_rating}", file=sys.stderr)

            total_reviews_for_product = 0

            # Sayfalar
            for page in range(1, pages_per_product + 1):
                if time_is_up(max_seconds): break  # Süre kontrolü
                full_url = f"{base_url}?sayfa={page}"
                print(f"  📄 Sayfa {page} yükleniyor: {full_url}", file=sys.stderr)
                try:
                    safe_get(driver, full_url, hard_timeout=5)  # 8 → 5
                    time.sleep(0.2 + random.random()*0.3)  # 0.5-1.0 → 0.2-0.5
                    if is_challenge_page(driver):
                        time.sleep(1 + random.random())  # 2-4 → 1-2
                        driver.refresh()
                        time.sleep(0.6)  # 1.2 → 0.6

                    yorum_elements = wait_reviews(driver, timeout=4)  # 6 → 4

                    if not yorum_elements:
                        # Generic fallback
                        generic_selectors = [
                            "[data-test-id*='review']",
                            "[class*='ReviewCard']",
                            "[class*='review']",
                            "[class*='comment']",
                            ".review", ".comment", "[id*='review']"
                        ]
                        for gs in generic_selectors:
                            elems = driver.find_elements(By.CSS_SELECTOR, gs)
                            if len(elems) >= 5:
                                yorum_elements = elems
                                break

                    if yorum_elements:
                        lazy_scroll(driver, times=3, step=1000, pause=0.2)  # Daha agresif
                        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                        time.sleep(0.3)  # 0.5 → 0.3

                    sayfa_yorum_sayisi = 0
                    sayfa_yorumlari = set()  # Bu sayfa için duplike kontrolü
                    
                    # Sayfa başına maksimum 15 yorum
                    max_per_page = 15
                    yorum_elements_limited = (yorum_elements or [])[:max_per_page]
                    
                    for j, element in enumerate(yorum_elements_limited):
                        if time_is_up(max_seconds): break  # Süre kontrolü
                        if sayfa_yorum_sayisi >= max_per_page: break  # Sayfa limiti
                        
                        try:
                            metin = (element.text or "").strip()
                            if not metin or len(metin) <= 10:
                                continue
                                
                            # Duplike kontrolü - yorum metninin ilk 100 karakteri
                            yorum_hash = metin[:100].strip()
                            if yorum_hash in sayfa_yorumlari:
                                continue  # Duplike, atla
                            sayfa_yorumlari.add(yorum_hash)
                            
                            likes = extract_likes_from_review(element)

                            yorum_tarihi = None
                            try:
                                tarih_spans = element.find_elements(By.CSS_SELECTOR, "span[class*='hermes-ReviewCard-module-']")
                                for span in tarih_spans:
                                    content_attr = span.get_attribute('content')
                                    if content_attr and re.match(r'\d{4}-\d{2}-\d{2}', content_attr):
                                        yorum_tarihi = span.text.strip(); break
                                    span_text = (span.text or "").strip().lower()
                                    if span_text and any(k in span_text for k in [
                                        'ocak','şubat','şubat','mart','nisan','mayıs','mayis','haziran',
                                        'temmuz','ağustos','ağustos','eylül','eylul','ekim','kasım','kasim','aralık','aralik',
                                        'gün önce','hafta önce','ay önce','yıl önce','gun once','hafta once','ay once','yil once'
                                    ]):
                                        yorum_tarihi = span.text.strip(); break
                            except Exception:
                                yorum_tarihi = None

                            review_data = {
                                'id': f"hepsiburada_{product_idx}_{page}_{j}",
                                'collection_name': search_collection_name,
                                'platform': 'hepsiburada',
                                'product_name': real_product_name,
                                'comment': metin,
                                'comment_date': yorum_tarihi,
                                'rating': product_rating,
                                'timestamp': datetime.now().isoformat(),
                                'product_url': base_url,
                                'product_price': product_price,
                                'total_reviews': None,
                                'search_term': product_name,
                                'page_number': page,
                                'review_index': j,
                                'likes': likes,
                                'user_name': None,
                                'verified_purchase': None,
                                'created_at': datetime.now().isoformat(),
                                'last_updated': datetime.now().isoformat()
                            }
                            all_results.append(review_data)
                            sayfa_yorum_sayisi += 1
                            total_reviews_for_product += 1
                        except Exception:
                            continue

                    print(f"    ✅ Sayfa {page}: {sayfa_yorum_sayisi} yorum (max: {max_per_page})", file=sys.stderr)

                    if sayfa_yorum_sayisi == 0:
                        print(f"    🛑 Sayfa {page}'da yorum yok → sonraki ürüne geç", file=sys.stderr)
                        break

                    if page < pages_per_product:
                        time.sleep(0.05 + random.random()*0.1)  # 0.1-0.3 → 0.05-0.15

                except Exception as e:
                    print(f"    ❌ Sayfa {page} atlandı: {e}", file=sys.stderr)
                    if "timeout" in str(e).lower() or "timeoutexception" in str(e).lower():
                        print(f"    ⏰ Timeout! Kalan sayfalar atlanıyor…", file=sys.stderr)
                        break
                    time.sleep(0.5)  # 1.5 → 0.5
                    continue

            print(f"  ✅ Ürün toplam yorum: {total_reviews_for_product}", file=sys.stderr)

            if i < len(yorum_sayfalari) - 1:
                time.sleep(0.2 + random.random()*0.3)  # 0.5-1.0 → 0.2-0.5

    except Exception as e:
        print(f"❌ Genel hata: {e}", file=sys.stderr)
        return {"success": False, "error": str(e)}
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    print(f"🔒 Driver kapatıldı", file=sys.stderr)
    print(f"✅ Hepsiburada arama scraping tamamlandı!", file=sys.stderr)
    print(f"📊 Toplam ürün: {len(bulunan_urunler)}", file=sys.stderr)
    print(f"💬 Toplam yorum: {len(all_results)}", file=sys.stderr)

    # Ürün bazında özet
    results_by_product, current_product_results, current_product_name = [], [], None
    for r in all_results:
        if current_product_name != r['product_name']:
            if current_product_results:
                total_for_product = len(current_product_results)
                for rr in current_product_results:
                    rr['total_reviews'] = total_for_product
                results_by_product.append({
                    "success": True,
                    "total_reviews": total_for_product,
                    "collection_name": search_collection_name,
                    "product_name": current_product_name,
                    "platform": "hepsiburada",
                    "price": current_product_results[0]['product_price'] if current_product_results else None
                })
            current_product_results = []
            current_product_name = r['product_name']
        current_product_results.append(r)

    if current_product_results:
        total_for_product = len(current_product_results)
        for rr in current_product_results:
            rr['total_reviews'] = total_for_product
        results_by_product.append({
            "success": True,
            "total_reviews": total_for_product,
            "collection_name": search_collection_name,
            "product_name": current_product_name,
            "platform": "hepsiburada",
            "price": current_product_results[0]['product_price'] if current_product_results else None
        })

    # MongoDB kayıt
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        safe_search_term = re.sub(r'[^a-zA-Z0-9]', '_', product_name.lower())
        collection_name = f"hepsiburada_reviews_{safe_search_term}"
        collection = db[collection_name]
        if all_results:
            for review in all_results:
                if not review.get('id'):
                    review['id'] = f"hepsiburada_{review.get('product_name','unknown').replace(' ','_')[:20]}_{review.get('page_number',0)}_{review.get('review_index',0)}"
            try:
                collection.insert_many(all_results, ordered=False)
                print(f"    ✅ {len(all_results)} yorum MongoDB'ye kaydedildi", file=sys.stderr)
            except Exception as e:
                print(f"    ⚠️ MongoDB insert uyarısı: {e}", file=sys.stderr)
        client.close()
    except Exception as e:
        print(f"❌ MongoDB kayıt hatası: {e}", file=sys.stderr)

    # --- Fonksiyon sonunda 'partial' bayrağı ekle ---
    partial = (time.time() - START_TIME) >= (max_seconds - 0.5)

    return {
        "success": True,
        "partial": partial,            # ⬅️ kısmi çıktı mı?
        "total_reviews": len(all_results),
        "products_processed": len(bulunan_urunler),
        "platform": "hepsiburada",
        "search_term": product_name,
        "results": results_by_product,
        "all_reviews": all_results
    }

# -------------------- CLI --------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Ürün adı parametresi gerekli"}))
        sys.exit(1)

    product_name = sys.argv[1]
    max_products = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    pages_per_product = int(sys.argv[3]) if len(sys.argv) > 3 else 6  # 3'ten 6'ya çıkarıldı
    max_seconds = int(sys.argv[4]) if len(sys.argv) > 4 else int(os.getenv("SCRAPER_BUDGET_SEC", "300"))  # 180 → 300 saniye

    # Hızlı test modu
    if product_name.lower() == "test":
        print("🧪 Test modu: iphone 15 ile 2 ürün, 1 sayfa, 60 saniye", file=sys.stderr)
        product_name = "iphone 15"
        max_products = 2
        pages_per_product = 1
        max_seconds = 60

    result = scrape_hepsiburada_by_product_name(product_name, max_products, pages_per_product, max_seconds)
    try:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    except Exception as e:
        print(f"JSON çıktı hatası: {e}", file=sys.stderr)
        print(json.dumps({"success": True, "message": "Veri başarıyla işlendi"}))