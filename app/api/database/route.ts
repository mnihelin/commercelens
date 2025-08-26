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
      const debugInfo = {
        message: mongoError.message,
        code: mongoError.code,
        mongodbUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
        uriPrefix: process.env.MONGODB_URI?.substring(0, 20) || 'N/A',
        uriLength: process.env.MONGODB_URI?.length || 0,
        geminiKeyExists: !!process.env.GOOGLE_GEMINI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      };
      console.error('MongoDB bağlantı hatası:', debugInfo);
      
      // Debug bilgilerini error response'a ekle
      return NextResponse.json({
        success: false,
        error: 'MongoDB bağlantı hatası',
        debug: debugInfo,
        mongoError: mongoError.message
      }, { status: 500 });
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
          sampleDocuments: [],
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

    if (!db) throw new Error("Database not available");
    const collections = await db.listCollections().toArray();
    
    const databaseStats = {
      collections: [] as any[],
      totalDocuments: 0,
      totalSize: 0
    };

    // Her koleksiyon için istatistikleri topla
    for (const collection of collections) {
      try {
        const collectionName = collection.name;
        const coll = db.collection(collectionName);
        
        // Koleksiyon istatistikleri
        const documentCount = await coll.countDocuments();
        const sampleDocuments = await coll.find({}).limit(3).toArray();
        
        // Platform istatistikleri
        const platforms = await coll.aggregate([
          { $group: { _id: "$platform", count: { $sum: 1 }, latestTimestamp: { $max: "$timestamp" } } }
        ]).toArray();

        let platformStats: any = {};
        platformStats = platforms.reduce((acc: any, item: any) => {
          acc[item._id || 'unknown'] = {
            count: item.count,
            latestTimestamp: item.latestTimestamp
          };
          return acc;
        }, {});

        // Ürün istatistikleri
        const products = await coll.aggregate([
          { 
            $group: { 
              _id: "$product_name", 
              count: { $sum: 1 }, 
              platform: { $first: "$platform" },
              avgRating: { $avg: { $toDouble: "$rating" } }
            } 
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray();

        databaseStats.collections.push({
          name: collectionName,
          type: collection.type || 'collection',
          documentCount,
          sampleDocuments: sampleDocuments.map((doc: any) => ({
            id: doc._id,
            platform: doc.platform,
            product_name: doc.product_name,
            timestamp: doc.timestamp
          })),
          platformStats,
          productStats: products
        });

        databaseStats.totalDocuments += documentCount;
      } catch (collectionError) {
        console.error(`Error processing collection ${collection.name}:`, collectionError);
      }
    }

    return NextResponse.json({
      success: true,
      database: 'mongodb',
      stats: databaseStats,
      timestamp: new Date().toISOString(),
      source: 'mongodb_atlas'
    });

  } catch (error: any) {
    console.error('Database API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Veritabanı bilgileri alınırken hata oluştu' },
      { status: 500 }
    );
  }
}
