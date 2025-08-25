'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';

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
  summary?: string;
  analysisType?: 'general_analysis' | 'seller_benchmark' | 'product_benchmark' | 'filtered_analysis';
}

export default function HistoryPage() {
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'seller' | 'product'>('general');
  const [activeDetailTab, setActiveDetailTab] = useState<'insights' | 'overview' | 'themes' | 'actions'>('insights');

  const loadAnalysisHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analysis-history');
      const data = await response.json();
      
      if (data.success) {
        setAnalysisHistory(data.history);
      } else {
        setError(data.error || 'Analiz geçmişi yüklenemedi');
      }
    } catch (err) {
      setError('Ağ hatası oluştu');
      console.error('History load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Analiz tipine göre filtreleme
  const getFilteredAnalyses = (type: 'general' | 'seller' | 'product') => {
    return analysisHistory.filter(analysis => {
      switch (type) {
        case 'general':
          // Genel analizler ve filtrelenmiş analizler
          return (analysis.analysisType === 'general_analysis' || 
                  analysis.analysisType === 'filtered_analysis' || 
                  !analysis.analysisType) && 
                 !analysis.collectionName.includes('Benchmark:') &&
                 !analysis.collectionName.includes('vs') &&
                 !analysis.collectionName.toLowerCase().includes('benchmark');
        case 'seller':
          return analysis.analysisType === 'seller_benchmark';
        case 'product':
          return analysis.analysisType === 'product_benchmark';
        default:
          return false;
      }
    });
  };

  useEffect(() => {
    loadAnalysisHistory();
  }, []);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('tr-TR');
    } catch {
      return timestamp;
    }
  };

  const getAnalysisSummary = (result: string) => {
    const lines = result.split('\n').filter(line => line.trim().length > 0);
    const firstMeaningfulLine = lines.find(line => 
      !line.includes('**') && 
      !line.includes('##') && 
      line.length > 20
    );
    return firstMeaningfulLine?.substring(0, 150) + '...' || 'Analiz özeti mevcut değil';
  };

  const deleteAnalysis = async (analysisId: string) => {
    if (!confirm('Bu analizi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/analysis-history?id=${analysisId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setAnalysisHistory(prev => prev.filter(item => item._id !== analysisId));
        if (selectedAnalysis === analysisId) {
          setSelectedAnalysis(null);
        }
      } else {
        alert('Analiz silinirken hata oluştu: ' + result.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Ağ hatası oluştu');
    }
  };

  const getTabIcon = (type: 'general' | 'seller' | 'product') => {
    switch (type) {
      case 'general': return '🤖';
      case 'seller': return '⚡';
      case 'product': return '📊';
    }
  };

  const getTabTitle = (type: 'general' | 'seller' | 'product') => {
    switch (type) {
      case 'general': return 'Genel Ürün Analizleri';
      case 'seller': return 'Satıcı Benchmark\'ları';
      case 'product': return 'Ürün Benchmark\'ları';
    }
  };

  const getTabDescription = (type: 'general' | 'seller' | 'product') => {
    switch (type) {
      case 'general': return 'AI ile yapılan genel ürün analizleri ve filtrelenmiş analizler';
      case 'seller': return 'En ucuz vs en yüksek rating karşılaştırmaları';
      case 'product': return 'İki ürün arasında yapılan karşılaştırmalar';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Sidebar />
        
        <div className="relative lg:ml-72 transition-all duration-300">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <span className="text-white text-2xl">📈</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Analiz Geçmişi Yükleniyor...</h2>
                <div className="flex justify-center items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
        <Sidebar />
        
        <div className="relative lg:ml-72 transition-all duration-300">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl text-red-500">❌</span>
                </div>
                <h2 className="text-2xl font-bold text-red-800 mb-4">Yükleme Hatası</h2>
                <p className="text-red-600 mb-6">{error}</p>
                <button
                  onClick={loadAnalysisHistory}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentAnalyses = getFilteredAnalyses(activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Sidebar />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="relative lg:ml-72 transition-all duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-6 shadow-lg shadow-purple-500/25">
                <span className="text-3xl">📈</span>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent mb-4">
                Analiz Geçmişi
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Geçmişte yapılmış tüm AI analizlerinizi kategorilere göre görüntüleyin
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-2 inline-flex">
                {(['general', 'seller', 'product'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectedAnalysis(null);
                    }}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                      activeTab === tab
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{getTabIcon(tab)}</span>
                    <span>{getTabTitle(tab)}</span>
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                      {getFilteredAnalyses(tab).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {currentAnalyses.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-12 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl text-gray-400">{getTabIcon(activeTab)}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-3">
                  Henüz {getTabTitle(activeTab)} Bulunamadı
                </h3>
                <p className="text-gray-500 max-w-md mx-auto leading-relaxed mb-6">
                  {getTabDescription(activeTab)} henüz yapılmamış.
                </p>
                <div className="flex justify-center gap-4">
                  {activeTab === 'general' && (
                    <Link
                      href="/database"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                    >
                      <span>🗄️</span>
                      Ürün Analizi Yap
                    </Link>
                  )}
                  {activeTab === 'seller' && (
                    <Link
                      href="/benchmark"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                    >
                      <span>⚡</span>
                      Satıcı Benchmark Yap
                    </Link>
                  )}
                  {activeTab === 'product' && (
                    <Link
                      href="/product-benchmark"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                    >
                      <span>📊</span>
                      Ürün Benchmark Yap
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analysis List */}
                <div className="lg:col-span-1">
                  <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                    <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>{getTabIcon(activeTab)}</span>
                        {getTabTitle(activeTab)} ({currentAnalyses.length})
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">{getTabDescription(activeTab)}</p>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {currentAnalyses.map((analysis) => (
                        <div 
                          key={analysis._id}
                          className={`p-4 border-b border-gray-200/50 cursor-pointer transition-all duration-200 ${
                            selectedAnalysis === analysis._id 
                              ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedAnalysis(
                            selectedAnalysis === analysis._id ? null : analysis._id
                          )}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {analysis.collectionName}
                            </h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAnalysis(analysis._id);
                              }}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                          
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex justify-between">
                              <span>Platform:</span>
                              <span className="font-medium">{analysis.platformInfo?.platforms?.join(', ') || 'Bilinmiyor'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Analiz Edilen:</span>
                              <span className="font-medium">{analysis.analyzedComments} yorum</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tarih:</span>
                              <span className="font-medium">{formatDate(analysis.timestamp)}</span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {getAnalysisSummary(analysis.result)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Analysis Detail */}
                <div className="lg:col-span-2">
                  {selectedAnalysis ? (
                    (() => {
                      const analysis = currentAnalyses.find(a => a._id === selectedAnalysis);
                      if (!analysis) return null;
                      
                      return (
                        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                          <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h2 className="text-xl font-bold text-gray-900">{analysis.collectionName}</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                  {formatDate(analysis.timestamp)} tarihinde yapılan {getTabTitle(activeTab).toLowerCase()}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                  analysis.analysisType === 'filtered_analysis' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {analysis.analysisType === 'filtered_analysis' ? '🎯' : getTabIcon(activeTab)} 
                                  {analysis.analysisType === 'filtered_analysis' ? 'Filtrelenmiş Analiz' : getTabTitle(activeTab)}
                                </span>
                                {activeTab === 'general' && (
                                  <Link
                                    href={`/analysis?collection=${encodeURIComponent(analysis.collectionName)}`}
                                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-colors text-sm font-medium"
                                  >
                                    🔄 Yeniden Analiz Et
                                  </Link>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <div className="bg-white/50 rounded-lg p-3">
                                <p className="text-xs text-gray-600">Platform</p>
                                <p className="font-semibold text-gray-800">{analysis.platformInfo?.platforms?.join(', ') || 'Bilinmiyor'}</p>
                              </div>
                              <div className="bg-white/50 rounded-lg p-3">
                                <p className="text-xs text-gray-600">Analiz Edilen</p>
                                <p className="font-semibold text-gray-800">{analysis.analyzedComments} yorum</p>
                              </div>
                              <div className="bg-white/50 rounded-lg p-3">
                                <p className="text-xs text-gray-600">Toplam Yorum</p>
                                <p className="font-semibold text-gray-800">{analysis.reviewCount}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Detail Tab Navigation */}
                          <div className="flex justify-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                            <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-1 inline-flex">
                              {(() => {
                                // Analiz içeriğini parse et ve kategorilere böl
                                const analysisText = analysis.result;
                                const lines = analysisText.split('\n').filter(line => line.trim());
                                const categoryCounts = { insights: 0, overview: 0, themes: 0, actions: 0 };
                                
                                lines.forEach((line: string) => {
                                  if (line.match(/^\d+\.\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) || 
                                      line.match(/^#{1,3}\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) ||
                                      line.includes('### 🏆') || line.includes('### 💰') || 
                                      line.includes('### 🤔') || line.includes('### 💡') ||
                                      line.includes('## 🏆') || line.includes('## 💰') || 
                                      line.includes('## 🤔') || line.includes('## 💡')) {
                                    
                                    if (line.includes('🔴') || line.toLowerCase().includes('negatif') || line.toLowerCase().includes('olumsuz') ||
                                        line.includes('🟢') || line.toLowerCase().includes('pozitif') || line.toLowerCase().includes('olumlu')) {
                                      categoryCounts.themes++;
                                    } else if (line.includes('💡') || line.toLowerCase().includes('öneri') || line.toLowerCase().includes('tavsiye') ||
                                               line.includes('⚡') || line.toLowerCase().includes('aksiyon') || line.toLowerCase().includes('yapılacak') || line.toLowerCase().includes('iyileştirme')) {
                                      categoryCounts.actions++;
                                    } else if (line.includes('🧠') || line.toLowerCase().includes('analiz') || line.toLowerCase().includes('summary') || line.toLowerCase().includes('genel') || line.toLowerCase().includes('özet') ||
                                               line.includes('🤔') || line.toLowerCase().includes('karşılaştırma') || line.toLowerCase().includes('comparison')) {
                                      categoryCounts.overview++;
                                    } else {
                                      categoryCounts.insights++;
                                    }
                                  }
                                });
                                
                                // Eğer hiç başlık bulunamazsa, tüm içeriği overview'da göster
                                if (Object.values(categoryCounts).every(count => count === 0)) {
                                  categoryCounts.overview = 1;
                                }
                                
                                const tabs = [
                                  { key: 'insights', icon: '📊', title: 'İçgörü Kartları', count: categoryCounts.insights },
                                  { key: 'overview', icon: '🧠', title: 'İçgörü', count: categoryCounts.overview },
                                  { key: 'themes', icon: '🎯', title: 'Temalar', count: categoryCounts.themes },
                                  { key: 'actions', icon: '⚡', title: 'Aksiyonlar', count: categoryCounts.actions }
                                ] as const;
                                
                                return tabs.map((tab) => (
                                  <button
                                    key={tab.key}
                                    onClick={() => setActiveDetailTab(tab.key)}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 text-sm ${
                                      activeDetailTab === tab.key
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                  >
                                    <span>{tab.icon}</span>
                                    <span>{tab.title}</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                                      {tab.count}
                                    </span>
                                  </button>
                                ));
                              })()}
                            </div>
                          </div>

                          <div className="p-8 overflow-y-auto" style={{maxHeight: "70vh"}}>
                            {(() => {
                              // AI analizini parse et ve kategorize et
                              const analysisText = analysis.result;
                              const lines = analysisText.split('\n').filter(line => line.trim());
                              
                              // Farklı bölümleri tespit et
                              const allSections: Array<{title: string, content: string[], icon: string, gradient: string, bgGradient: string, borderColor: string, category: 'insights' | 'overview' | 'themes' | 'actions'}> = [];
                              let currentSection: {title: string, content: string[], icon: string, gradient: string, bgGradient: string, borderColor: string, category: 'insights' | 'overview' | 'themes' | 'actions'} | null = null;
                              
                              lines.forEach((line: string) => {
                                // Başlık tespiti - Genişletilmiş pattern
                                  if (line.match(/^\d+\.\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) || 
                                      line.match(/^#{1,3}\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) ||
                                      line.includes('### 🏆') || line.includes('### 💰') || 
                                      line.includes('### 🤔') || line.includes('### 💡') ||
                                      line.includes('## 🏆') || line.includes('## 💰') || 
                                      line.includes('## 🤔') || line.includes('## 💡')) {
                                    if (currentSection) {
                                    allSections.push(currentSection);
                                    }
                                    
                                    // İkon ve renk belirleme
                                    let icon = '📊';
                                    let gradient = 'from-blue-500 to-cyan-500';
                                    let bgGradient = 'from-blue-50 to-cyan-50';
                                    let borderColor = 'border-blue-200';
                                  let category: 'insights' | 'overview' | 'themes' | 'actions' = 'insights';
                                    
                                    if (line.includes('🔴') || line.toLowerCase().includes('negatif') || line.toLowerCase().includes('olumsuz')) {
                                      icon = '🔴';
                                      gradient = 'from-red-500 to-pink-500';
                                      bgGradient = 'from-red-50 to-pink-50';
                                      borderColor = 'border-red-200';
                                    category = 'themes';
                                    } else if (line.includes('🟢') || line.toLowerCase().includes('pozitif') || line.toLowerCase().includes('olumlu')) {
                                      icon = '🟢';
                                      gradient = 'from-green-500 to-emerald-500';
                                      bgGradient = 'from-green-50 to-emerald-50';
                                      borderColor = 'border-green-200';
                                    category = 'themes';
                                    } else if (line.includes('💡') || line.toLowerCase().includes('öneri') || line.toLowerCase().includes('tavsiye')) {
                                      icon = '💡';
                                      gradient = 'from-yellow-500 to-orange-500';
                                      bgGradient = 'from-yellow-50 to-orange-50';
                                      borderColor = 'border-yellow-200';
                                    category = 'actions';
                                    } else if (line.includes('⭐') || line.toLowerCase().includes('rating') || line.toLowerCase().includes('puan')) {
                                      icon = '⭐';
                                      gradient = 'from-purple-500 to-pink-500';
                                      bgGradient = 'from-purple-50 to-pink-50';
                                      borderColor = 'border-purple-200';
                                    category = 'insights';
                                    } else if (line.includes('💰') || line.toLowerCase().includes('fiyat') || line.toLowerCase().includes('price') || line.toLowerCase().includes('uygun fiyat') || line.toLowerCase().includes('fiyat performans')) {
                                      icon = '💰';
                                      gradient = 'from-green-500 to-teal-500';
                                      bgGradient = 'from-green-50 to-teal-50';
                                      borderColor = 'border-green-200';
                                    category = 'insights';
                                  } else if (line.includes('🧠') || line.toLowerCase().includes('analiz') || line.toLowerCase().includes('summary') || line.toLowerCase().includes('genel') || line.toLowerCase().includes('özet')) {
                                      icon = '🧠';
                                      gradient = 'from-indigo-500 to-purple-500';
                                      bgGradient = 'from-indigo-50 to-purple-50';
                                      borderColor = 'border-indigo-200';
                                    category = 'overview';
                                    } else if (line.includes('🏆') || line.toLowerCase().includes('kazanan') || line.toLowerCase().includes('winner') || line.toLowerCase().includes('yüksek rating') || line.toLowerCase().includes('rating performans')) {
                                      icon = '🏆';
                                      gradient = 'from-yellow-500 to-orange-500';
                                      bgGradient = 'from-yellow-50 to-orange-50';
                                      borderColor = 'border-yellow-200';
                                    category = 'insights';
                                    } else if (line.includes('🤔') || line.toLowerCase().includes('karşılaştırma') || line.toLowerCase().includes('comparison')) {
                                      icon = '🤔';
                                      gradient = 'from-purple-500 to-pink-500';
                                      bgGradient = 'from-purple-50 to-pink-50';
                                      borderColor = 'border-purple-200';
                                    category = 'overview';
                                  } else if (line.includes('⚡') || line.toLowerCase().includes('aksiyon') || line.toLowerCase().includes('yapılacak') || line.toLowerCase().includes('iyileştirme')) {
                                    icon = '⚡';
                                    gradient = 'from-orange-500 to-red-500';
                                    bgGradient = 'from-orange-50 to-red-50';
                                    borderColor = 'border-orange-200';
                                    category = 'actions';
                                    }
                                    
                                    currentSection = {
                                      title: line.replace(/^\d+\.\s*/, '').replace(/^#{1,3}\s*/, '').trim(),
                                      content: [],
                                      icon,
                                      gradient,
                                      bgGradient,
                                    borderColor,
                                    category
                                    };
                                  } else if (line.trim() && currentSection) {
                                    currentSection.content.push(line.trim());
                                  }
                                });
                                
                                if (currentSection) {
                                allSections.push(currentSection);
                              }
                              
                              // Eğer bölüm bulunamazsa, tüm metni genel bakış olarak göster
                              if (allSections.length === 0) {
                                allSections.push({
                                    title: '🤖 AI Analiz Sonuçları',
                                    content: [analysisText],
                                    icon: '🤖',
                                    gradient: 'from-gray-500 to-gray-600',
                                    bgGradient: 'from-gray-50 to-gray-100',
                                  borderColor: 'border-gray-200',
                                  category: 'overview'
                                });
                              }
                              
                              // Aktif tab'a göre filtreleme
                              const filteredSections = allSections.filter(section => section.category === activeDetailTab);
                              
                              // Eğer seçilen kategoride içerik yoksa varsayılan içerik göster
                              if (filteredSections.length === 0) {
                                const emptyStateContent = {
                                  insights: { icon: '📊', title: 'İçgörü Kartları', desc: 'Bu analiz için henüz detaylı içgörü kartları mevcut değil.' },
                                  overview: { icon: '🧠', title: 'Genel Bakış', desc: 'Bu analiz için genel bakış bilgileri mevcut değil.' },
                                  themes: { icon: '🎯', title: 'Temalar', desc: 'Bu analiz için tema bilgileri mevcut değil.' },
                                  actions: { icon: '⚡', title: 'Aksiyon Önerileri', desc: 'Bu analiz için aksiyon önerileri mevcut değil.' }
                                };
                                const content = emptyStateContent[activeDetailTab];
                                
                                return (
                                  <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                                      <span className="text-3xl text-gray-400">{content.icon}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-700 mb-3">{content.title}</h3>
                                    <p className="text-gray-500 max-w-md mx-auto leading-relaxed">{content.desc}</p>
                                    <div className="mt-8 p-6 bg-gray-50 rounded-xl max-w-2xl mx-auto">
                                      <h4 className="font-semibold text-gray-700 mb-3">Mevcut Analiz İçeriği:</h4>
                                      <div className="bg-white rounded-lg p-4 text-left">
                                        <p className="text-gray-600 text-sm leading-relaxed">{analysisText.substring(0, 500)}...</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="space-y-6">
                                  <div className="text-center mb-8">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
                                      <span className="text-3xl">
                                        {activeDetailTab === 'insights' && '📊'}
                                        {activeDetailTab === 'overview' && '🧠'}
                                        {activeDetailTab === 'themes' && '🎯'}
                                        {activeDetailTab === 'actions' && '⚡'}
                                      </span>
                                      {activeDetailTab === 'insights' && 'İçgörü Kartları'}
                                      {activeDetailTab === 'overview' && 'Genel Bakış'}
                                      {activeDetailTab === 'themes' && 'Temalar'}
                                      {activeDetailTab === 'actions' && 'Aksiyon Önerileri'}
                                    </h3>
                                    <p className="text-gray-600">
                                      {activeDetailTab === 'insights' && 'Analizden çıkarılan temel içgörüler ve bulgular'}
                                      {activeDetailTab === 'overview' && 'Analizin genel özeti ve sonuçları'}
                                      {activeDetailTab === 'themes' && 'Kullanıcı yorumlarında öne çıkan ana temalar'}
                                      {activeDetailTab === 'actions' && 'Önerilen iyileştirmeler ve aksiyonlar'}
                                    </p>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {filteredSections.map((section, idx) => (
                                      <div key={idx} className={`group relative bg-gradient-to-br ${section.bgGradient} rounded-3xl p-8 border ${section.borderColor} shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${filteredSections.length === 1 ? 'lg:col-span-2' : ''}`}>
                                        <div className={`absolute inset-0 bg-gradient-to-br ${section.bgGradient.replace('50', '400/10')} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                                        <div className="relative">
                                          <div className="flex items-center gap-4 mb-6">
                                            <div className={`w-14 h-14 bg-gradient-to-r ${section.gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
                                              <span className="text-white text-2xl">{section.icon}</span>
                                            </div>
                                            <div>
                                              <h2 className="text-xl font-bold text-gray-800">{section.title.replace(/[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆🤔]/g, '').trim()}</h2>
                                            </div>
                                          </div>
                                          
                                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
                                            <div className="space-y-4">
                                              {section.content.map((line, lineIdx) => {
                                                // Bullet points ve önemli bilgileri vurgula
                                                if (line.startsWith('-') || line.startsWith('•')) {
                                                  return (
                                                    <div key={lineIdx} className={`p-3 bg-gradient-to-r ${section.bgGradient.replace('50', '100')} rounded-lg border-l-4 ${section.borderColor.replace('border-', 'border-l-')}`}>
                                                      <p className="text-gray-700 text-sm font-medium">{line.replace(/^[-•]\s*/, '').trim()}</p>
                                                    </div>
                                                  );
                                                } else if (line.includes(':') && line.length < 100) {
                                                  // Key-value pairs için
                                                  const [key, value] = line.split(':');
                                                  return (
                                                    <div key={lineIdx} className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                                                      <span className="font-semibold text-gray-700">{key.trim()}:</span>
                                                      <span className="font-bold text-gray-800">{value?.trim()}</span>
                                                    </div>
                                                  );
                                                } else {
                                                  return (
                                                    <div key={lineIdx} className="p-3 bg-white/40 rounded-lg">
                                                      <p className="text-gray-700 leading-relaxed">{line}</p>
                                                    </div>
                                                  );
                                                }
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  </div>
                                );
                              })()}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl text-gray-400">👆</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-700 mb-3">
                        Analiz Seçin
                      </h3>
                      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                        Detaylarını görmek istediğiniz analizi sol taraftan seçin.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 