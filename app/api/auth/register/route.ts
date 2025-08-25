import { NextRequest, NextResponse } from 'next/server';
import userModel from '../../../../lib/models/User';

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json();

    // Validasyon
    if (!username || !password || !email) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı, şifre ve e-posta gereklidir' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Şifre en az 6 karakter olmalıdır' },
        { status: 400 }
      );
    }

    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir e-posta adresi giriniz' },
        { status: 400 }
      );
    }

    // Kullanıcıyı oluştur
    const user = await userModel.createUser(username, password, email);

    return NextResponse.json({
      success: true,
      message: 'Hesap başarıyla oluşturuldu! Giriş yapabilirsiniz.',
      user: {
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error: any) {
    console.error('Register error:', error);
    
    if (error.message === 'Bu kullanıcı adı zaten kullanılıyor') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Hesap oluşturulurken bir hata oluştu' },
      { status: 500 }
    );
  }
} 