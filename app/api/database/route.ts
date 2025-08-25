import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');
    
    // Tüm koleksiyonları listele
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
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Veritabanı bilgileri alınırken hata oluştu' },
      { status: 500 }
    );
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