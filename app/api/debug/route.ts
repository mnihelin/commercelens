import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        MONGODB_URI_EXISTS: !!process.env.MONGODB_URI,
        MONGODB_URI_LENGTH: process.env.MONGODB_URI?.length || 0,
        MONGODB_URI_PREFIX: process.env.MONGODB_URI?.substring(0, 20) || 'not found',
        GOOGLE_GEMINI_API_KEY_EXISTS: !!process.env.GOOGLE_GEMINI_API_KEY,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
