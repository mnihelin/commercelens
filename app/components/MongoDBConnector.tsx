'use client';

import { useState } from 'react';

interface MongoDBConnectorProps {
  username: string;
  onConnectionSuccess: () => void;
}

export default function MongoDBConnector({ username, onConnectionSuccess }: MongoDBConnectorProps) {
  const [connectionString, setConnectionString] = useState('localhost:27017');
  const [databaseName, setDatabaseName] = useState('ecommerce_analytics');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setSuggestions([]);

    console.log('MongoDB bağlantı denemesi:', { username, connectionString, databaseName });

    try {
      const response = await fetch('/api/mongodb/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          connectionString,
          databaseName,
        }),
      });

      const result = await response.json();
      console.log('MongoDB bağlantı sonucu:', result);

      if (result.success) {
        onConnectionSuccess();
      } else {
        setError(result.error);
        if (result.details) {
          setError(`${result.error}: ${result.details}`);
        }
        if (result.suggestions) {
          setSuggestions(result.suggestions);
        }
      }
    } catch (err) {
      console.error('MongoDB bağlantı hatası:', err);
      setError('Ağ hatası oluştu');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl mb-6 shadow-lg shadow-green-500/25">
            <span className="text-3xl">🔗</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-blue-800 bg-clip-text text-transparent mb-4">
            MongoDB Bağlantısı
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
            Kendi MongoDB veritabanınıza bağlanın ve e-ticaret verilerinizi analiz edin
          </p>
        </div>

        {/* Connection Form */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-white/20">
          <div className="space-y-6">
            {/* Connection String */}
            <div>
              <label htmlFor="connectionString" className="block text-sm font-semibold text-gray-700 mb-2">
                MongoDB Sunucu Adresi
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="connectionString"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  placeholder="localhost:27017"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🖥️
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Örnek: localhost:27017, 192.168.1.100:27017 veya cloud.mongodb.com
              </p>
            </div>

            {/* Database Name */}
            <div>
              <label htmlFor="databaseName" className="block text-sm font-semibold text-gray-700 mb-2">
                Veritabanı Adı
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="databaseName"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  placeholder="ecommerce_analytics"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🗄️
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Yorumların saklanacağı veritabanı adı (varsayılan: ecommerce_analytics)
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-red-500 text-lg">❌</span>
                  <h4 className="text-red-800 font-semibold">Bağlantı Hatası</h4>
                </div>
                <p className="text-red-700 text-sm mb-3">{error}</p>
                
                {suggestions.length > 0 && (
                  <div>
                    <h5 className="text-red-800 font-medium text-sm mb-2">Öneriler:</h5>
                    <ul className="text-red-700 text-xs space-y-1">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span>•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={isConnecting || !connectionString || !databaseName}
              className="w-full px-6 py-4 bg-gradient-to-r from-green-600 via-blue-600 to-green-600 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Bağlantı Test Ediliyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>🔗</span>
                  MongoDB'ye Bağlan
                  <span>✨</span>
                </span>
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 MongoDB Kurulum Bilgisi</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• MongoDB Community Edition'ı indirebilirsiniz: mongodb.com</p>
              <p>• Varsayılan port: 27017</p>
              <p>• Yerel kurulum için: localhost:27017</p>
              <p>• Cloud servisler için tam connection string girin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 