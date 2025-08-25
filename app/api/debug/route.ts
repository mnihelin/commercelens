import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const cwd = process.cwd();
    const dataDir = path.join(cwd, 'data');
    const reviewsDir = path.join(dataDir, 'reviews');
    
    const debugInfo = {
      cwd: cwd,
      dataDir: dataDir,
      reviewsDir: reviewsDir,
      dataDirExists: fs.existsSync(dataDir),
      reviewsDirExists: fs.existsSync(reviewsDir),
      files: []
    };
    
    if (fs.existsSync(reviewsDir)) {
      try {
        debugInfo.files = fs.readdirSync(reviewsDir);
      } catch (error) {
        debugInfo.files = [`Error reading dir: ${error.message}`];
      }
    }
    
    // Vercel environment bilgileri
    debugInfo.environment = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      PWD: process.env.PWD
    };
    
    return NextResponse.json({
      success: true,
      debug: debugInfo
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
