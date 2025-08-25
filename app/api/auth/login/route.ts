import { NextRequest, NextResponse } from 'next/server';
import userModel from '../../../../lib/models/User.js';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validasyon
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı ve şifre gereklidir' },
        { status: 400 }
      );
    }

    // Kullanıcıyı doğrula
    const user = await userModel.validateUser(username, password);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı veya şifre hatalı' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Giriş başarılı!',
      user: {
        username: user.username,
        email: user.email,
        lastLogin: user.lastLogin
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Giriş yapılırken bir hata oluştu' },
      { status: 500 }
    );
  }
} 