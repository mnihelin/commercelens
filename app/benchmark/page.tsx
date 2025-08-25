'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';

interface SellerData {
  name: string;
  platform: string;
  totalComments: number;
  averageRating: number;
  averagePrice: number;
  totalLikes: number;
  priceCount: number;
}

interface BenchmarkResult {
  success: boolean;
  analysis?: string;
  highestRatingSeller?: SellerData;
  cheapestSeller?: SellerData;
  collectionName?: string;
  error?: string;
  sellersAnalyzed?: number;
  totalComments?: number;
}

interface Collection {
  name: string;
  productName?: string;
  documentCount: number;
  collectionType?: string;
}

export default function BenchmarkPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);

  // Koleksiyonları yükle
  const loadCollections = async () => {
    setIsLoadingCollections(true);
    try {
      const response = await fetch('/api/database');
      const data = await response.json();
      
      if (data.success) {
        const allCollections: Collection[] = [];
        
        // Tüm ecommerce_analytics koleksiyonlarını ekle
        data.stats.collections.forEach((col: any) => {
          if (col.documentCount > 0) {
            // Koleksiyon tipini belirle
            let collectionType = 'Veri Koleksiyonu';
            if (col.name.includes('reviews')) {
              collectionType = 'Yorum Koleksiyonu';
            } else if (col.name.includes('analysis')) {
              collectionType = 'Analiz Koleksiyonu';
            } else if (col.name.includes('benchmark')) {
              collectionType = 'Benchmark Koleksiyonu';
            }
            
            allCollections.push({
              name: col.name,
              documentCount: col.documentCount,
              collectionType
            });
          }
        });

        
        setCollections(allCollections);
      }
    } catch (error) {
      console.error('Koleksiyonlar yüklenirken hata:', error);
    } finally {
      setIsLoadingCollections(false);
    }
  };

  // Benchmark analizi yap
  const runBenchmark = async () => {
    if (!selectedCollection) return;
    
    setIsLoading(true);
    setBenchmarkResult(null);
    
    try {
      const response = await fetch('/api/benchmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionName: selectedCollection
        })
      });
      
      const data = await response.json();
      setBenchmarkResult(data);
    } catch (error) {
      console.error('Benchmark analizi hatası:', error);
      setBenchmarkResult({
        success: false,
        error: 'Analiz sırasında bir hata oluştu'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
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
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-6 shadow-lg shadow-purple-500/25">
                <span className="text-3xl">⚡</span>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent mb-4">
                En Ucuz vs En Yüksek Rating
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Basit ve pratik satıcı karşılaştırması: En ucuz fiyat vs En yüksek beğeni alan satıcı
              </p>
              <div className="flex justify-center items-center gap-4 mt-6">
                <Link 
                  href="/"
                  className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
                >
                  <span>🏠</span>
                  Ana Sayfa
                </Link>
              </div>
            </div>

            {/* Koleksiyon Seçimi */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-8 mb-8 border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Koleksiyon Seçimi</h2>
              </div>
              
              {isLoadingCollections ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Koleksiyonlar yükleniyor...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value)}
                    className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 backdrop-blur-sm"
                  >
                    <option value="">Analiz edilecek koleksiyonu seçin</option>
                    {collections.map((collection) => (
                      <option key={collection.name} value={collection.name}>
                        [{collection.collectionType}] {collection.productName || collection.name} ({collection.documentCount} kayıt)
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={runBenchmark}
                    disabled={!selectedCollection || isLoading}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Satıcı Karşılaştırması Yapılıyor...
                      </div>
                    ) : (
                      '⚡ En Ucuz vs En Yüksek Rating Karşılaştır'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Sonuçlar */}
            {benchmarkResult && (
              <div className="space-y-8">
                {benchmarkResult.success ? (
                  <>
                    {/* AI Analiz Sonucu */}
                    {benchmarkResult.analysis && (
                      <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl shadow-gray-300/50 border border-white/30 p-10">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-white text-2xl">🎯</span>
                          </div>
                          <div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                              Profesyonel Analiz Raporu
                            </h2>
                            <p className="text-base text-gray-600 font-medium">{benchmarkResult.sellersAnalyzed} satıcı • {benchmarkResult.totalComments} yorum analizi</p>
                          </div>
                        </div>
                        <div className="space-y-8">
                          {/* Ana Başlık - Üst kısımda gösterilir */}
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full mb-6 shadow-xl shadow-purple-500/30">
                              <span className="text-white text-3xl">🎯</span>
                            </div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                              Satıcı Karşılaştırma Analizi
                            </h1>
                            <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200">
                              <span className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-800">{benchmarkResult.sellersAnalyzed}</span> satıcı • 
                                <span className="font-semibold text-gray-800 ml-1">{benchmarkResult.totalComments}</span> yorum analizi
                              </span>
                            </div>
                          </div>

                          {/* Grid Layout - 2x2 Kutucuk Düzeni */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* En Yüksek Rating Kutucuğu */}
                            <div className="group relative bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 rounded-3xl p-8 border border-yellow-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-orange-400/10 to-red-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">🏆</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">En Yüksek Rating</h2>
                                    <p className="text-gray-600">Müşteri Memnuniyeti Lideri</p>
                                  </div>
                                </div>
                                
                                {benchmarkResult.highestRatingSeller && (
                                  <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                      <h3 className="text-xl font-bold text-gray-800 mb-4">{benchmarkResult.highestRatingSeller.name}</h3>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center">
                                          <div className="text-3xl font-bold text-orange-600 mb-1">{benchmarkResult.highestRatingSeller.averageRating.toFixed(1)}</div>
                                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                            <span>⭐</span> Rating Puanı
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-3xl font-bold text-green-600 mb-1">{benchmarkResult.highestRatingSeller.averagePrice.toLocaleString('tr-TR')} ₺</div>
                                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                            <span>💰</span> Ortalama Fiyat
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4">
                                      <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-600">Platform:</span>
                                        <span className="font-semibold text-gray-800">{benchmarkResult.highestRatingSeller.platform}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Toplam Yorum:</span>
                                        <span className="font-semibold text-gray-800">{benchmarkResult.highestRatingSeller.totalComments}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* En Ucuz Fiyat Kutucuğu */}
                            <div className="group relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-3xl p-8 border border-green-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-emerald-400/10 to-teal-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">💰</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">En Uygun Fiyat</h2>
                                    <p className="text-gray-600">Ekonomik Seçenek Lideri</p>
                                  </div>
                                </div>
                                
                                {benchmarkResult.cheapestSeller && (
                                  <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                      <h3 className="text-xl font-bold text-gray-800 mb-4">{benchmarkResult.cheapestSeller.name}</h3>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center">
                                          <div className="text-3xl font-bold text-green-600 mb-1">{benchmarkResult.cheapestSeller.averagePrice.toLocaleString('tr-TR')} ₺</div>
                                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                            <span>💰</span> En Düşük Fiyat
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-3xl font-bold text-orange-600 mb-1">{benchmarkResult.cheapestSeller.averageRating.toFixed(1)}</div>
                                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                            <span>⭐</span> Rating Puanı
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4">
                                      <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-600">Platform:</span>
                                        <span className="font-semibold text-gray-800">{benchmarkResult.cheapestSeller.platform}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Toplam Yorum:</span>
                                        <span className="font-semibold text-gray-800">{benchmarkResult.cheapestSeller.totalComments}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Karşılaştırma Kutucuğu */}
                            <div className="group relative bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 rounded-3xl p-8 border border-purple-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 via-pink-400/10 to-rose-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">🤔</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">Karşılaştırma</h2>
                                    <p className="text-gray-600">Detaylı Analiz</p>
                                  </div>
                                </div>
                                
                                {benchmarkResult.highestRatingSeller && benchmarkResult.cheapestSeller && (
                                  <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                      <div className="grid grid-cols-1 gap-4">
                                        <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                                          <span className="font-semibold text-gray-700">💰 Fiyat Farkı:</span>
                                          <span className="font-bold text-purple-600">
                                            {(benchmarkResult.highestRatingSeller.averagePrice - benchmarkResult.cheapestSeller.averagePrice).toLocaleString('tr-TR')} ₺
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                                          <span className="font-semibold text-gray-700">⭐ Rating Farkı:</span>
                                          <span className="font-bold text-purple-600">
                                            {(benchmarkResult.highestRatingSeller.averageRating - benchmarkResult.cheapestSeller.averageRating).toFixed(1)} puan
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* AI Önerileri Kutucuğu */}
                            <div className="group relative bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-3xl p-8 border border-indigo-200/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/10 via-blue-400/10 to-cyan-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-2xl">💡</span>
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-gray-800">AI Önerileri</h2>
                                    <p className="text-gray-600">Akıllı Tavsiyeler</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                    <div className="space-y-3">
                                      <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-l-4 border-green-500">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-green-600 font-semibold">💰 Bütçe Odaklı:</span>
                                        </div>
                                        <p className="text-gray-700 text-sm">En uygun fiyat için {benchmarkResult.cheapestSeller?.name} tercih edilebilir.</p>
                                      </div>
                                      
                                      <div className="p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl border-l-4 border-yellow-500">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-yellow-600 font-semibold">⭐ Kalite Odaklı:</span>
                                        </div>
                                        <p className="text-gray-700 text-sm">Yüksek müşteri memnuniyeti için {benchmarkResult.highestRatingSeller?.name} ideal seçim.</p>
                                      </div>
                                      
                                      <div className="p-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl border-l-4 border-indigo-500">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-indigo-600 font-semibold">🎯 Optimal Seçim:</span>
                                        </div>
                                        <p className="text-gray-700 text-sm">Fiyat-kalite dengesi için her iki seçeneği de değerlendirin.</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>


                        </div>
                      </div>
                    )}

                    {/* En Yüksek Rating vs En Ucuz Karşılaştırması */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* En Yüksek Rating */}
                      {benchmarkResult.highestRatingSeller && (
                        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 border border-white/20 p-8">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                              <span className="text-white text-xl">🏆</span>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">En Yüksek Rating</h3>
                              <p className="text-sm text-gray-600">Müşteri memnuniyeti lideri</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6">
                              <h4 className="text-lg font-bold text-gray-800 mb-4">{benchmarkResult.highestRatingSeller.name}</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-orange-600">{benchmarkResult.highestRatingSeller.averageRating.toFixed(1)}</div>
                                  <div className="text-sm text-gray-600">⭐ Rating</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">{benchmarkResult.highestRatingSeller.averagePrice.toFixed(0)} TL</div>
                                  <div className="text-sm text-gray-600">💰 Fiyat</div>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Platform:</span>
                                  <span className="font-medium">{benchmarkResult.highestRatingSeller.platform}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Toplam Yorum:</span>
                                  <span className="font-medium">{benchmarkResult.highestRatingSeller.totalComments}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Toplam Beğeni:</span>
                                  <span className="font-medium">{benchmarkResult.highestRatingSeller.totalLikes}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* En Ucuz */}
                      {benchmarkResult.cheapestSeller && (
                        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 border border-white/20 p-8">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                              <span className="text-white text-xl">💰</span>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">En Ucuz Fiyat</h3>
                              <p className="text-sm text-gray-600">Ekonomik seçenek lideri</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                              <h4 className="text-lg font-bold text-gray-800 mb-4">{benchmarkResult.cheapestSeller.name}</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">{benchmarkResult.cheapestSeller.averagePrice.toFixed(0)} TL</div>
                                  <div className="text-sm text-gray-600">💰 Fiyat</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-orange-600">{benchmarkResult.cheapestSeller.averageRating.toFixed(1)}</div>
                                  <div className="text-sm text-gray-600">⭐ Rating</div>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Platform:</span>
                                  <span className="font-medium">{benchmarkResult.cheapestSeller.platform}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Toplam Yorum:</span>
                                  <span className="font-medium">{benchmarkResult.cheapestSeller.totalComments}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Toplam Beğeni:</span>
                                  <span className="font-medium">{benchmarkResult.cheapestSeller.totalLikes}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>


                  </>
                ) : (
                  <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 border border-white/20 p-8">
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-red-500">❌</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Analiz Başarısız</h3>
                      <p className="text-gray-600">{benchmarkResult.error || 'Bilinmeyen bir hata oluştu'}</p>
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