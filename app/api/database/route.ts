import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { getCollections, getReviews, getStorageStats } from '../../../lib/localDataStorage';

export async function GET(request: NextRequest) {
  try {
    // Önce MongoDB'i dene
    let useLocalStorage = false;
    let client: any, db: any;
    
    try {
      if (process.env.MONGODB_URI) {
        client = await clientPromise;
        db = client.db('ecommerce_analytics');
        // MongoDB bağlantısını test et
        await db.admin().ping();
      } else {
        useLocalStorage = true;
      }
    } catch (mongoError: any) {
      console.log('MongoDB bağlantısı yok, local storage kullanılıyor:', mongoError.message);
      useLocalStorage = true;
    }

    if (useLocalStorage) {
      // Local storage'ı kullan
      const collections = await getCollections();
      const stats = await getStorageStats();
      
      const databaseStats = {
        collections: collections.map(col => ({
          name: col.name,
          type: 'json_file',
          documentCount: col.document_count,
          sampleDocuments: [], // İhtiyaç halinde getReviews(col.name) ile doldurulabilir
          platformStats: { [col.platform]: { count: col.document_count } },
          productStats: [{ _id: col.product_name, count: col.document_count, platform: col.platform }]
        })),
        totalDocuments: stats.total_reviews,
        totalSize: stats.total_collections
      };

      return NextResponse.json({
        success: true,
        database: 'local_storage',
        stats: databaseStats,
        timestamp: new Date().toISOString(),
        source: 'local_files'
      });
    }
    
    // Tüm koleksiyonları listele
    if (!db) throw new Error("Database not available");
    const collections = await db.listCollections().toArray();
    
    const databaseStats = {
      collections: [] as any[],
      totalDocuments: 0,
      totalSize: 0
    };

    // Her koleksiyon için istatistikleri al
    for (const collection of collections) {
      try {
        const collectionObj = db.collection(collection.name);
        const documentCount = await collectionObj.countDocuments();
        
        // Tüm dokümanları al (performans için maksimum 1000)
        const sampleDocs = await collectionObj
          .find({})
          .sort({ timestamp: -1 })
          .limit(1000)
          .toArray();

        // Platform bazlı istatistikler
        let platformStats = {};
        if (collection.name.includes('reviews')) {
          const platforms = await collectionObj.aggregate([
            {
              $group: {
                _id: '$platform',
                count: { $sum: 1 },
                latestTimestamp: { $max: '$timestamp' }
              }
            }
          ]).toArray();
          
          platformStats = platforms.reduce((acc, item) => {
            acc[item._id || 'unknown'] = {
              count: item.count,
              latestTimestamp: item.latestTimestamp
            };
            return acc;
          }, {});
        }

        // Ürün bazlı istatistikler
        let productStats = {};
        if (collection.name.includes('reviews')) {
          const products = await collectionObj.aggregate([
            {
              $group: {
                _id: '$product_name',
                count: { $sum: 1 },
                platform: { $first: '$platform' },
                latestTimestamp: { $max: '$timestamp' }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]).toArray();
          
          productStats = products;
        }

        databaseStats.collections.push({
          name: collection.name,
          type: collection.type,
          documentCount,
          sampleDocuments: sampleDocs,
          platformStats,
          productStats
        });

        databaseStats.totalDocuments += documentCount;
      } catch (error) {
        console.error(`Error processing collection ${collection.name}:`, error);
        databaseStats.collections.push({
          name: collection.name,
          type: collection.type,
          documentCount: 0,
          error: 'Erişim hatası'
        });
      }
    }

    return NextResponse.json({
      success: true,
      database: 'ecommerce_analytics',
      stats: databaseStats,
      timestamp: new Date().toISOString(),
      source: 'mongodb'
    });

  } catch (error) {
    console.error('Database API Error:', error);
    
    // Son çare olarak local storage'ı dene
    try {
      const collections = await getCollections();
      const stats = await getStorageStats();
      
      const databaseStats = {
        collections: collections.map(col => ({
          name: col.name,
          type: 'json_file',
          documentCount: col.document_count,
          sampleDocuments: [],
          platformStats: { [col.platform]: { count: col.document_count } },
          productStats: [{ _id: col.product_name, count: col.document_count, platform: col.platform }]
        })),
        totalDocuments: stats.total_reviews,
        totalSize: stats.total_collections
      };

      return NextResponse.json({
        success: true,
        database: 'local_storage_fallback',
        stats: databaseStats,
        timestamp: new Date().toISOString(),
        source: 'local_files_fallback'
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { success: false, error: 'Veritabanı bilgileri alınırken hata oluştu' },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const collectionName = searchParams.get('collection');

    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');

    if (action === 'collection' && collectionName) {
      // Belirli koleksiyonu sil
      await db.collection(collectionName).drop();
      
      return NextResponse.json({
        success: true,
        message: `${collectionName} koleksiyonu silindi`
      });
    } else if (action === 'all') {
      // Tüm koleksiyonları sil
      if (!db) throw new Error("Database not available");
    const collections = await db.listCollections().toArray();
      
      for (const collection of collections) {
        try {
          await db.collection(collection.name).drop();
        } catch (error) {
          console.error(`Error dropping collection ${collection.name}:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Tüm koleksiyonlar silindi'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz parametreler' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Database DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu' },
      { status: 500 }
    );
  }
} 