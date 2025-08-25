'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (isRegisterMode) {
      // Kayıt modu
      if (password !== confirmPassword) {
        setError('Şifreler eşleşmiyor');
        setIsLoading(false);
        return;
      }

      const result = await register(username, password, email);
      if (result.success) {
        setSuccess(result.message || 'Hesap başarıyla oluşturuldu!');
        // 2 saniye sonra giriş moduna geç
        setTimeout(() => {
          setIsRegisterMode(false);
          setPassword('');
          setConfirmPassword('');
          setEmail('');
          setSuccess('');
        }, 2000);
      } else {
        setError(result.error || 'Kayıt olurken bir hata oluştu');
      }
    } else {
      // Giriş modu
      const loginSuccess = await login(username, password);
      if (loginSuccess) {
        router.push('/');
      } else {
        setError('Kullanıcı adı veya şifre hatalı');
      }
    }

    setIsLoading(false);
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Image
              src="/images/theclico-logo.png"
              alt="TheClico Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">CommerceLens</h1>
          <p className="text-gray-600">E-ticaret Yorum Analiz Sistemi</p>
        </div>

        {/* Ana Form Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => !isRegisterMode || toggleMode()}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ${
                !isRegisterMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🚀 Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => isRegisterMode || toggleMode()}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ${
                isRegisterMode 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ✨ Kayıt Ol
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Kullanıcı Adı */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                  placeholder={isRegisterMode ? "Kullanıcı adınızı girin" : "theclico"}
                  required
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  👤
                </div>
              </div>
            </div>

            {/* E-posta (Sadece kayıt modunda) */}
            {isRegisterMode && (
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
                    placeholder="ornek@email.com"
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    📧
                  </div>
                </div>
              </div>
            )}

            {/* Şifre */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Şifre
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                  placeholder={isRegisterMode ? "En az 6 karakter" : "••••••••••••"}
                  required
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔒
                </div>
              </div>
              {isRegisterMode && (
                <p className="text-xs text-gray-500 mt-1">Şifre en az 6 karakter olmalıdır</p>
              )}
            </div>

            {/* Şifre Tekrarı (Sadece kayıt modunda) */}
            {isRegisterMode && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Şifre Tekrarı
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
                    placeholder="Şifrenizi tekrar girin"
                    required
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    🔐
                  </div>
                </div>
              </div>
            )}

            {/* Hata Mesajı */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                ❌ {error}
              </div>
            )}

            {/* Başarı Mesajı */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                ✅ {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full px-6 py-3 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${
                isRegisterMode
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600'
                  : 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isRegisterMode ? 'Kayıt Oluşturuluyor...' : 'Giriş Yapılıyor...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>{isRegisterMode ? '✨' : '🚀'}</span>
                  {isRegisterMode ? 'Hesap Oluştur' : 'Giriş Yap'}
                  <span>{isRegisterMode ? '🎉' : '✨'}</span>
                </span>
              )}
            </button>
          </form>

          {/* Demo Bilgileri (Sadece giriş modunda) */}
          {!isRegisterMode && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Demo Hesap:</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <div><strong>Kullanıcı Adı:</strong> theclico</div>
                <div><strong>Şifre:</strong> theclico2021</div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                💡 Yukarıdaki bilgilerle hızlıca test edebilirsiniz!
              </p>
            </div>
          )}

          {/* Mod Değiştirme Bilgisi */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              {isRegisterMode ? (
                <>
                  Zaten hesabınız var mı?{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Giriş yapın
                  </button>
                </>
              ) : (
                <>
                  Hesabınız yok mu?{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    Kayıt olun
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>© 2024 TheClico. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
} 