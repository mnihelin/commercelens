'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { username, email, logout } = useAuth();

  const menuItems = [
    {
      href: '/',
      icon: '🏠',
      label: 'Ana Sayfa',
      description: 'Yorum çekme ve analiz'
    },
    {
      href: '/database',
      icon: '🗄️',
      label: 'Veritabanı',
      description: 'MongoDB görünümü'
    },
    {
      href: '/benchmark',
      icon: '⚡',
      label: 'Satıcı Benchmark',
      description: 'Satıcı karşılaştırması'
    },
    {
      href: '/product-benchmark',
      icon: '📊',
      label: 'Ürün Benchmark',
      description: 'Ürün karşılaştırması'
    },
    {
      href: '/history',
      icon: '📈',
      label: 'Analiz Geçmişi',
      description: 'Geçmiş AI analizleri'
    }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white/90 backdrop-blur-lg border-r border-gray-200/50 z-50 transition-all duration-300 ${
        isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'w-72 lg:w-72'
      }`}>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <img 
                  src="/images/theclico-logo.png" 
                  alt="TheClico Logo" 
                  className="w-10 h-auto"
                />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">TheClico CommerceLens</h2>
                  <p className="text-xs text-gray-500">E-ticaret Analiz</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isCollapsed ? '➡️' : '⬅️'}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                      isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25' 
                        : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className={`text-xs truncate ${
                          isActive ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {item.description}
                        </div>
                      </div>
                    )}
                    {!isCollapsed && isActive && (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200/50 bg-white/50">
          {!isCollapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-lg">👤</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {username}
                  </div>
                  {email && (
                    <div className="text-xs text-gray-400 truncate">
                      📧 {email}
                    </div>
                  )}
                  <div className="text-xs text-green-600">
                    🟢 Oturum açık
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <span className="text-lg">🚪</span>
                <span>Çıkış Yap</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={logout}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Çıkış Yap"
              >
                <span className="text-lg">🚪</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed top-4 left-4 z-50 lg:hidden p-3 bg-white rounded-xl shadow-lg border border-gray-200"
      >
        <span className="text-xl">☰</span>
      </button>
    </>
  );
};

export default Sidebar; 