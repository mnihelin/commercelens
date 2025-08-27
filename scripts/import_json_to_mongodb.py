#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from pymongo import MongoClient
from datetime import datetime
import re

def create_safe_collection_name(filename):
    """JSON dosya adından güvenli koleksiyon adı oluştur"""
    # .json uzantısını kaldır
    name = filename.replace('.json', '')
    
    # Zaten güvenli format kullanılıyor, sadece kontrol et
    if '_reviews_' in name:
        return name
    else:
        # Backup format
        return name.replace('_', '_reviews_', 1)

def import_json_to_mongodb():
    # MongoDB bağlantısı
    try:
        # Environment variable'dan MongoDB URI'yi al
        mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        client = MongoClient(mongodb_uri)
        db = client['ecommerce_analytics']
        print(f"MongoDB'ye başarıyla bağlanıldı: {mongodb_uri[:30]}...")
    except Exception as e:
        print(f"MongoDB bağlantı hatası: {e}")
        return
    
    # data/reviews/ dizinindeki JSON dosyalarını bul
    json_dir = 'data/reviews/'
    if not os.path.exists(json_dir):
        print(f"Dizin bulunamadı: {json_dir}")
        return
    
    json_files = [f for f in os.listdir(json_dir) if f.endswith('.json')]
    
    print(f"\nBulunan JSON dosyaları: {len(json_files)}")
    for file in json_files:
        print(f"  - {file}")
    
    total_imported = 0
    
    for json_file in json_files:
        try:
            print(f"\n{json_file} dosyası işleniyor...")
            
            file_path = os.path.join(json_dir, json_file)
            
            # JSON dosyasını oku
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                print(f"  UYARI: {json_file} dosyası list formatında değil")
                continue
            
            if len(data) == 0:
                print(f"  UYARI: {json_file} dosyası boş")
                continue
            
            # Koleksiyon adını belirle
            collection_name = create_safe_collection_name(json_file)
            collection = db[collection_name]
            
            # Mevcut doküman sayısını kontrol et
            existing_count = collection.count_documents({})
            
            # İlk dokümandan bilgileri al
            first_doc = data[0]
            platform = first_doc.get('platform', 'Unknown')
            product_name = first_doc.get('product_name', 'Unknown Product')
            
            print(f"  Platform: {platform}")
            print(f"  Ürün: {product_name}")
            print(f"  Koleksiyon: {collection_name}")
            print(f"  Doküman sayısı: {len(data)}")
            
            if existing_count > 0:
                print(f"  BİLGİ: Bu koleksiyonda zaten {existing_count} doküman var, ekleme yapılacak")
            
            # Verileri ekle
            imported_count = 0
            for doc in data:
                try:
                    # Timestamp ekle/güncelle
                    if 'timestamp' not in doc:
                        doc['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
                    
                    # Source bilgisi ekle
                    if 'source' not in doc:
                        doc['source'] = 'json_import'
                    
                    # MongoDB'ye ekle
                    collection.insert_one(doc)
                    imported_count += 1
                    
                except Exception as e:
                    print(f"    Doküman ekleme hatası: {e}")
                    continue
            
            print(f"  ✅ {imported_count} doküman başarıyla eklendi")
            total_imported += imported_count
            
        except Exception as e:
            print(f"  ❌ {json_file} işlenirken hata: {e}")
            continue
    
    print(f"\n🎉 Toplam {total_imported} doküman MongoDB'ye aktarıldı")
    
    # Son durum raporu
    print("\n📊 Veritabanı durumu:")
    collections = db.list_collection_names()
    for col_name in sorted(collections):
        count = db[col_name].count_documents({})
        print(f"  {col_name}: {count} doküman")
    
    client.close()

if __name__ == "__main__":
    print("JSON dosyalarını MongoDB'ye aktarma işlemi başlatılıyor...")
    import_json_to_mongodb()
    print("İşlem tamamlandı!") 