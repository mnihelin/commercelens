'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Link from 'next/link';

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
  analysisType?: 'general_analysis' | 'seller_benchmark' | 'product_benchmark' | 'filtered_analysis';
}

interface ComparisonResult {
  success: boolean;
  comparison?: string;
  error?: string;
}

export default function ProductBenchmarkPage() {
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [selectedProduct1, setSelectedProduct1] = useState<AnalysisHistory | null>(null);
  const [selectedProduct2, setSelectedProduct2] = useState<AnalysisHistory | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Analiz geçmişini yükle
  const loadAnalysisHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/analysis-history');
      const data = await response.json();
      
      if (data.success) {
        // Database sayfasından yapılan filtrelenmiş analizleri al (Genel Ürün Analizleri başlığı altındakiler)
        const generalAnalyses = data.history.filter((analysis: AnalysisHistory) => {
          // 1. Filtrelenmiş analizleri dahil et (database sayfasından yapılan)
          if (analysis.analysisType === 'filtered_analysis') {
            return true;
          }
          
          // 2. Dinamik başlıklı analizleri dahil et ("Trendyol - iPhone" formatında)
          if (analysis.collectionName && analysis.collectionName.includes(' - ')) {
            // Benchmark analizlerini hariç tut
            if (analysis.collectionName.includes('Benchmark')) {
              return false;
            }
            return true;
          }
          
          return false;
        });
        console.log('Tüm analiz geçmişi:', data.history.length);
        console.log('Filtrelenmiş genel analizler:', generalAnalyses.length);
        console.log('Genel analizler:', generalAnalyses);
        
        // Debug: Her analizin detaylarını göster
        data.history.forEach((analysis: AnalysisHistory, index: number) => {
          console.log(`Analiz ${index + 1}:`, {
            collectionName: analysis.collectionName,
            analysisType: analysis.analysisType,
            platforms: analysis.platformInfo?.platforms,
            products: analysis.platformInfo?.products
          });
        });
        setAnalysisHistory(generalAnalyses);
      }
    } catch (error) {
      console.error('Analiz geçmişi yüklenirken hata:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Ürün karşılaştırması yap
  const compareProducts = async () => {
    if (!selectedProduct1 || !selectedProduct2) return;
    
    setIsLoading(true);
    setComparisonResult(null);
    
    try {
      const response = await fetch('/api/product-benchmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product1: selectedProduct1,
          product2: selectedProduct2
        })
      });
      
      const data = await response.json();
      setComparisonResult(data);
    } catch (error) {
      console.error('Karşılaştırma hatası:', error);
      setComparisonResult({
        success: false,
        error: 'Karşılaştırma sırasında bir hata oluştu'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('tr-TR');
    } catch {
      return timestamp;
    }
  };

  const getProductDisplayName = (analysis: AnalysisHistory) => {
    const productName = analysis.platformInfo?.products?.[0] || analysis.collectionName;
    const platform = analysis.platformInfo?.platforms?.[0] || '';
    return `${productName} (${platform})`;
  };

  useEffect(() => {
    loadAnalysisHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Sidebar />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="relative lg:ml-72 transition-all duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-lg shadow-blue-500/25">
                <span className="text-3xl">📊</span>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4">
                Ürün Benchmark
              </h1>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-4xl mx-auto">
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 text-xl mt-0.5">💡</span>
                  <p className="text-blue-800 font-medium leading-relaxed">
                    Seçtiğiniz ürünlerin karşılaştırmalı analizini gerçekleştirmek için veritabanı sayfası üzerinden ilgili ürünleri analiz etmeyi unutmayın!
                  </p>
                </div>
              </div>
              <div className="flex justify-center items-center gap-4 mt-6">
                <Link 
                  href="/"
                  className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
                >
                  <span>🏠</span>
                  Ana Sayfa
                </Link>
                <Link 
                  href="/history"
                  className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
                >
                  <span>📈</span>
                  Analiz Geçmişi
                </Link>
              </div>
            </div>

            {/* Ürün Seçme Kutuları */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              
              {/* Birinci Ürün */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg font-bold">1</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Birinci Ürün</h2>
                </div>
                
                {isLoadingHistory ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Ürünler yükleniyor...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <select
                      value={selectedProduct1?._id || ''}
                      onChange={(e) => {
                        const product = analysisHistory.find(p => p._id === e.target.value);
                        setSelectedProduct1(product || null);
                      }}
                      className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
                    >
                      <option value="">Birinci ürünü seçin</option>
                      {analysisHistory.map((analysis) => (
                        <option key={analysis._id} value={analysis._id}>
                          {getProductDisplayName(analysis)} - {analysis.analyzedComments} yorum
                        </option>
                      ))}
                    </select>
                    
                    {selectedProduct1 && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">
                          {getProductDisplayName(selectedProduct1)}
                        </h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p>📊 {selectedProduct1.analyzedComments} yorum analiz edildi</p>
                          <p>📅 {formatDate(selectedProduct1.timestamp)}</p>
                          <p>🏪 {selectedProduct1.platformInfo?.platforms?.join(', ') || 'Platform bilgisi yok'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* İkinci Ürün */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg font-bold">2</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">İkinci Ürün</h2>
                </div>
                
                {isLoadingHistory ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Ürünler yükleniyor...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <select
                      value={selectedProduct2?._id || ''}
                      onChange={(e) => {
                        const product = analysisHistory.find(p => p._id === e.target.value);
                        setSelectedProduct2(product || null);
                      }}
                      className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
                    >
                      <option value="">İkinci ürünü seçin</option>
                      {analysisHistory
                        .filter(analysis => analysis._id !== selectedProduct1?._id)
                        .map((analysis) => (
                          <option key={analysis._id} value={analysis._id}>
                            {getProductDisplayName(analysis)} - {analysis.analyzedComments} yorum
                          </option>
                        ))}
                    </select>
                    
                    {selectedProduct2 && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-2">
                          {getProductDisplayName(selectedProduct2)}
                        </h4>
                        <div className="text-sm text-purple-700 space-y-1">
                          <p>📊 {selectedProduct2.analyzedComments} yorum analiz edildi</p>
                          <p>📅 {formatDate(selectedProduct2.timestamp)}</p>
                          <p>🏪 {selectedProduct2.platformInfo?.platforms?.join(', ') || 'Platform bilgisi yok'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Karşılaştırma Butonu */}
            <div className="text-center mb-8">
              <button
                onClick={compareProducts}
                disabled={!selectedProduct1 || !selectedProduct2 || isLoading}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    AI Karşılaştırma Yapılıyor...
                  </div>
                ) : (
                  '🤖 AI ile Ürün Karşılaştır'
                )}
              </button>
            </div>

            {/* Karşılaştırma Sonucu */}
            {comparisonResult && (
              <div className="space-y-8">
                {comparisonResult.success ? (
                  <div className="space-y-8">
                    {/* Ana Başlık */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-full mb-6 shadow-xl shadow-green-500/30">
                        <span className="text-white text-3xl">🥇</span>
                      </div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-4">
                        Ürün Karşılaştırma Analizi
                      </h1>
                      <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200">
                        <span className="text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">{selectedProduct1 ? getProductDisplayName(selectedProduct1) : ''}</span>
                          <span className="mx-2">vs</span>
                          <span className="font-semibold text-gray-800">{selectedProduct2 ? getProductDisplayName(selectedProduct2) : ''}</span>
                        </span>
                      </div>
                    </div>

                    {/* Ürün Kartları */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                      {/* Birinci Ürün Kartı */}
                      {selectedProduct1 && (
                        <div className="group relative bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 rounded-3xl p-8 border border-blue-200/50 shadow-xl hover:shadow-2xl transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 via-cyan-400/10 to-indigo-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-white text-xl font-bold">1</span>
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-gray-800">Birinci Ürün</h2>
                                <p className="text-gray-600">Seçilen Ürün</p>
                              </div>
                            </div>
                            
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                              <h3 className="text-lg font-bold text-gray-800 mb-4">{getProductDisplayName(selectedProduct1)}</h3>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">📊 Analiz Edilen Yorum:</span>
                                  <span className="font-bold text-blue-600">{selectedProduct1.analyzedComments}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">🏪 Platform:</span>
                                  <span className="font-bold text-blue-600">{selectedProduct1.platformInfo?.platforms?.[0] || 'Bilinmeyen'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">📅 Analiz Tarihi:</span>
                                  <span className="font-bold text-blue-600">{formatDate(selectedProduct1.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* İkinci Ürün Kartı */}
                      {selectedProduct2 && (
                        <div className="group relative bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 rounded-3xl p-8 border border-purple-200/50 shadow-xl hover:shadow-2xl transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 via-pink-400/10 to-rose-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-white text-xl font-bold">2</span>
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-gray-800">İkinci Ürün</h2>
                                <p className="text-gray-600">Seçilen Ürün</p>
                              </div>
                            </div>
                            
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                              <h3 className="text-lg font-bold text-gray-800 mb-4">{getProductDisplayName(selectedProduct2)}</h3>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">📊 Analiz Edilen Yorum:</span>
                                  <span className="font-bold text-purple-600">{selectedProduct2.analyzedComments}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">🏪 Platform:</span>
                                  <span className="font-bold text-purple-600">{selectedProduct2.platformInfo?.platforms?.[0] || 'Bilinmeyen'}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                                  <span className="font-semibold text-gray-700">📅 Analiz Tarihi:</span>
                                  <span className="font-bold text-purple-600">{formatDate(selectedProduct2.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Karşılaştırma Sonuçları - Modern Tasarım */}
                    <div className="space-y-6">
                      {(() => {
                        // AI analizini parse et
                        const analysisText = comparisonResult.comparison || '';
                        const lines = analysisText.split('\n').filter(line => line.trim());
                        
                        // Kazanan ürünü belirle
                        const winnerSection = lines.find(line => 
                          line.includes('🏆') || 
                          line.toLowerCase().includes('kazanan') ||
                          line.toLowerCase().includes('winner')
                        );
                        
                        // Güçlü yönler
                        const strengthsStart = lines.findIndex(line => 
                          line.toLowerCase().includes('güçlü') || 
                          line.toLowerCase().includes('avantaj') ||
                          line.toLowerCase().includes('strength')
                        );
                        
                        // Zayıf yönler  
                        const weaknessStart = lines.findIndex(line => 
                          line.toLowerCase().includes('zayıf') || 
                          line.toLowerCase().includes('dezavantaj') ||
                          line.toLowerCase().includes('weakness')
                        );
                        
                        // Öneriler
                        const recommendationStart = lines.findIndex(line => 
                          line.toLowerCase().includes('öneri') || 
                          line.toLowerCase().includes('tavsiye') ||
                          line.toLowerCase().includes('recommendation')
                        );

                        return (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Kazanan Ürün */}
                            <div className="group relative bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 rounded-3xl p-8 border border-yellow-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 lg:col-span-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-orange-400/10 to-red-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center justify-center gap-4 mb-6">
                                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-3xl">🏆</span>
                                  </div>
                                  <div className="text-center">
                                    <h2 className="text-3xl font-bold text-gray-800">Kazanan Ürün</h2>
                                    <p className="text-gray-600">AI Analiz Sonucu</p>
                                  </div>
                                </div>
                                
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50 text-center">
                                  <div className="text-lg text-gray-700 font-medium">
                                    {winnerSection || analysisText.substring(0, 200) + '...'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Detaylı Özellik Karşılaştırması */}
                            <div className="group relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-3xl p-8 border border-green-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-emerald-400/10 to-teal-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">💪</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Güçlü Yönler</h2>
                                    <p className="text-gray-600">Avantaj Analizi</p>
                                  </div>
                                </div>
                                
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                  <div className="space-y-3">
                                    {strengthsStart !== -1 ? 
                                      lines.slice(strengthsStart, Math.min(strengthsStart + 5, lines.length))
                                        .map((line, idx) => (
                                          <div key={idx} className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border-l-4 border-green-500">
                                            <p className="text-gray-700 text-sm">{line.replace(/[*#-]/g, '').trim()}</p>
                                          </div>
                                        )) :
                                      <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                                        <p className="text-gray-700 text-sm">Güçlü yönler analiz ediliyor...</p>
                                      </div>
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Geliştirme Alanları */}
                            <div className="group relative bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-3xl p-8 border border-orange-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 via-red-400/10 to-pink-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">⚠️</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Geliştirme Alanları</h2>
                                    <p className="text-gray-600">Eksik Yönler</p>
                                  </div>
                                </div>
                                
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                  <div className="space-y-3">
                                    {weaknessStart !== -1 ? 
                                      lines.slice(weaknessStart, Math.min(weaknessStart + 5, lines.length))
                                        .map((line, idx) => (
                                          <div key={idx} className="p-3 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg border-l-4 border-orange-500">
                                            <p className="text-gray-700 text-sm">{line.replace(/[*#-]/g, '').trim()}</p>
                                          </div>
                                        )) :
                                      <div className="p-3 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg">
                                        <p className="text-gray-700 text-sm">Geliştirme alanları analiz ediliyor...</p>
                                      </div>
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>


                          </div>
                        );
                      })()}


                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                    <div className="flex items-center gap-3 text-red-800">
                      <span className="text-2xl">❌</span>
                      <div>
                        <h3 className="font-semibold">Karşılaştırma Hatası</h3>
                        <p className="text-red-600">{comparisonResult.error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
} 