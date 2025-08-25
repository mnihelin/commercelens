'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sidebar from '../components/Sidebar';

interface AnalysisResult {
  collectionName: string;
  platformInfo: {
    platforms: string[];
    products: string[];
  };
  reviewCount: number;
  analyzedComments: number;
  result: string;
  timestamp: string;
}

export default function AnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const collectionName = searchParams.get('collection');

  const performAnalysis = async (collection: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ collectionName: collection }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAnalysisResult(data.analysis);
      } else {
        setError(data.error || 'Analiz sırasında hata oluştu');
      }
    } catch (err) {
      setError('Ağ hatası oluştu');
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (collectionName) {
      performAnalysis(collectionName);
    } else {
      setError('Koleksiyon adı belirtilmemiş');
    }
  }, [collectionName]);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('tr-TR');
    } catch {
      return timestamp;
    }
  };

  const parseAnalysisResult = (text: string) => {
    const sections = text.split(/(?=\d+\.\s*[🔴🟢🧩💡🧠])/);
    return sections.filter(section => section.trim().length > 0);
  };

  const downloadAnalysis = () => {
    if (!analysisResult) return;
    
    setIsDownloading(true);
    
    try {
      // Analiz raporunu metin formatında hazırla
      const reportContent = `
===========================================
AI ANALİZ RAPORU
===========================================

📊 Analiz Bilgileri:
- Koleksiyon: ${analysisResult.collectionName}
- Platform: ${analysisResult.platformInfo.platforms.join(', ')}
- Analiz Edilen Yorum Sayısı: ${analysisResult.analyzedComments}
- Toplam Yorum Sayısı: ${analysisResult.reviewCount}
- Analiz Tarihi: ${formatDate(analysisResult.timestamp)}

🏪 Ürünler:
${analysisResult.platformInfo.products.slice(0, 10).map(product => `- ${product}`).join('\n')}

===========================================
🤖 GEMINI AI ANALİZ SONUÇLARI
===========================================

${analysisResult.result}

===========================================
Rapor CommerceLens tarafından oluşturulmuştur
Gemini AI ile desteklenmektedir
===========================================
`;

      // Dosya adını oluştur
      const fileName = `analiz_${analysisResult.collectionName}_${new Date().toISOString().split('T')[0]}.txt`;
      
      // Blob oluştur ve indir
      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadSuccess(`Analiz raporu "${fileName}" olarak indirildi!`);
      setTimeout(() => setDownloadSuccess(null), 5000);
      
    } catch (err) {
      setError('Dosya indirme hatası oluştu');
      console.error('Download analysis error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!collectionName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-red-500">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Hatalı Erişim</h2>
          <p className="text-red-600 mb-6">Koleksiyon adı belirtilmemiş</p>
          <Link
            href="/database"
            className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
          >
            Veritabanına Dön
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-white text-2xl">🤖</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">AI Analiz Yapılıyor...</h2>
          <p className="text-gray-600 mb-6">"{collectionName}" koleksiyonu Gemini AI ile analiz ediliyor</p>
          <div className="flex justify-center items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-100"></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce delay-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-red-500">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Analiz Hatası</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => collectionName && performAnalysis(collectionName)}
              className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
            >
              Tekrar Dene
            </button>
            <Link
              href="/database"
              className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Geri Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <Sidebar />
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="relative lg:ml-72 transition-all duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-6 shadow-lg shadow-purple-500/25">
              <span className="text-3xl">🤖</span>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent mb-4">
              AI Analiz Raporu
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Gemini AI tarafından gerçekleştirilen müşteri yorumu analizi
            </p>
            <div className="flex justify-center items-center gap-4 mt-6">
              <Link 
                href="/database"
                className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
              >
                <span>🗄️</span>
                Veritabanı
              </Link>
              <Link 
                href="/"
                className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/80 transition-colors"
              >
                <span>🏠</span>
                Ana Sayfa
              </Link>
            </div>
          </div>

          {/* Analysis Results */}
          {analysisResult && (
            <>
              {/* Analysis Overview */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-8 mb-8 border border-white/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">📊</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">Analiz Özeti</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📚</span>
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Koleksiyon</p>
                        <p className="text-lg font-bold text-blue-800">{analysisResult.collectionName}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💬</span>
                      <div>
                        <p className="text-sm text-green-600 font-medium">Analiz Edilen</p>
                        <p className="text-lg font-bold text-green-800">{analysisResult.analyzedComments} yorum</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏪</span>
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Platform</p>
                        <p className="text-lg font-bold text-purple-800">{analysisResult.platformInfo.platforms.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🕒</span>
                      <div>
                        <p className="text-sm text-orange-600 font-medium">Analiz Tarihi</p>
                        <p className="text-sm font-bold text-orange-800">{formatDate(analysisResult.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Content */}
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 border border-white/20 overflow-hidden">
                <div className="p-8 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">🤖</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Gemini AI Analizi</h2>
                      <p className="text-sm text-gray-600">Müşteri yorumlarının detaylı analizi</p>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  <div className="space-y-8">
                    {(() => {
                      // AI analizini parse et ve kategorize et
                      const analysisText = analysisResult.result;
                      const lines = analysisText.split('\n').filter(line => line.trim());
                      
                      // Farklı bölümleri tespit et
                      const sections: Array<{title: string, content: string[], icon: string, gradient: string, bgGradient: string, borderColor: string}> = [];
                      let currentSection: {title: string, content: string[], icon: string, gradient: string, bgGradient: string, borderColor: string} | null = null;
                      
                                              lines.forEach((line: string) => {
                          // Başlık tespiti - Genişletilmiş pattern
                          if (line.match(/^\d+\.\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) || 
                              line.match(/^#{1,3}\s*[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆]/) ||
                              line.includes('### 🏆') || line.includes('### 💰') || 
                              line.includes('### 🤔') || line.includes('### 💡') ||
                              line.includes('## 🏆') || line.includes('## 💰') || 
                              line.includes('## 🤔') || line.includes('## 💡')) {
                          if (currentSection) {
                            sections.push(currentSection);
                          }
                          
                          // İkon ve renk belirleme
                          let icon = '📊';
                          let gradient = 'from-blue-500 to-cyan-500';
                          let bgGradient = 'from-blue-50 to-cyan-50';
                          let borderColor = 'border-blue-200';
                          
                          if (line.includes('🔴') || line.toLowerCase().includes('negatif') || line.toLowerCase().includes('olumsuz')) {
                            icon = '🔴';
                            gradient = 'from-red-500 to-pink-500';
                            bgGradient = 'from-red-50 to-pink-50';
                            borderColor = 'border-red-200';
                          } else if (line.includes('🟢') || line.toLowerCase().includes('pozitif') || line.toLowerCase().includes('olumlu')) {
                            icon = '🟢';
                            gradient = 'from-green-500 to-emerald-500';
                            bgGradient = 'from-green-50 to-emerald-50';
                            borderColor = 'border-green-200';
                          } else if (line.includes('💡') || line.toLowerCase().includes('öneri') || line.toLowerCase().includes('tavsiye')) {
                            icon = '💡';
                            gradient = 'from-yellow-500 to-orange-500';
                            bgGradient = 'from-yellow-50 to-orange-50';
                            borderColor = 'border-yellow-200';
                          } else if (line.includes('⭐') || line.toLowerCase().includes('rating') || line.toLowerCase().includes('puan')) {
                            icon = '⭐';
                            gradient = 'from-purple-500 to-pink-500';
                            bgGradient = 'from-purple-50 to-pink-50';
                            borderColor = 'border-purple-200';
                          } else if (line.includes('💰') || line.toLowerCase().includes('fiyat') || line.toLowerCase().includes('price') || line.toLowerCase().includes('uygun fiyat') || line.toLowerCase().includes('fiyat performans')) {
                            icon = '💰';
                            gradient = 'from-green-500 to-teal-500';
                            bgGradient = 'from-green-50 to-teal-50';
                            borderColor = 'border-green-200';
                          } else if (line.includes('🧠') || line.toLowerCase().includes('analiz') || line.toLowerCase().includes('summary')) {
                            icon = '🧠';
                            gradient = 'from-indigo-500 to-purple-500';
                            bgGradient = 'from-indigo-50 to-purple-50';
                            borderColor = 'border-indigo-200';
                          } else if (line.includes('🏆') || line.toLowerCase().includes('kazanan') || line.toLowerCase().includes('winner') || line.toLowerCase().includes('yüksek rating') || line.toLowerCase().includes('rating performans')) {
                            icon = '🏆';
                            gradient = 'from-yellow-500 to-orange-500';
                            bgGradient = 'from-yellow-50 to-orange-50';
                            borderColor = 'border-yellow-200';
                          } else if (line.includes('🤔') || line.toLowerCase().includes('karşılaştırma') || line.toLowerCase().includes('comparison')) {
                            icon = '🤔';
                            gradient = 'from-purple-500 to-pink-500';
                            bgGradient = 'from-purple-50 to-pink-50';
                            borderColor = 'border-purple-200';
                          }
                          
                                                      currentSection = {
                              title: line.replace(/^\d+\.\s*/, '').replace(/^#{1,3}\s*/, '').trim(),
                              content: [],
                              icon,
                              gradient,
                              bgGradient,
                              borderColor
                            };
                        } else if (line.trim() && currentSection) {
                          currentSection.content.push(line.trim());
                        }
                      });
                      
                      if (currentSection) {
                        sections.push(currentSection);
                      }
                      
                      // Eğer bölüm bulunamazsa, tüm metni tek bölüm olarak göster
                      if (sections.length === 0) {
                        sections.push({
                          title: '🤖 AI Analiz Sonuçları',
                          content: [analysisText],
                          icon: '🤖',
                          gradient: 'from-gray-500 to-gray-600',
                          bgGradient: 'from-gray-50 to-gray-100',
                          borderColor: 'border-gray-200'
                        });
                      }
                      
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {sections.map((section, idx) => (
                            <div key={idx} className={`group relative bg-gradient-to-br ${section.bgGradient} rounded-3xl p-8 border ${section.borderColor} shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${sections.length === 1 ? 'lg:col-span-2' : ''}`}>
                              <div className={`absolute inset-0 bg-gradient-to-br ${section.bgGradient.replace('50', '400/10')} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                              <div className="relative">
                                <div className="flex items-center gap-4 mb-6">
                                  <div className={`w-14 h-14 bg-gradient-to-r ${section.gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
                                    <span className="text-white text-2xl">{section.icon}</span>
                                  </div>
                                  <div>
                                    <h2 className="text-xl font-bold text-gray-800">{section.title.replace(/[🔴🟢🧩💡🧠📊⭐💰👍👎🚀⚡🏆🤔]/g, '').trim()}</h2>
                                    <p className="text-gray-600">AI Analiz Bölümü</p>
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
                      );
                    })()}


                  </div>
                </div>
              </div>

              {/* Success Message */}
              {downloadSuccess && (
                <div className="mt-8 max-w-2xl mx-auto">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-green-800 font-medium">{downloadSuccess}</p>
                      <p className="text-green-600 text-sm">İndirdiğiniz dosyayı bilgisayarınızda saklayabilirsiniz</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 flex justify-center gap-4 flex-wrap">
                <button
                  onClick={downloadAnalysis}
                  disabled={isDownloading}
                  className={`px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40 transform hover:-translate-y-1 ${
                    isDownloading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isDownloading ? '📥 İndiriliyor...' : '📥 Raporu İndir'}
                </button>
                <button
                  onClick={() => collectionName && performAnalysis(collectionName)}
                  disabled={isLoading}
                  className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 transform hover:-translate-y-1 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  🔄 Yeniden Analiz Et
                </button>
                <Link
                  href="/database"
                  className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg"
                >
                  📊 Veritabanına Dön
                </Link>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );}
  