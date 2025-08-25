'use client';

import { useState } from 'react';

interface SearchFormProps {
  onScrape: (url: string, platform: string, maxPages: number) => Promise<void>;
  isLoading: boolean;
}

export default function SearchForm({ onScrape, isLoading }: SearchFormProps) {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');

  const detectPlatform = (url: string): string => {
    if (url.includes('hepsiburada.com')) {
      return 'hepsiburada';
    } else if (url.includes('trendyol.com')) {
      return 'trendyol';
    } else if (url.includes('n11.com')) {
      return 'n11';
    } else if (url.includes('aliexpress.com')) {
      return 'aliexpress';
    } else if (url.includes('amazon.com.tr')) {
      return 'amazon';
    }
    return '';
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    const detectedPlatform = detectPlatform(value);
    if (detectedPlatform) {
      setPlatform(detectedPlatform);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      alert('Lütfen bir URL girin');
      return;
    }

    if (!platform) {
      alert('Platform otomatik olarak algılanamadı. Lütfen manuel olarak seçin.');
      return;
    }

    // Platform'a göre sabit değerler kullan
    const maxPages = platform === 'trendyol' ? 40 : platform === 'n11' ? 8 : platform === 'aliexpress' ? 10 : platform === 'amazon' ? 20 : 10;
    await onScrape(url.trim(), platform, maxPages);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label htmlFor="url" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🔗</span> Ürün URL'si
        </label>
        <div className="relative">
        <input
          type="url"
          id="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.hepsiburada.com/... veya https://www.trendyol.com/... veya https://www.n11.com/... veya https://tr.aliexpress.com/... veya https://www.amazon.com.tr/..."
            className="w-full px-6 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-gray-700 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          required
          disabled={isLoading}
        />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            🌐
          </div>
          {url && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              {platform === 'hepsiburada' && <span className="text-orange-500">🛍️</span>}
              {platform === 'trendyol' && <span className="text-orange-500">🛒</span>}
              {platform === 'n11' && <span className="text-blue-500">🏪</span>}
              {platform === 'aliexpress' && <span className="text-red-500">🌎</span>}
              {platform === 'amazon' && <span className="text-yellow-600">📦</span>}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <span>💡</span> Hepsiburada, Trendyol, N11, AliExpress veya Amazon ürün sayfası URL'sini yapıştırın
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
            className="w-full px-6 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
          required
          disabled={isLoading}
        >
          <option value="">Platform Seçin</option>
            <option value="hepsiburada">🛍️ Hepsiburada</option>
            <option value="trendyol">🛒 Trendyol</option>
            <option value="n11">🏪 N11</option>
            <option value="aliexpress">🌎 AliExpress</option>
            <option value="amazon">📦 Amazon</option>
        </select>
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            🎯
          </div>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            ⬇️
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <span>⚡</span> Platform otomatik algılanır.
        </p>
      </div>

      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={isLoading || !url || !platform}
          className="group relative px-12 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white font-bold rounded-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
          style={{
            backgroundSize: '200% 100%',
            backgroundPosition: isLoading ? '100% 0' : '0% 0'
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="animate-pulse">Yorumlar Çekiliyor...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">🚀</span>
              <span>Yorumları Çek</span>
              <span className="text-xl group-hover:scale-110 transition-transform duration-300">✨</span>
            </span>
          )}
          
          {/* Hover effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -skew-x-12"></div>
        </button>
      </div>

      {/* Örnek URL'ler - Daha Düzenli Tasarım */}
      <div className="mt-8 p-8 bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 rounded-3xl border border-gray-200/50 shadow-xl shadow-gray-200/50">
        <div className="text-center mb-8">
          <h4 className="text-xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <span className="text-2xl">📋</span> 
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Örnek URL'ler
            </span>
          </h4>
          <p className="text-sm text-gray-600">
            Aşağıdaki URL'leri kopyalayıp yukarıdaki alana yapıştırabilirsiniz
          </p>
        </div>

        <div className="space-y-6">
          {/* Hepsiburada */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🛍️</span>
                </div>
                <div>
                  <h5 className="font-bold text-orange-700 text-lg">Hepsiburada</h5>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.hepsiburada.com/apple-iphone-16-pro-max-256-gb-apple-turkiye-garantili-p-HBCV00009L7GFV')}
                className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Kopyala
              </button>
            </div>
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4">
              <code className="text-sm text-blue-600 font-mono break-all leading-relaxed">
                https://www.hepsiburada.com/apple-iphone-16-pro-max-256-gb-apple-turkiye-garantili-p-HBCV00009L7GFV
              </code>
            </div>
          </div>

          {/* Trendyol */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🛒</span>
                </div>
                <div>
                  <h5 className="font-bold text-orange-700 text-lg">Trendyol</h5>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.trendyol.com/apple/iphone-16-pro-max-256-gb-apple-turkiye-garantili-akilli-telefon-p-884547086')}
                className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Kopyala
              </button>
            </div>
            <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-4">
              <code className="text-sm text-blue-600 font-mono break-all leading-relaxed">
                https://www.trendyol.com/apple/iphone-16-pro-max-256-gb-apple-turkiye-garantili-akilli-telefon-p-884547086
              </code>
            </div>
          </div>

          {/* N11 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🏪</span>
                </div>
                <div>
                  <h5 className="font-bold text-blue-700 text-lg">N11</h5>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.n11.com/urun/apple-iphone-16-pro-max-256-gb-apple-turkiye-garantili-38482652')}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Kopyala
              </button>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
              <code className="text-sm text-blue-600 font-mono break-all leading-relaxed">
                https://www.n11.com/urun/apple-iphone-16-pro-max-256-gb-apple-turkiye-garantili-38482652
              </code>
            </div>
          </div>

          {/* AliExpress */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🌎</span>
                </div>
          <div>
                  <h5 className="font-bold text-red-700 text-lg">AliExpress</h5>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('https://tr.aliexpress.com/item/1005007474018766.html')}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Kopyala
              </button>
            </div>
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4">
              <code className="text-sm text-blue-600 font-mono break-all leading-relaxed">
                https://tr.aliexpress.com/item/1005007474018766.html
              </code>
            </div>
          </div>

          {/* Amazon */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-yellow-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📦</span>
          </div>
          <div>
                  <h5 className="font-bold text-yellow-700 text-lg">Amazon</h5>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.amazon.com.tr/dp/B0D2XRXNGY')}
                className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Kopyala
              </button>
            </div>
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4">
              <code className="text-sm text-blue-600 font-mono break-all leading-relaxed">
                https://www.amazon.com.tr/dp/B0D2XRXNGY
              </code>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <span>💡</span>
            <span>Kopyala butonuna tıklayarak URL'leri kolayca kopyalayabilirsiniz</span>
          </div>
        </div>
      </div>
    </form>
  );
} 