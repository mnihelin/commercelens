#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
from pymongo import MongoClient
from datetime import datetime
import os
import re
import sys

def create_safe_collection_name(filename):
    """Dosya adından güvenli koleksiyon adı oluştur"""
    # Dosya uzantısını kaldır
    name = filename.replace('.xlsx', '')
    
    # Türkçe karakterleri değiştir
    char_map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    }
    
    for turkish_char, english_char in char_map.items():
        name = name.replace(turkish_char, english_char)
    
    # Özel karakterleri temizle ve alt çizgi yap
    name = re.sub(r'[^a-zA-Z0-9\s]', '_', name)
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_').lower()
    
    return name

def extract_platform_from_filename(filename):
    """Dosya adından platform adını çıkar"""
    filename_lower = filename.lower()
    
    if 'trendyol' in filename_lower:
        return 'Trendyol'
    elif 'n11' in filename_lower:
        return 'N11'
    elif 'aliexpress' in filename_lower:
        return 'AliExpress'
    elif 'hepsiburada' in filename_lower:
        return 'Hepsiburada'
    elif 'amazon' in filename_lower:
        return 'Amazon'
    elif 'ciceksepeti' in filename_lower:
        return 'ÇiçekSepeti'
    else:
        return 'Bilinmeyen Platform'

def extract_product_from_filename(filename):
    """Dosya adından ürün adını çıkar"""
    # Dosya uzantısını kaldır
    name = filename.replace('.xlsx', '')
    
    # Platform adını kaldır
    platform_names = ['trendyol', 'n11', 'aliexpress', 'hepsiburada', 'amazon', 'ciceksepeti']
    for platform in platform_names:
        if platform in name.lower():
            # Platform adını ve '_yorumlar' kısmını kaldır
            name = re.sub(f'{platform}_', '', name, flags=re.IGNORECASE)
            name = re.sub('_yorumlar$', '', name, flags=re.IGNORECASE)
            break
    
    # Alt çizgileri boşluk yap ve başlıklaştır
    name = name.replace('_', ' ').title()
    
    return name if name else 'Ürün Adı Bilinmiyor'

def parse_comment_text(comment_text):
    """Yorum metnini parse et ve bilgileri çıkar"""
    if not comment_text or pd.isna(comment_text):
        return None
    
    lines = str(comment_text).strip().split('\n')
    
    # Temel veri yapısı
    result = {
        'comment': comment_text,
        'comment_date': '',
        'rating': None,
        'likes_count': 0
    }
    
    # İlk satır genellikle tarih olabilir
    if lines and len(lines) > 0:
        first_line = lines[0].strip()
        # Tarih formatlarını kontrol et
        date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{4}',  # 04/07/2025
            r'\d{1,2}\s+\w+\s+\d{4}',  # 17 Mayıs 2025
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, first_line):
                result['comment_date'] = first_line
                break
    
    # Rating bulma - parantez içindeki sayıları ara
    rating_match = re.search(r'\((\d+(?:\.\d+)?)\)', comment_text)
    if rating_match:
        try:
            result['rating'] = float(rating_match.group(1))
        except:
            pass
    
    return result

def import_xlsx_to_mongodb():
    # MongoDB bağlantısı
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['ecommerce_analytics']
        print("MongoDB'ye başarıyla bağlanıldı")
    except Exception as e:
        print(f"MongoDB bağlantı hatası: {e}")
        return
    
    # Mevcut dizindeki XLSX dosyalarını bul
    xlsx_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and 'yorumlar' in f]
    
    print(f"\nBulunan XLSX dosyaları: {len(xlsx_files)}")
    for file in xlsx_files:
        print(f"  - {file}")
    
    total_imported = 0
    
    for xlsx_file in xlsx_files:
        try:
            print(f"\n{xlsx_file} dosyası işleniyor...")
            
            # Excel dosyasını oku
            df = pd.read_excel(xlsx_file)
            
            if 'Yorum' not in df.columns:
                print(f"  UYARI: {xlsx_file} dosyasında 'Yorum' sütunu bulunamadı")
                continue
            
            # Boş yorumları filtrele
            df = df.dropna(subset=['Yorum'])
            df = df[df['Yorum'].str.strip() != '']
            
            if len(df) == 0:
                print(f"  UYARI: {xlsx_file} dosyasında geçerli yorum bulunamadı")
                continue
            
            # Platform ve ürün bilgilerini çıkar
            platform = extract_platform_from_filename(xlsx_file)
            product_name = extract_product_from_filename(xlsx_file)
            collection_name = create_safe_collection_name(xlsx_file)
            
            print(f"  Platform: {platform}")
            print(f"  Ürün: {product_name}")
            print(f"  Koleksiyon: {collection_name}")
            print(f"  Yorum sayısı: {len(df)}")
            
            # Koleksiyonu seç veya oluştur
            collection = db[collection_name]
            
            # Mevcut doküman sayısını kontrol et
            existing_count = collection.count_documents({})
            if existing_count > 0:
                print(f"  BİLGİ: Bu koleksiyonda zaten {existing_count} doküman var, ekleme yapılacak")
            
            # Her yorumu işle ve ekle
            imported_count = 0
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
            
            for index, row in df.iterrows():
                try:
                    # Yorum verilerini parse et
                    parsed_data = parse_comment_text(row['Yorum'])
                    if not parsed_data:
                        continue
                    
                    # Doküman oluştur
                    document = {
                        'platform': platform,
                        'product_name': product_name,
                        'comment': parsed_data['comment'],
                        'comment_date': parsed_data['comment_date'],
                        'rating': parsed_data['rating'],
                        'likes_count': parsed_data['likes_count'],
                        'product_price': None,
                        'timestamp': timestamp,
                        'product_url': '',
                        'search_term': '',
                        'source': 'xlsx_import',
                        'collection_name': collection_name,
                        'original_file': xlsx_file
                    }
                    
                    # MongoDB'ye ekle
                    collection.insert_one(document)
                    imported_count += 1
                    
                except Exception as e:
                    print(f"    Satır {index} işlenirken hata: {e}")
                    continue
            
            print(f"  ✅ {imported_count} yorum başarıyla eklendi")
            total_imported += imported_count
            
        except Exception as e:
            print(f"  ❌ {xlsx_file} işlenirken hata: {e}")
            continue
    
    print(f"\n🎉 Toplam {total_imported} yorum MongoDB'ye aktarıldı")
    
    # Son durum raporu
    print("\n📊 Veritabanı durumu:")
    collections = db.list_collection_names()
    for col_name in collections:
        count = db[col_name].count_documents({})
        print(f"  {col_name}: {count} doküman")
    
    client.close()

if __name__ == "__main__":
    print("XLSX dosyalarını MongoDB'ye aktarma işlemi başlatılıyor...")
    import_xlsx_to_mongodb()
    print("İşlem tamamlandı!") 