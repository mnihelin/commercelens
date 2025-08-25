import { NextRequest, NextResponse } from 'next/server';
import { getReviews, saveAnalysis, AnalysisData } from '../../../lib/localDataStorage';

export async function POST(request: NextRequest) {
  try {
    const { collectionName } = await request.json();

    if (!collectionName) {
      return NextResponse.json(
        { success: false, error: 'Koleksiyon adı gerekli' },
        { status: 400 }
      );
    }

    // Local storage'dan yorumları al
    const allReviews = await getReviews(collectionName, undefined, 1000);

    if (allReviews.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bu koleksiyonda yorum bulunamadı' },
        { status: 404 }
      );
    }

    // Tüm yorumları kullan (rastgele karıştır)
    const shuffled = allReviews.sort(() => 0.5 - Math.random());
    const reviews = shuffled;

    // Platform ve ürün bilgilerini topla
    const platformInfo = reviews.reduce((acc: { platforms: string[], products: string[] }, review: any) => {
      if (review.platform && !acc.platforms.includes(review.platform)) {
        acc.platforms.push(review.platform);
      }
      if (review.product_name && !acc.products.includes(review.product_name)) {
        acc.products.push(review.product_name);
      }
      return acc;
    }, { platforms: [], products: [] });

    // Yorumları birleştir - Tüm yorumları analiz et
    const commentTexts = reviews
      .map(review => review.comment)
      .filter(comment => comment && comment.trim().length > 10);

    // Gemini API çağrısı
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    const magaza_adi = platformInfo.platforms.join(', ') || 'E-ticaret Platform';
    const urun_bilgisi = platformInfo.products.slice(0, 3).join(', ') || 'Çeşitli Ürünler';

    const prompt = `
Aşağıdaki "${magaza_adi}" mağazasına ait müşteri yorumlarını analiz et ve şu başlıklarda içgörü üret:

Koleksiyon: ${collectionName}
Ürünler: ${urun_bilgisi}
Toplam Analiz Edilen Yorum: ${commentTexts.length}

Yorumlar:
${commentTexts.length > 200 
  ? `${commentTexts.slice(0, 200).join('\n---\n')}\n\n[Ve ${commentTexts.length - 200} yorum daha analiz edildi...]` 
  : commentTexts.join('\n---\n')}

Lütfen şu formatta analiz yap:

1. 🔴 Negatif Temalar:
2. 🟢 Pozitif Temalar:
3. 🧩 Temel Nedenler:
4. 💡 Aksiyon Önerileri:
5. 🧠 İçgörü Başlığı (kısa ve vurucu):

Her başlık altında en az 2-3 madde olsun ve Türkçe yanıtla.
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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8000,
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

    const analysisText = geminiData.candidates[0].content.parts[0].text;

    const analysisResult = {
      collectionName,
      platformInfo,
      reviewCount: allReviews.length,
      analyzedComments: commentTexts.length,
      result: analysisText,
      timestamp: new Date().toISOString(),
      source: 'local_storage'
    };

    // Analizi geçmişe kaydet
    try {
      const historyRecord: AnalysisData = {
        id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        collection_name: collectionName,
        platform_info: platformInfo,
        review_count: allReviews.length,
        analyzed_comments: commentTexts.length,
        result: analysisText,
        timestamp: new Date().toISOString(),
        analysis_type: 'general_analysis',
        analysis_version: '4.0'
      };
      
      await saveAnalysis(historyRecord);
      console.log('Analysis saved to local storage successfully');
    } catch (saveError) {
      console.error('Analysis history save error:', saveError);
      // Geçmiş kaydetme hatası ana analizi etkilemesin
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult
    });

  } catch (error) {
    console.error('Analysis API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Analiz sırasında hata oluştu: ' + (error as Error).message },
      { status: 500 }
    );
  }
}