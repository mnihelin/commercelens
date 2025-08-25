import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { reviews, filterInfo } = await request.json();

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Analiz edilecek yorum bulunamadı' },
        { status: 400 }
      );
    }

    // Tüm yorumları analiz et (limit yok)
    const reviewsToAnalyze = reviews;

    // Platform ve ürün bilgilerini topla
    const platformInfo = reviewsToAnalyze.reduce((acc: { platforms: string[], products: string[] }, review: any) => {
      if (review.platform && !acc.platforms.includes(review.platform)) {
        acc.platforms.push(review.platform);
      }
      if (review.product_name && !acc.products.includes(review.product_name)) {
        acc.products.push(review.product_name);
      }
      return acc;
    }, { platforms: [], products: [] });

    // Yorumları birleştir (tüm yorumlar)
    const commentTexts = reviewsToAnalyze
      .map(review => review.comment)
      .filter(comment => comment && comment.trim().length > 10);

    if (commentTexts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Analiz edilebilir yorum bulunamadı' },
        { status: 400 }
      );
    }

    // Gemini API çağrısı
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    const magaza_adi = platformInfo.platforms.join(', ') || 'E-ticaret Platform';
    const urun_bilgisi = platformInfo.products.slice(0, 3).join(', ') || 'Çeşitli Ürünler';

    const filterSummary = Object.entries(filterInfo || {})
      .filter(([key, value]) => value && value !== 'all' && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ') || 'Filtre uygulanmamış';

    // Dinamik başlık oluştur - seçilen ilk iki filtreyi kullan
    const activeFilters = Object.entries(filterInfo || {})
      .filter(([key, value]) => value && value !== 'all' && value !== '')
      .slice(0, 2); // İlk iki filtreyi al
    
    let dynamicTitle = 'Filtrelenmiş Analiz';
    if (activeFilters.length > 0) {
      const filterValues = activeFilters.map(([key, value]) => {
        const strValue = String(value);
        // Platform filtresi için özel işlem
        if (key === 'platform') {
          return strValue.charAt(0).toUpperCase() + strValue.slice(1);
        }
        // Product name için kısaltma
        if (key === 'productName' && strValue.length > 30) {
          return strValue.substring(0, 30) + '...';
        }
        return strValue;
      });
      dynamicTitle = filterValues.join(' - ');
    }

    const prompt = `
Aşağıdaki "${magaza_adi}" platformlarından "${urun_bilgisi}" ürünlerine ait müşteri yorumlarını analiz et:

📊 **ANALİZ BİLGİLERİ:**
- Platform(lar): ${magaza_adi}
- Ürün(ler): ${urun_bilgisi}
- Analiz Edilen Yorum: ${commentTexts.length}
- Toplam Filtrelenmiş Yorum: ${reviews.length}
- Uygulanan Filtreler: ${filterSummary}

🔍 **YORUMLAR:**
${commentTexts.length > 200 
  ? `${commentTexts.slice(0, 200).join('\n---\n')}\n\n[Ve ${commentTexts.length - 200} yorum daha analiz edildi...]` 
  : commentTexts.join('\n---\n')}

Lütfen şu formatta detaylı bir Türkçe analiz yap:

## 📊 Genel Durum
*Bu analiz ${commentTexts.length} yorumun incelenmesi sonucu hazırlanmıştır.*

## 🔴 Negatif Temalar
• [Ana şikayet konuları]
• [Müşteri memnuniyetsizlik nedenleri]
• [Tekrarlanan problemler]

## 🟢 Pozitif Temalar
• [Müşterilerin memnun olduğu özellikler]
• [Övgü aldığı konular]
• [Güçlü yanları]

## 🧩 Temel Nedenler
• [Problemlerin köken sebepleri]
• [Memnuniyetin ana faktörleri]
• [Tekrarlayan desenler]

## 💡 Aksiyon Önerileri
• [Kısa vadeli iyileştirmeler]
• [Uzun vadeli stratejiler]
• [Öncelikli müdahale alanları]

## 🧠 İçgörü Başlığı
**"[Kısa ve vurucu genel değerlendirme]"**

## 📈 Filtre Özel Değerlendirme
*Uygulanan filtreler (${filterSummary}) özelinde özel değerlendirme*

Her başlık altında en az 2-3 madde olsun ve Türkçe yanıtla. Filtrelenmiş verilere özel odaklan.
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
      filterInfo,
      platformInfo,
      reviewCount: reviews.length,
      analyzedComments: commentTexts.length,
      result: analysisText,
      timestamp: new Date().toISOString(),
      source: 'filtered_analysis'
    };

    // Analizi MongoDB'ye kaydet
    try {
      const client = await clientPromise;
      const db = client.db('ecommerce_analytics');
      
      const historyRecord = {
        collectionName: dynamicTitle,
        platformInfo,
        reviewCount: reviews.length,
        analyzedComments: commentTexts.length,
        result: analysisText,
        timestamp: new Date().toISOString(),
        createdAt: new Date(),
        analysisType: 'filtered_analysis',
        analysisVersion: '5.0',
        filterInfo,
        totalReviewsAnalyzed: commentTexts.length
      };
      
      await db.collection('analysis_history').insertOne(historyRecord);
      console.log('Filtered analysis saved to MongoDB successfully');
    } catch (saveError) {
      console.error('Filtered analysis save error:', saveError);
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult
    });

  } catch (error) {
    console.error('Filtered Analysis API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Analiz sırasında hata oluştu: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 