import { NextRequest, NextResponse } from 'next/server';
import { getReviews, deleteCollection } from '../../../lib/localDataStorage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productName = searchParams.get('productName');
    const platform = searchParams.get('platform');
    const collectionName = searchParams.get('collectionName');
    const limit = parseInt(searchParams.get('limit') || '50');

    let reviews;
    
    if (collectionName) {
      // Belirli koleksiyondan yorumları getir
      reviews = await getReviews(collectionName, undefined, limit);
    } else {
      // Platform veya ürün adına göre filtrele
      reviews = await getReviews(undefined, platform || undefined, limit);
      
      // Ürün adı filtresi varsa uygula
      if (productName) {
        reviews = reviews.filter(review => 
          review.product_name.toLowerCase().includes(productName.toLowerCase())
        );
      }
    }

    const totalCount = reviews.length;

    return NextResponse.json({
      success: true,
      reviews: reviews,
      total: totalCount,
      limit: limit,
      source: 'local_storage'
    });

  } catch (error) {
    console.error('Reviews API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Yorumlar getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collectionName');

    if (!collectionName) {
      return NextResponse.json(
        { success: false, error: 'Koleksiyon adı gerekli' },
        { status: 400 }
      );
    }

    const deleted = await deleteCollection(collectionName);
    
    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `${collectionName} koleksiyonu silindi`,
        deletedCollection: collectionName
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Koleksiyon bulunamadı veya silinemedi' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Delete Reviews API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Koleksiyon silinirken hata oluştu' },
      { status: 500 }
    );
  }
} 