import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { saveReviews, ReviewData } from '../../../lib/localDataStorage';

// Python çıktısını parse edip local storage'a kaydet
async function parseAndSaveResults(jsonOutput: any): Promise<void> {
  try {
    if (!jsonOutput.success || !jsonOutput.results) {
      console.log('No results to save');
      return;
    }

    // Her ürün için ayrı koleksiyon oluştur ve kaydet
    for (const result of jsonOutput.results) {
      if (!result.success || !result.collection_name || !result.total_reviews || result.total_reviews === 0) {
        continue;
      }

      // Koleksiyon adını temizle ve kısalt
      const collectionName = result.collection_name.substring(0, 50).replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Örnek review datası oluştur (gerçek veriler Python scriptlerinden MongoDB'ye kaydediliyor)
      const reviewData: ReviewData = {
        id: `${collectionName}_${Date.now()}`,
        collection_name: collectionName,
        platform: result.platform || jsonOutput.platform,
        product_name: result.product_name || 'Bilinmeyen Ürün',
        total_reviews: result.total_reviews,
        price: result.price || 0,
        product_url: result.product_url || '',
        search_term: jsonOutput.search_term || '',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      // Local storage'a kaydet
      await saveReviews(collectionName, [reviewData]);
      console.log(`✅ ${collectionName} koleksiyonu kaydedildi: ${result.total_reviews} yorum`);
    }
  } catch (error) {
    console.error('Error parsing and saving results:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, platform, maxPages, searchTerm, searchType } = await request.json();

    // Eğer search türü ise
    if (searchType === 'product_search') {
      if (!searchTerm || !platform) {
        return NextResponse.json(
          { success: false, error: 'Arama terimi ve platform gerekli' },
          { status: 400 }
        );
      }

      let scriptPath: string;
      let args: string[];

      if (platform.toLowerCase() === 'trendyol') {
        // Trendyol ürün adı ile arama
        scriptPath = path.join(process.cwd(), 'scripts', 'trendyol_search_scraper.py');
        args = [searchTerm, '5']; // 5 ürün
      } else if (platform.toLowerCase() === 'hepsiburada') {
        // Hepsiburada ürün adı ile arama
        scriptPath = path.join(process.cwd(), 'scripts', 'hepsiburada_search_scraper.py');
        args = [searchTerm, '5', '6']; // 5 ürün, her birinden 6 sayfa
      } else if (platform.toLowerCase() === 'n11') {
        // N11 ürün adı ile arama
        scriptPath = path.join(process.cwd(), 'scripts', 'n11_search_scraper.py');
        args = [searchTerm, '5', '8']; // 5 ürün, her birinden 8 sayfa
      } else if (platform.toLowerCase() === 'aliexpress') {
        // AliExpress ürün adı ile arama
        scriptPath = path.join(process.cwd(), 'scripts', 'aliexpress_search_scraper.py');
        args = [searchTerm, '5', '10']; // 5 ürün, her birinden 10 scroll
      } else if (platform.toLowerCase() === 'amazon') {
        // Amazon ürün adı ile arama
        scriptPath = path.join(process.cwd(), 'scripts', 'amazon_search_scraper.py');
        args = [searchTerm, '5', '3']; // 5 ürün, her birinden 3 sayfa yorum
      } else {
        return NextResponse.json(
          { success: false, error: 'Ürün arama için Trendyol, Hepsiburada, N11, AliExpress ve Amazon destekleniyor' },
          { status: 400 }
        );
      }

      const result = await runPythonScript(scriptPath, args);
      
      // Sonuçları local storage'a kaydet
      if (result.success) {
        await parseAndSaveResults(result);
      }
      
      return NextResponse.json(result);
    }

    // Normal URL scraping
    if (!url || !platform) {
      return NextResponse.json(
        { success: false, error: 'URL ve platform parametreleri gerekli' },
        { status: 400 }
      );
    }

    // Platform'a göre uygun script'i seç
    let scriptPath: string;
    let args: string[];

    if (platform.toLowerCase() === 'hepsiburada') {
      if (searchType === 'product_search' && searchTerm) {
        // Hepsiburada arama modu
        scriptPath = path.join(process.cwd(), 'scripts', 'hepsiburada_search_scraper.py');
        args = [searchTerm, '5', '10']; // search_term, max_products, max_pages_per_product
      } else {
        // Tek URL modu
      scriptPath = path.join(process.cwd(), 'scripts', 'hepsiburada_scraper.py');
      args = [url, (maxPages || 10).toString()];
      }
    } else if (platform.toLowerCase() === 'trendyol') {
      scriptPath = path.join(process.cwd(), 'scripts', 'trendyol_scraper.py');
      args = [url, (maxPages || 30).toString()];
    } else if (platform.toLowerCase() === 'n11') {
      scriptPath = path.join(process.cwd(), 'scripts', 'n11_scraper.py');
      args = [url, (maxPages || 8).toString()];
    } else if (platform.toLowerCase() === 'aliexpress') {
      scriptPath = path.join(process.cwd(), 'scripts', 'aliexpress_scraper.py');
      args = [url, (maxPages || 10).toString()];
    } else if (platform.toLowerCase() === 'amazon') {
      // Amazon için URL varsa tek ürün, yoksa arama
      if (url && url.includes('amazon.com.tr/dp/')) {
        scriptPath = path.join(process.cwd(), 'scripts', 'amazon_scraper.py');
        args = [url, (maxPages || 10).toString(), 'true']; // URL, max_pages, enable_login
      } else {
        // Arama modu
        scriptPath = path.join(process.cwd(), 'scripts', 'amazon_search_scraper.py');
        args = [searchTerm || url, '5', '3']; // search_term, max_products, max_pages_per_product
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Desteklenmeyen platform. Hepsiburada, Trendyol, N11, AliExpress ve Amazon desteklenmektedir.' },
        { status: 400 }
      );
    }

    // Python script'ini çalıştır
    const result = await runPythonScript(scriptPath, args);
    
    // Sonuçları local storage'a kaydet
    if (result.success) {
      await parseAndSaveResults(result);
    }
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu' },
      { status: 500 }
    );
  }
}

async function runPythonScript(scriptPath: string, args: string[]): Promise<any> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    console.log(`Starting Python script: ${scriptPath} with args:`, args);

    const pythonProcess = spawn('python3', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Timeout mekanizması (5 dakika)
    const timeout = setTimeout(() => {
      console.log('Python script timeout, killing process...');
      pythonProcess.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Scraping işlemi zaman aşımına uğradı (5 dakika)',
        timeout: true
      });
    }, 300000); // 5 dakika

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log('Python stdout chunk:', chunk);
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log('Python stderr chunk:', chunk);
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`Python script exited with code: ${code}`);
      console.log('Raw stdout length:', stdout.length);
      console.log('Stdout last 500 chars:', stdout.slice(-500));

      // JSON parsing with improved algorithm
      let result: any;
      try {
        // Önce doğrudan parse etmeyi dene
        result = JSON.parse(stdout.trim());
        console.log('Direct JSON parse successful');
        resolve(result);
        return;
      } catch (directError) {
        console.log('Direct JSON parse failed, trying extraction methods...');
      }

      // Gelişmiş brace counting algoritması
      const trimmedOutput = stdout.trim();
      let braceCount = 0;
      let startIndex = -1;
      let endIndex = -1;

      for (let i = 0; i < trimmedOutput.length; i++) {
        const char = trimmedOutput[i];
        
        if (char === '{') {
          if (braceCount === 0) {
            startIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            endIndex = i;
            break;
          }
        }
      }

      if (startIndex !== -1 && endIndex !== -1) {
        try {
          const extractedJson = trimmedOutput.substring(startIndex, endIndex + 1);
          console.log('Extracted JSON length:', extractedJson.length);
          console.log('JSON first 200 chars:', extractedJson.substring(0, 200));
          
          result = JSON.parse(extractedJson);
          console.log('Brace counting successful');
          resolve(result);
          return;
        } catch (braceError) {
          console.log('Main JSON parse failed:', (braceError as Error).message);
        }
      }

      // Regex fallback
      try {
        const jsonMatches = trimmedOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          for (const match of jsonMatches.reverse()) {
            try {
              result = JSON.parse(match);
              console.log('Regex fallback successful');
              resolve(result);
              return;
            } catch (regexError) {
              continue;
            }
          }
        }
      } catch (regexError) {
        console.log('Regex fallback failed:', regexError);
        }

      // Son çare: hata döndür
      console.log('JSON Parse Error: No valid JSON found');
      console.log('Stdout sample:', stdout.substring(0, 1000));
      
      resolve({
        success: false,
        error: 'Geçerli JSON yanıtı bulunamadı',
        raw_output: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500)
      });
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Python script error:', error);
      resolve({
        success: false,
        error: `Python script hatası: ${error.message}`
      });
    });
  });
} 