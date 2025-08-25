'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SearchForm from './components/SearchForm';
import ProductSearchForm from './components/ProductSearchForm';
import ReviewsList from './components/ReviewsList';
import LoadingSpinner from './components/LoadingSpinner';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

interface Review {
  _id: string;
  platform: string;
  product_name: string;
  comment: string;
  timestamp: string;
  product_url: string;
}

interface ScrapeResult {
  success: boolean;
  product_name?: string;
  total_reviews?: number;
  platform?: string;
  error?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [lastScrapeResult, setLastScrapeResult] = useState<ScrapeResult | null>(null);

  const handleScrape = async (url: string, platform: string, maxPages: number) => {
    setIsLoading(true);
    setLastScrapeResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          platform,
          maxPages,
        }),
      });

      const result: ScrapeResult = await response.json();
      setLastScrapeResult(result);

      if (result.success) {
        // Başarılı scraping sonrası yorumları yenile
        await loadReviews();
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setLastScrapeResult({
        success: false,
        error: 'Ağ hatası oluştu'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSearch = async (searchTerm: string, platform: string) => {
    setIsLoading(true);
    setLastScrapeResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm,
          platform,
          searchType: 'product_search',
        }),
      });

      const result: ScrapeResult = await response.json();
      setLastScrapeResult(result);

      if (result.success) {
        // Başarılı scraping sonrası yorumları yenile
        await loadReviews();
      }
    } catch (error) {
      console.error('Product search error:', error);
      setLastScrapeResult({
        success: false,
        error: 'Ağ hatası oluştu'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadReviews = async (productName = '', platform = '') => {
    try {
      const params = new URLSearchParams();
      if (productName) params.append('productName', productName);
      if (platform) params.append('platform', platform);
      params.append('limit', '100');

      const response = await fetch(`/api/reviews?${params}`);
      const data = await response.json();

      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (error) {
      console.error('Load reviews error:', error);
    }
  };

  const handleDeleteReviews = async (productName: string) => {
    if (!confirm(`"${productName}" ürününe ait tüm yorumları silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews?productName=${encodeURIComponent(productName)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        alert(`${result.deletedCount} yorum başarıyla silindi.`);
        await loadReviews();
      } else {
        alert('Yorumlar silinirken hata oluştu: ' + result.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Ağ hatası oluştu');
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Sidebar />
        
        {/* Animated background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative lg:ml-72 transition-all duration-300">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="text-center mb-12">
                <div className="mb-6">
                  <img 
                    src="/images/theclico-logo.png" 
                    alt="TheClico Logo" 
                    className="w-64 h-auto mx-auto mb-4"
                  />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
                  TheClico CommerceLens
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  Trendyol, Hepsiburada, N11 ve AliExpress ürün yorumlarını kolayca analiz edin ve değerli içgörüler elde edin
                </p>
              </div>

              {/* Search Forms */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* URL ile Arama */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-white/20 hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg">🔗</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">URL ile Arama</h2>
                  </div>
                  <SearchForm onScrape={handleScrape} isLoading={isLoading} />
                </div>

                {/* Ürün Adı ile Arama */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-white/20 hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg">🛍️</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Ürün Adı ile Arama</h2>
                  </div>
                  <ProductSearchForm onSearch={handleProductSearch} isLoading={isLoading} />
                </div>
              </div>

              {/* Loading */}
              {isLoading && (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8 border border-white/20">
                  <div className="flex flex-col items-center">
                    <LoadingSpinner />
                    <div className="mt-6 text-center">
                      <p className="text-gray-700 text-lg font-medium mb-2">
                        Yorumlar çekiliyor...
                      </p>
                      <p className="text-gray-500 text-sm">
                        Bu işlem birkaç dakika sürebilir, lütfen bekleyin
                      </p>
                      <div className="flex justify-center items-center gap-1 mt-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrape Result */}
              {lastScrapeResult && (
                <div className={`rounded-2xl shadow-xl backdrop-blur-lg p-8 mb-8 border transition-all duration-500 ${
                  lastScrapeResult.success 
                    ? 'bg-emerald-50/80 border-emerald-200/50 shadow-emerald-200/25' 
                    : 'bg-red-50/80 border-red-200/50 shadow-red-200/25'
                }`}>
                  {lastScrapeResult.success ? (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xl">✅</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-emerald-800 mb-3">
                          Başarıyla Tamamlandı!
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white/50 rounded-lg p-4">
                            <p className="text-sm text-emerald-600 font-medium">Ürün</p>
                            <p className="text-emerald-800 font-semibold">{lastScrapeResult.product_name}</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-4">
                            <p className="text-sm text-emerald-600 font-medium">Platform</p>
                            <p className="text-emerald-800 font-semibold">{lastScrapeResult.platform}</p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-4">
                            <p className="text-sm text-emerald-600 font-medium">Toplam Yorum</p>
                            <p className="text-emerald-800 font-semibold text-2xl">{lastScrapeResult.total_reviews}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xl">❌</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-800 mb-3">
                          Hata Oluştu
                        </h3>
                        <div className="bg-white/50 rounded-lg p-4">
                          <p className="text-red-700">{lastScrapeResult.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reviews */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 border border-white/20 overflow-hidden">
                <ReviewsList 
                  reviews={reviews}
                  onDeleteProduct={handleDeleteReviews}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}