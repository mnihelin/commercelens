import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

export async function POST(request: NextRequest) {
  let collectionName = '';
  try {
    const requestData = await request.json();
    collectionName = requestData.collectionName;

    if (!collectionName) {
      return NextResponse.json(
        { success: false, error: 'Koleksiyon adı gerekli' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');
    const collection = db.collection(collectionName);

    // Toplam yorum sayısını kontrol et
    const totalCount = await collection.countDocuments();
    if (totalCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Bu koleksiyonda yorum bulunamadı' },
        { status: 404 }
      );
    }

    // Satıcı bilgilerini çıkarmak için yorumları analiz et
    const comments = await collection
      .find({})
      .limit(500)
      .toArray();

    // Satıcı verilerini çıkar
    const sellers = extractSellerData(comments);

    if (sellers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bu yorumlarda satıcı bilgisi bulunamadı' },
        { status: 404 }
      );
    }

    // EN UCUZ ve EN YÜKSEK RATİNG SATICIYI BUL
    const analysisData = findBestSellers(sellers);

    // Gemini API ile basit karşılaştırma analizi
    const geminiApiKey = "AIzaSyBsX6W8CG3autBHfV3IcD8oA5j_yDM8EfQ";
    
    const prompt = `
${collectionName} koleksiyonundaki satıcı benchmark analizi yapılacak:

**🏆 EN YÜKSEK RATİNG ALAN SATICI:**
Satıcı: ${analysisData.highestRating.name}
Platform: ${analysisData.highestRating.platform}
Rating: ${analysisData.highestRating.averageRating}/5.0
Fiyat: ${analysisData.highestRating.averagePrice} TL
Yorum Sayısı: ${analysisData.highestRating.totalComments}

**💰 EN UCUZ FİYAT SUNAN SATICI:**
Satıcı: ${analysisData.cheapest.name}
Platform: ${analysisData.cheapest.platform}
Rating: ${analysisData.cheapest.averageRating}/5.0
Fiyat: ${analysisData.cheapest.averagePrice} TL
Yorum Sayısı: ${analysisData.cheapest.totalComments}

**📊 DİĞER SATICILAR:**
${sellers.slice(0, 5).map((seller, index) => `${index + 1}. ${seller.name} - Rating: ${seller.averageRating}/5.0 - Fiyat: ${seller.averagePrice} TL`).join('\n')}

Lütfen şu formatta PROFESYONEL ve ŞIK bir TÜRKÇE analiz yap:

# 🎯 SATICI KARŞILAŞTIRMA ANALİZİ

*Bu analiz ${sellers.length} farklı satıcının ${totalCount} yorum verisine dayanmaktadır.*

## 🏆 En Yüksek Rating Performansı
**Satıcı:** ${analysisData.highestRating.name}  
**Rating:** ${analysisData.highestRating.averageRating}/5.0  
**Fiyat:** ${analysisData.highestRating.averagePrice} TL  
**Güçlü Yanlar:** [profesyonel açıklama]  
**Zayıf Yanlar:** [kısa açıklama]

## 💰 En Uygun Fiyat Performansı
**Satıcı:** ${analysisData.cheapest.name}  
**Fiyat:** ${analysisData.cheapest.averagePrice} TL  
**Rating:** ${analysisData.cheapest.averageRating}/5.0  
**Güçlü Yanlar:** [profesyonel açıklama]  
**Zayıf Yanlar:** [kısa açıklama]

## 🤔 KARŞILAŞTIRMA
**Fiyat Farkı:** [${analysisData.highestRating.averagePrice} - ${analysisData.cheapest.averagePrice}] TL  
**Rating Farkı:** [${analysisData.highestRating.averageRating} - ${analysisData.cheapest.averageRating}] puan  
**Müşteri Tipi Uygunluğu:** [hangi müşteri tipine hangisi uygun - profesyonel öneri]

## 💡 ÖNERİLER
**Bütçe Odaklı Müşteri:** [tek cümle net öneri]  
**Kalite Odaklı Müşteri:** [tek cümle net öneri]  
**Optimal Seçim:** [en dengeli seçenek önerisi]

SADECE anlamlı bilgileri ver. Kısa, öz ve profesyonel ol.
`;

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API hatası: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Gemini API\'dan geçersiz yanıt alındı');
    }

    const analysis = geminiData.candidates[0].content.parts[0].text;

    // Platform bilgilerini topla
    const platformSet = new Set(comments.map(c => c.platform).filter(Boolean));
    const platforms = Array.from(platformSet);
    
    // Analizi geçmişe kaydet
    const finalAnalysisData = {
      collectionName,
      type: 'simple_price_rating_benchmark',
      platformInfo: {
        platforms: platforms,
        products: [collectionName.replace('_reviews_', ' - ').replace(/_/g, ' ')]
      },
      reviewCount: totalCount,
      analyzedComments: comments.length,
      sellersAnalyzed: sellers.length,
      totalComments: totalCount,
      highestRatingSeller: analysisData.highestRating,
      cheapestSeller: analysisData.cheapest,
      result: analysis,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
      analysisType: 'seller_benchmark', // Yeni alan: analiz tipi
      analysisVersion: '3.0'
    };

    await db.collection('analysis_history').insertOne(finalAnalysisData);

    return NextResponse.json({
      success: true,
      collectionName,
      analysis,
      highestRatingSeller: analysisData.highestRating,
      cheapestSeller: analysisData.cheapest,
      totalComments: totalCount,
      sellersAnalyzed: sellers.length
    });

  } catch (error) {
    console.error('Benchmark API Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      collection: collectionName
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Benchmark analizi sırasında hata oluştu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// EN UCUZ ve EN YÜKSEK RATİNG SATICIYI BULAN FONKSİYON
function findBestSellers(sellers: any[]) {
  if (sellers.length === 0) {
    return { highestRating: null, cheapest: null };
  }

  // En yüksek rating (likes_count en yüksek olan)
  const highestRating = sellers.reduce((prev, current) => {
    const prevRating = prev.averageRating || 0;
    const currentRating = current.averageRating || 0;
    return currentRating > prevRating ? current : prev;
  });

  // En ucuz (ortalama fiyat en düşük olan)
  const cheapest = sellers.reduce((prev, current) => {
    const prevPrice = prev.averagePrice || Infinity;
    const currentPrice = current.averagePrice || Infinity;
    return currentPrice < prevPrice ? current : prev;
  });

  return { highestRating, cheapest };
}

// Yorumlardan satıcı verilerini çıkar - BASİT VERSİYON
function extractSellerData(comments: any[]) {
  const sellerMap = new Map();

  comments.forEach(comment => {
    const text = comment.comment || '';
    const platform = comment.platform || '';
    const dbLikesCount = comment.likes_count || 0;
    const productPrice = comment.product_price || null;
    
    // Basit satıcı tespiti
    let sellerName = 'Bilinmeyen Satıcı';
    
    if (platform === 'Trendyol') {
      const trendyolMatch = text.match(/(.+?)\s+satıcısından\s+alındı/i);
      if (trendyolMatch) {
        sellerName = trendyolMatch[1].trim();
      } else {
        sellerName = 'Trendyol';
      }
    } else if (platform === 'Hepsiburada') {
      const hepsiMatch = text.match(/Satıcı:\s*(.+?)[\n\r]/i);
      if (hepsiMatch) {
        sellerName = hepsiMatch[1].trim();
      } else {
        sellerName = 'Hepsiburada';
      }
    }

    // Satıcı verilerini topla
    if (!sellerMap.has(sellerName)) {
      sellerMap.set(sellerName, {
        name: sellerName,
        totalComments: 0,
        totalLikes: 0,
        totalPrice: 0,
        priceCount: 0,
        platform: platform
      });
    }

    const seller = sellerMap.get(sellerName);
    seller.totalComments++;
    seller.totalLikes += dbLikesCount;
    
    if (productPrice && productPrice > 0) {
      seller.totalPrice += productPrice;
      seller.priceCount++;
    }
  });

  // Ortalama değerleri hesapla
  const sellers = Array.from(sellerMap.values()).map(seller => ({
    name: seller.name,
    platform: seller.platform,
    totalComments: seller.totalComments,
    averageRating: seller.totalComments > 0 ? (seller.totalLikes / seller.totalComments / 10) : 0, // Rating'i /10 yap
    averagePrice: seller.priceCount > 0 ? (seller.totalPrice / seller.priceCount) : 0,
    totalLikes: seller.totalLikes,
    priceCount: seller.priceCount
  }));

  // Rating'e göre sırala
  return sellers
    .filter(seller => seller.totalComments >= 2) // En az 2 yorum olan satıcılar
    .sort((a, b) => b.averageRating - a.averageRating);
}