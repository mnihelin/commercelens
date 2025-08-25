import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

interface AnalysisHistory {
  _id: string;
  collectionName: string;
  platformInfo: {
    platforms: string[];
    products: string[];
  };
  reviewCount: number;
  analyzedComments: number;
  result: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const { product1, product2 } = await request.json();

    if (!product1 || !product2) {
      return NextResponse.json(
        { success: false, error: 'İki ürün seçimi gerekli' },
        { status: 400 }
      );
    }

    // Ürün bilgilerini hazırla
    const product1Info = {
      name: product1.platformInfo?.products?.[0] || product1.collectionName,
      platform: product1.platformInfo?.platforms?.[0] || 'Bilinmeyen Platform',
      commentCount: product1.analyzedComments,
      analysis: product1.result
    };

    const product2Info = {
      name: product2.platformInfo?.products?.[0] || product2.collectionName,
      platform: product2.platformInfo?.platforms?.[0] || 'Bilinmeyen Platform',
      commentCount: product2.analyzedComments,
      analysis: product2.result
    };

    // Gemini API çağrısı
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    const prompt = `
İki farklı ürünün AI analiz sonuçlarını karşılaştırarak hangi ürünün daha iyi olduğunu belirle:

ÜRÜN 1:
İsim: ${product1Info.name}
Platform: ${product1Info.platform}
Analiz Edilen Yorum: ${product1Info.commentCount}
AI Analiz Sonucu:
${product1Info.analysis}

ÜRÜN 2:
İsim: ${product2Info.name}
Platform: ${product2Info.platform}
Analiz Edilen Yorum: ${product2Info.commentCount}
AI Analiz Sonucu:
${product2Info.analysis}

Lütfen şu formatta karşılaştırma yap:

🏆 KAZANAN ÜRÜN: [Ürün adı]

📊 KARŞILAŞTIRMA ANALİZİ:

1. 🔥 Güçlü Yönler Karşılaştırması:
   • ${product1Info.name}: [güçlü yönleri]
   • ${product2Info.name}: [güçlü yönleri]

2. ⚠️ Zayıf Yönler Karşılaştırması:
   • ${product1Info.name}: [zayıf yönleri]
   • ${product2Info.name}: [zayıf yönleri]

3. 💭 Müşteri Memnuniyeti:
   • ${product1Info.name}: [müşteri görüşleri özeti]
   • ${product2Info.name}: [müşteri görüşleri özeti]

4. 💡 Hangi Ürün Daha İyi ve Neden:
   [Detaylı açıklama]

5. 🎯 Öneriler:
   • ${product1Info.name} için: [iyileştirme önerileri]
   • ${product2Info.name} için: [iyileştirme önerileri]

6. 🤔 Son Karar:
   [Hangi ürünün hangi durumda tercih edilmesi gerektiği]

Objektif ve detaylı bir karşılaştırma yap. Türkçe yanıt ver.
`;

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
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 3000,
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

    const comparisonText = geminiData.candidates[0].content.parts[0].text;

    // Ürün benchmark sonucunu analiz geçmişine kaydet
    try {
      const client = await clientPromise;
      const db = client.db('ecommerce_analytics');
      const historyCollection = db.collection('analysis_history');
      
      const benchmarkRecord = {
        collectionName: `Ürün Benchmark: ${product1Info.name} vs ${product2Info.name}`,
        platformInfo: {
          platforms: [product1Info.platform, product2Info.platform],
          products: [product1Info.name, product2Info.name]
        },
        reviewCount: product1Info.commentCount + product2Info.commentCount,
        analyzedComments: product1Info.commentCount + product2Info.commentCount,
        result: comparisonText,
        timestamp: new Date().toISOString(),
        createdAt: new Date(),
        analysisType: 'product_benchmark' // Yeni alan: analiz tipi
      };
      
      await historyCollection.insertOne(benchmarkRecord);
      console.log('Product benchmark saved to history successfully');
    } catch (saveError) {
      console.error('Product benchmark history save error:', saveError);
      // Geçmiş kaydetme hatası ana analizi etkilemesin
    }

    return NextResponse.json({
      success: true,
      comparison: comparisonText,
      products: {
        product1: product1Info,
        product2: product2Info
      }
    });

  } catch (error) {
    console.error('Product benchmark API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Karşılaştırma sırasında hata oluştu: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 