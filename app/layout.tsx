import './globals.css'
import { AuthProvider } from './context/AuthContext'

export const metadata = {
  title: 'CommerceLens - E-ticaret Yorum Analizi',
  description: 'Trendyol, Hepsiburada, N11 ve AliExpress yorumlarını analiz edin',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}