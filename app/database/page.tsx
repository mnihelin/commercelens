'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';

interface Review {
  _id: string;
  platform: string;
  product_name: string;
  comment: string;
  comment_date?: string;
  timestamp: string;
  rating?: number;
  price?: number;
  product_price?: number;
  created_at?: string;
  likes_count?: number;
}

interface Collection {
  name: string;
  type?: string;
  documentCount: number;
  sampleDocuments?: Review[];
  platformStats?: any;
  productStats?: any;
  error?: string;
}

interface DatabaseStats {
  collections: Collection[];
  totalDocuments: number;
  totalSize: number;
}

interface StorageData {
  success: boolean;
  database: string;
  stats: DatabaseStats;
  timestamp: string;
  source: string;
}

export default function DatabasePage() {
  const { username } = useAuth();
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 20;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  
  // Yorum detay modal state'leri
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);
  
  // Filtre state'leri
  const [filters, setFilters] = useState({
    platform: 'all',
    productName: 'all',
    minPrice: '',
    maxPrice: '',
    minRating: 'all',
    maxRating: 'all',
    startDate: '',
    endDate: '',
    searchText: ''
  });

  // Geçici filtreler (kullanıcının seçtikleri ama henüz uygulanmayanlar)
  const [tempFilters, setTempFilters] = useState({
    platform: 'all',
    productName: 'all',
    minPrice: '',
    maxPrice: '',
    minRating: 'all',
    maxRating: 'all',
    startDate: '',
    endDate: '',
    searchText: ''
  });

  const loadStorageData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // MongoDB'den direkt veriyi al
      const response = await fetch('/api/database');
      const data = await response.json();
      
      if (data.success) {
        setStorageData(data);
        
        // Tüm koleksiyonlardan yorumları topla
        const allReviewsFromCollections: Review[] = [];
        
        for (const collection of data.stats.collections) {
          if (collection.sampleDocuments) {
            // Her koleksiyondan yorumları al
            allReviewsFromCollections.push(...collection.sampleDocuments);
          }
        }
        
        // Tarihe göre sırala (en yeni önce)
        allReviewsFromCollections.sort((a, b) => 
          new Date(b.timestamp || b.created_at || '').getTime() - 
          new Date(a.timestamp || a.created_at || '').getTime()
        );
        
        setAllReviews(allReviewsFromCollections);
        setFilteredReviews(allReviewsFromCollections);
      } else {
        setError(data.error || 'Bilinmeyen hata oluştu');
      }
    } catch (err) {
      setError('Ağ hatası oluştu');
      console.error('Database stats error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  // Sayfa yüklendiğinde tempFilters'ı filters ile senkronize et
  useEffect(() => {
    setTempFilters({ ...filters });
  }, []);

  useEffect(() => {
    // Gelişmiş filtreleme
    let filtered = allReviews;
    
    // Platform filtresi
    if (filters.platform !== 'all') {
      filtered = filtered.filter(review => 
        review.platform?.toLowerCase() === filters.platform.toLowerCase()
      );
    }
    
    // Ürün adı filtresi
    if (filters.productName !== 'all') {
      filtered = filtered.filter(review => 
        review.product_name?.toLowerCase().includes(filters.productName.toLowerCase())
      );
    }
    
    // Fiyat filtresi
    if (filters.minPrice !== '') {
      const minPrice = parseFloat(filters.minPrice);
      filtered = filtered.filter(review => 
        (review.price || review.product_price || 0) >= minPrice
      );
    }
    
    if (filters.maxPrice !== '') {
      const maxPrice = parseFloat(filters.maxPrice);
      filtered = filtered.filter(review => 
        (review.price || review.product_price || 0) <= maxPrice
      );
    }
    
    // Rating filtresi
    if (filters.minRating !== 'all') {
      const minRating = parseFloat(filters.minRating);
      filtered = filtered.filter(review => 
        (review.rating || 0) >= minRating
      );
    }
    
    if (filters.maxRating !== 'all') {
      const maxRating = parseFloat(filters.maxRating);
      filtered = filtered.filter(review => 
        (review.rating || 0) <= maxRating
      );
    }
    
    // Tarih filtresi
    if (filters.startDate !== '') {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(review => {
        const reviewDate = new Date(review.timestamp || review.created_at || '');
        return reviewDate >= startDate;
      });
    }
    
    if (filters.endDate !== '') {
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(review => {
        const reviewDate = new Date(review.timestamp || review.created_at || '');
        return reviewDate <= endDate;
      });
    }
    
    // Arama filtresi
    if (filters.searchText !== '') {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(review => 
        review.product_name?.toLowerCase().includes(searchLower) ||
        review.comment?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredReviews(filtered);
    setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
  }, [filters, allReviews]);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return '-';
    return `₺${price.toLocaleString('tr-TR')}`;
  };

  const formatRating = (rating: number | undefined) => {
    if (!rating) return '-';
    return rating.toString();
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      'hepsiburada': 'bg-orange-100 text-orange-800',
      'trendyol': 'bg-purple-100 text-purple-800',
      'n11': 'bg-blue-100 text-blue-800',
      'aliexpress': 'bg-red-100 text-red-800',
      'amazon': 'bg-yellow-100 text-yellow-800'
    };
    return colors[platform?.toLowerCase() as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPlatformIcon = (platform: string) => {
    const icons = {
      'hepsiburada': '🛍️',
      'trendyol': '🛒',
      'n11': '🏪',
      'aliexpress': '🌎',
      'amazon': '📦'
    };
    return icons[platform?.toLowerCase() as keyof typeof icons] || '📄';
  };

  // Sayfalama
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = filteredReviews.slice(indexOfFirstReview, indexOfLastReview);
  const totalPages = Math.ceil(filteredReviews.length / reviewsPerPage);

  const platforms = Array.from(new Set(allReviews.map(r => r.platform?.toLowerCase()).filter(Boolean)));
  const productNames = Array.from(new Set(allReviews.map(r => r.product_name).filter(Boolean)));
  
  const handleFilterChange = (filterName: string, value: string) => {
    setTempFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Filtreleri uygula
  const applyFilters = () => {
    setFilters({ ...tempFilters });
  };

  // Yorum detayını göster
  const showCommentDetail = (review: any) => {
    setSelectedComment(review);
    setShowCommentModal(true);
  };
  
  const clearFilters = () => {
    const defaultFilters = {
      platform: 'all',
      productName: 'all',
      minPrice: '',
      maxPrice: '',
      minRating: 'all',
      maxRating: 'all',
      startDate: '',
      endDate: '',
      searchText: ''
    };
    setTempFilters(defaultFilters);
    setFilters(defaultFilters);
  };

  const handleAnalyze = async () => {
    if (filteredReviews.length === 0) {
      alert('Analiz edilecek yorum bulunamadı!');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-filtered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviews: filteredReviews,
          filterInfo: filters
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setAnalysisResult(result.analysis);
        setShowAnalysisModal(true);
      } else {
        alert('Analiz hatası: ' + result.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analiz sırasında hata oluştu');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Veritabanı bilgileri yükleniyor...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <Sidebar />
          <div className="ml-64 p-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-red-800 mb-4">Hata Oluştu</h2>
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={loadStorageData}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Tekrar Dene
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Sidebar />
        
        <div className="ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📊 Veritabanı Yönetimi
              </h1>

            </div>



            {/* Gelişmiş Filtreler */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Platform */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                  <select
                    value={tempFilters.platform}
                    onChange={(e) => handleFilterChange('platform', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Tümü</option>
                    {platforms.map(platform => (
                      <option key={platform} value={platform}>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ürün Adı */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Adı</label>
                  <select
                    value={tempFilters.productName}
                    onChange={(e) => handleFilterChange('productName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Tümü</option>
                    {productNames.slice(0, 20).map(productName => (
                      <option key={productName} value={productName}>
                        {productName?.substring(0, 50)}{productName?.length > 50 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min Fiyat */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Fiyat (TL)</label>
                  <input
                    type="number"
                    value={tempFilters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Max Fiyat */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Fiyat (TL)</label>
                  <input
                    type="number"
                    value={tempFilters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    placeholder="999999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Min Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Rating</label>
                  <select
                    value={tempFilters.minRating}
                    onChange={(e) => handleFilterChange('minRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Tümü</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>

                {/* Max Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Rating</label>
                  <select
                    value={tempFilters.maxRating}
                    onChange={(e) => handleFilterChange('maxRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Tümü</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>

                {/* Başlangıç Tarihi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={tempFilters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Bitiş Tarihi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={tempFilters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Ürün/Yorum Arama */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ürün/Yorum Arama</label>
                <input
                  type="text"
                  value={tempFilters.searchText}
                  onChange={(e) => handleFilterChange('searchText', e.target.value)}
                  placeholder="Ürün adı veya yorum içeriğinde ara..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Butonlar */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={applyFilters}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  🔍 Filtrele
                </button>
                
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  🗑️ Temizle
                </button>
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || filteredReviews.length === 0}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isAnalyzing || filteredReviews.length === 0
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-purple-500 text-white hover:bg-purple-600 hover:scale-105 shadow-lg'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Analiz Ediliyor...
                    </>
                  ) : (
                    <>💜 Analiz Et ({filteredReviews.length} yorum)</>
                  )}
                </button>
              </div>
            </div>

            {/* Ana Tablo */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Platform
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ürün Adı
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Yorum
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Veri Çekim Tarihi
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rating
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fiyat
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Yorum Tarihi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentReviews.map((review, index) => (
                      <tr key={review._id || index} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{getPlatformIcon(review.platform)}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlatformColor(review.platform)}`}>
                              {review.platform || 'Bilinmiyor'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                            {review.product_name || 'Bilinmiyor'}
                          </div>
                        </td>
                                                                         <td className="px-6 py-4">
                          <button
                            onClick={() => showCommentDetail(review)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                          >
                            👁️ Görüntüle
                          </button>
                        </td>
                                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {formatDate(review.created_at || review.timestamp || '')}
                         </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatRating(review.rating)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatPrice(review.price || review.product_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {review.comment_date || formatDate(review.timestamp || review.created_at || '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama */}
              {totalPages > 1 && (
                <div className="bg-gray-50/80 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Önceki
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Sonraki
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{indexOfFirstReview + 1}</span>
                        {' '}-{' '}
                        <span className="font-medium">{Math.min(indexOfLastReview, filteredReviews.length)}</span>
                        {' '}arası, toplam{' '}
                        <span className="font-medium">{filteredReviews.length}</span>
                        {' '}sonuç
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          &#8249;
                        </button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          &#8250;
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Alt Bilgi */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Son güncelleme: {storageData ? formatDate(storageData.timestamp) : 'Bilinmiyor'} | 
                Kaynak: {storageData?.source || 'MongoDB'}
              </p>
            </div>
          </div>
        </div>

        {/* Analiz Sonucu Modal */}
        {showAnalysisModal && analysisResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">🎯 Filtrelenmiş Yorum Analizi</h2>
                    <p className="text-purple-100 mt-1">
                      {analysisResult.analyzedComments} yorum analiz edildi • {formatDate(analysisResult.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="text-white hover:text-purple-200 text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* İstatistikler */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysisResult.reviewCount}</div>
                    <div className="text-sm text-blue-500">Toplam Filtrelenmiş</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{analysisResult.analyzedComments}</div>
                    <div className="text-sm text-green-500">Analiz Edildi</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{analysisResult.platformInfo?.platforms?.length || 0}</div>
                    <div className="text-sm text-purple-500">Platform</div>
                  </div>
                </div>

                {/* Platform ve Ürün Bilgileri */}
                {analysisResult.platformInfo && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">📱 Platformlar:</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.platformInfo.platforms?.map((platform: string) => (
                            <span key={platform} className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(platform)}`}>
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">🎯 Ürünler:</h4>
                        <div className="text-sm text-gray-600">
                          {analysisResult.platformInfo.products?.slice(0, 3).join(', ') || 'Çeşitli ürünler'}
                          {analysisResult.platformInfo.products?.length > 3 && ' ve diğerleri...'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analiz Sonucu */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Analiz Sonucu</h3>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {analysisResult.result}
                    </div>
                  </div>
                </div>

                {/* Alt Butonlar */}
                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowAnalysisModal(false);
                      // History sayfasına yönlendir
                      window.location.href = '/history';
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    🔍 Analize Git
                  </button>
                  
                  <button
                    onClick={() => {
                      const text = `Filtrelenmiş Yorum Analizi\n\n${analysisResult.result}`;
                      navigator.clipboard.writeText(text);
                      alert('Analiz sonucu panoya kopyalandı!');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                  >
                    📋 Kopyala
                  </button>
                  
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    ✕ Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Yorum Detay Modal */}
        {showCommentModal && selectedComment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">💬 Yorum Detayı</h2>
                    <p className="text-blue-100 mt-1">
                      {selectedComment.product_name || 'Ürün bilgisi yok'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCommentModal(false)}
                    className="text-white hover:text-gray-200 transition-colors text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Yorum Bilgileri */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-2">📅 Tarih</h3>
                    <p className="text-gray-600">{selectedComment.comment_date || formatDate(selectedComment.timestamp || selectedComment.created_at || '')}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-2">⭐ Puan</h3>
                    <p className="text-gray-600">{formatRating(selectedComment.rating)}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-2">🏪 Platform</h3>
                    <p className="text-gray-600 capitalize">{selectedComment.platform || 'Bilinmiyor'}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-2">💰 Fiyat</h3>
                    <p className="text-gray-600">{formatPrice(selectedComment.price || selectedComment.product_price)}</p>
                  </div>
                </div>

                {/* Yorum İçeriği */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl">
                  <h3 className="font-semibold text-gray-700 mb-4 text-lg">💭 Yorum İçeriği</h3>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {selectedComment.comment || selectedComment.text || 'Yorum içeriği bulunamadı'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 rounded-b-2xl">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      const text = `${selectedComment.product_name}\n\nPuan: ${formatRating(selectedComment.rating)}\nTarih: ${selectedComment.comment_date || formatDate(selectedComment.timestamp || selectedComment.created_at || '')}\nPlatform: ${selectedComment.platform}\n\nYorum:\n${selectedComment.comment || selectedComment.text}`;
                      navigator.clipboard.writeText(text);
                      alert('Yorum panoya kopyalandı!');
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    📋 Kopyala
                  </button>
                  
                  <button
                    onClick={() => setShowCommentModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    ✕ Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
 