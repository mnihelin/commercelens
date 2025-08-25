interface Review {
  _id: string;
  platform: string;
  product_name: string;
  comment: string;
  timestamp: string;
  product_url: string;
}

interface ReviewsListProps {
  reviews: Review[];
  onDeleteProduct: (productName: string) => void;
}

export default function ReviewsList({ reviews, onDeleteProduct }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-gray-400">📝</span>
        </div>
        <h3 className="text-xl font-bold text-gray-700 mb-3">
          Henüz yorum bulunamadı
        </h3>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
          Ürün linkini yukarıda girerek yorum çekmeye başlayın ve değerli müşteri görüşlerini analiz edin.
        </p>
        <div className="mt-6 flex justify-center items-center gap-2 text-sm text-gray-400">
          <span>💡</span>
          <span>İpucu: Popüler ürünlerin daha fazla yorumu olur</span>
        </div>
      </div>
    );
  }

  // Ürünlere göre gruplama
  const groupedReviews = reviews.reduce((acc, review) => {
    const productName = review.product_name || 'Bilinmeyen Ürün';
    if (!acc[productName]) {
      acc[productName] = [];
    }
    acc[productName].push(review);
    return acc;
  }, {} as Record<string, Review[]>);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="divide-y divide-gray-200/50">
      {/* Header */}
      <div className="p-8 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-xl">📊</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Yorum Analizi
            </h2>
            <p className="text-sm text-gray-600">
              Ürün yorumlarınızı aşağıda inceleyebilirsiniz
            </p>
          </div>
        </div>
      </div>

      {/* Reviews by Product */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(groupedReviews).map(([productName, productReviews]) => (
          <div key={productName} className="border-b border-gray-100 last:border-b-0">
            {/* Product Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-lg p-6 border-b border-gray-200/50 flex justify-between items-center hover:bg-white/95 transition-all duration-300">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-2">
                  {productName}
                </h3>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                    <span>📝</span>
                    <span className="font-medium text-blue-700">{productReviews.length} yorum</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full">
                    <span>🏪</span>
                    <span className="font-medium text-purple-700">{productReviews[0].platform}</span>
                  </div>
                  {productReviews[0].product_url && (
                    <a
                      href={productReviews[0].product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
                    >
                      <span>🔗</span>
                      <span>Ürüne Git</span>
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDeleteProduct(productName)}
                className="ml-6 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 hover:scale-105 transition-all duration-300 font-medium shadow-sm"
              >
                🗑️ Sil
              </button>
            </div>

            {/* Reviews for this product - İlk 3 Yorum */}
            <div className="divide-y divide-gray-100/50">
              {productReviews.slice(0, 3).map((review, index) => (
                <div key={review._id} className="p-6 hover:bg-gray-50/50 transition-colors duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-700 leading-relaxed text-sm bg-gray-50/50 rounded-lg p-3">
                        {review.comment?.substring(0, 150)}
                        {review.comment && review.comment.length > 150 && (
                          <span className="text-gray-400">...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <span>🕒</span>
                        <span>{formatDate(review.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {productReviews.length > 3 && (
                <div className="p-4 text-center bg-gradient-to-r from-gray-50 to-blue-50">
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-sm text-xs">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    <span className="text-gray-600 font-medium">
                      + {productReviews.length - 3} yorum daha
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 