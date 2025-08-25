const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection string - buraya Atlas connection string'inizi yazın
const MONGODB_URI = 'mongodb+srv://commercelens:PASSWORD@commercelens-prod.xxxxx.mongodb.net/ecommerce_analytics';

async function migrateDataToMongoDB() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB Atlas\'a bağlandı');
    
    const db = client.db('ecommerce_analytics');
    
    // data/reviews klasöründeki tüm JSON dosyalarını oku
    const reviewsDir = path.join(__dirname, '../data/reviews');
    const files = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json'));
    
    console.log(`📁 ${files.length} adet JSON dosyası bulundu`);
    
    for (const file of files) {
      try {
        const filePath = path.join(reviewsDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const reviews = JSON.parse(rawData);
        
        if (Array.isArray(reviews) && reviews.length > 0) {
          // Collection adını dosya adından al
          const collectionName = file.replace('.json', '');
          const collection = db.collection(collectionName);
          
          // Mevcut verileri temizle (opsiyonel)
          await collection.deleteMany({});
          
          // Yeni verileri ekle
          const result = await collection.insertMany(reviews);
          console.log(`✅ ${collectionName}: ${result.insertedCount} kayıt eklendi`);
        }
      } catch (error) {
        console.error(`❌ ${file} işlenirken hata:`, error.message);
      }
    }
    
    console.log('🎉 Tüm veriler MongoDB Atlas\'a aktarıldı!');
    
    // Toplam istatistikleri göster
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Veritabanı İstatistikleri:');
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} kayıt`);
    }
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
  } finally {
    await client.close();
  }
}

// Script'i çalıştır
migrateDataToMongoDB().catch(console.error);
