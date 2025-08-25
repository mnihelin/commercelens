import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '../../../lib/mongodb';

// GET - Analiz geçmişini getir (MongoDB'den)
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');
    const collection = db.collection('analysis_history');
    
    // Son 50 analizi getir, en yeni önce
    const history = await collection
      .find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    // Veriyi history sayfasının beklediği formata çevir
    const formattedHistory = history.map((item: any) => ({
      _id: item._id.toString(),
      collectionName: item.collectionName || 'Bilinmeyen Koleksiyon',
      platformInfo: item.platformInfo || { platforms: [], products: [] },
      reviewCount: item.reviewCount || 0,
      analyzedComments: item.analyzedComments || 0,
      result: item.result || '',
      timestamp: item.timestamp || item.createdAt?.toISOString() || new Date().toISOString(),
      analysisType: item.analysisType || 'general_analysis'
    }));
    
    return NextResponse.json({
      success: true,
      history: formattedHistory,
      count: formattedHistory.length,
      source: 'mongodb'
    });
    
  } catch (error) {
    console.error('Analysis history fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Analiz geçmişi alınamadı'
    }, { status: 500 });
  }
}

// POST - Yeni analiz kaydet (MongoDB'ye)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionName, platformInfo, reviewCount, analyzedComments, result, analysisType } = body;
    
    if (!collectionName || !result) {
      return NextResponse.json({
        success: false,
        error: 'Eksik parametreler'
      }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');
    const collection = db.collection('analysis_history');
    
    const analysisRecord = {
      collectionName,
      platformInfo: platformInfo || { platforms: [], products: [] },
      reviewCount: reviewCount || 0,
      analyzedComments: analyzedComments || 0,
      result,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
      analysisType: analysisType || 'general_analysis',
      analysisVersion: '5.0'
    };
    
    const insertResult = await collection.insertOne(analysisRecord);
    
    return NextResponse.json({
      success: true,
      analysisId: insertResult.insertedId.toString(),
      message: 'Analiz başarıyla kaydedildi',
      source: 'mongodb'
    });
    
  } catch (error) {
    console.error('Analysis save error:', error);
    return NextResponse.json({
      success: false,
      error: 'Analiz kaydedilemedi'
    }, { status: 500 });
  }
}

// DELETE - Analiz sil (MongoDB'den)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');
    
    if (!analysisId) {
      return NextResponse.json({
        success: false,
        error: 'Analiz ID gerekli'
      }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('ecommerce_analytics');
    const collection = db.collection('analysis_history');
    
    // ObjectId formatında arama yap
    let deleteResult;
    try {
      deleteResult = await collection.deleteOne({ _id: new ObjectId(analysisId) });
    } catch (objectIdError) {
      // Eğer ObjectId formatında değilse string olarak dene
      deleteResult = await collection.deleteOne({ _id: analysisId as any });
    }
    
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Analiz bulunamadı'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Analiz başarıyla silindi',
      deletedId: analysisId,
      source: 'mongodb'
    });
    
  } catch (error) {
    console.error('Analysis delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Analiz silinemedi'
    }, { status: 500 });
  }
} 