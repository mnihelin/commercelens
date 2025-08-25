'use client';

import { useState } from 'react';

interface ProductSearchFormProps {
  onSearch: (searchTerm: string, platform: string) => Promise<void>;
  isLoading: boolean;
}

export default function ProductSearchForm({ onSearch, isLoading }: ProductSearchFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [platform, setPlatform] = useState('trendyol');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      alert('Lütfen ürün adını girin');
      return;
    }

    await onSearch(searchTerm.trim(), platform);
  };

  const copyToInput = (text: string) => {
    setSearchTerm(text);
    // Küçük bir feedback efekti
    const button = document.activeElement as HTMLElement;
    if (button) {
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 150);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="productSearch" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🔍</span> Ürün Adı
        </label>
        <div className="relative">
          <input
            type="text"
            id="productSearch"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Örnek: maybelline göz kalemi, iphone 15, samsung telefon..."
            className="w-full px-6 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 text-gray-700 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            required
            disabled={isLoading}
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            🛍️
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <span>⚡</span> Seçilen platformda arama yapılarak ilk 5 ürünün yorumları çekilecek
        </p>
      </div>

      <div>
        <label htmlFor="platform" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🏪</span> Platform
        </label>
        <div className="relative">
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-6 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            required
            disabled={isLoading}
          >
            <option value="trendyol">🛒 Trendyol (5 ürün, 40 scroll)</option>
            <option value="hepsiburada">🛍️ Hepsiburada (5 ürün, 6 sayfa)</option>
            <option value="n11">🏪 N11 (5 ürün, 8 sayfa)</option>
            <option value="aliexpress">🌎 AliExpress (5 ürün, 10 scroll)</option>
            <option value="amazon">📦 Amazon (5 ürün, 3 sayfa)</option>
          </select>
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            🎯
          </div>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            ⬇️
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <span>🔍</span> 
          {platform === 'trendyol' ? 'Trendyol\'da ilk 5 ürün için 40 scroll yapılır' : 
           platform === 'hepsiburada' ? 'Hepsiburada\'da ilk 5 ürün için 6\'şar sayfa çekilir' :
           platform === 'n11' ? 'N11\'de ilk 5 ürün için 8\'er sayfa çekilir' :
           platform === 'aliexpress' ? 'AliExpress\'te ilk 5 ürün için 10\'ar scroll yapılır' :
           'Amazon\'da ilk 5 ürün için 3\'er sayfa çekilir'}
        </p>
      </div>

      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={isLoading || !searchTerm.trim()}
          className="group relative px-12 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white font-bold rounded-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
          style={{
            backgroundSize: '200% 100%',
            backgroundPosition: isLoading ? '100% 0' : '0% 0'
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="animate-pulse">Ürünler Aranıyor...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">🔍</span>
              <span>Ürün Adı ile Ara</span>
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">🛍️</span>
            </span>
          )}
          
          {/* Hover effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -skew-x-12"></div>
        </button>
      </div>

      {/* Örnek Aramalar - Daha Düzenli Tasarım */}
      <div className="mt-8 p-8 bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-3xl border border-purple-200/50 shadow-xl shadow-purple-200/50">
        <div className="text-center mb-8">
          <h4 className="text-xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <span className="text-2xl">💡</span> 
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Örnek Aramalar
            </span>
          </h4>
          <p className="text-sm text-gray-600">
            Aşağıdaki örnekleri kullanarak aramayı hızlıca başlatabilirsiniz
          </p>
        </div>

        <div className="space-y-4">
          {/* Teknoloji */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📱</span>
                </div>
                <div>
                  <h5 className="font-bold text-blue-700 text-lg">Teknoloji</h5>
                  <p className="text-xs text-gray-500">Telefon, kulaklık, elektronik</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "iphone 15",
                "samsung galaxy",
                "airpods",
                "kablosuz kulaklık"
              ].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => copyToInput(example)}
                  disabled={isLoading}
                  className="text-left bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200/50 hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100 transition-all duration-200 text-sm text-blue-700 hover:text-blue-800 disabled:opacity-50 group"
                >
                  <span className="font-medium">"{example}"</span>
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
                </button>
              ))}
            </div>
          </div>

          {/* Moda & Güzellik */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-pink-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">💄</span>
                </div>
                <div>
                  <h5 className="font-bold text-pink-700 text-lg">Moda & Güzellik</h5>
                  <p className="text-xs text-gray-500">Kozmetik, giyim, ayakkabı</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "maybelline göz kalemi",
                "nike spor ayakkabı",
                "cilt bakım kremi",
                "levi's jean"
              ].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => copyToInput(example)}
                  disabled={isLoading}
                  className="text-left bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-3 border border-pink-200/50 hover:bg-gradient-to-r hover:from-pink-100 hover:to-rose-100 transition-all duration-200 text-sm text-pink-700 hover:text-pink-800 disabled:opacity-50 group"
                >
                  <span className="font-medium">"{example}"</span>
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ev & Yaşam */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🏠</span>
                </div>
                <div>
                  <h5 className="font-bold text-green-700 text-lg">Ev & Yaşam</h5>
                  <p className="text-xs text-gray-500">Mutfak, dekorasyon, temizlik</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "kahve makinesi",
                "yatak örtüsü",
                "robot süpürge",
                "tefal tava"
              ].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => copyToInput(example)}
                  disabled={isLoading}
                  className="text-left bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200/50 hover:bg-gradient-to-r hover:from-green-100 hover:to-emerald-100 transition-all duration-200 text-sm text-green-700 hover:text-green-800 disabled:opacity-50 group"
                >
                  <span className="font-medium">"{example}"</span>
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
                </button>
              ))}
            </div>
          </div>

          {/* Spor & Sağlık */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🏃‍♂️</span>
                </div>
                <div>
                  <h5 className="font-bold text-orange-700 text-lg">Spor & Sağlık</h5>
                  <p className="text-xs text-gray-500">Fitness, vitamin, spor ekipmanı</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "protein tozu",
                "yoga matı",
                "koşu ayakkabısı",
                "vitamin c"
              ].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => copyToInput(example)}
                  disabled={isLoading}
                  className="text-left bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200/50 hover:bg-gradient-to-r hover:from-orange-100 hover:to-red-100 transition-all duration-200 text-sm text-orange-700 hover:text-orange-800 disabled:opacity-50 group"
                >
                  <span className="font-medium">"{example}"</span>
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            <span>📊</span>
            <span>Her aramada 5 farklı ürünün yorumları analiz edilir</span>
          </div>
        </div>
      </div>
    </form>
  );
} 