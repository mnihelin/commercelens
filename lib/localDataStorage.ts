// Local Data Storage System - MongoDB'nin yerini alan sistem

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const REVIEWS_DIR = path.join(DATA_DIR, 'reviews');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis');

// Dizinleri oluştur - Vercel için güvenli mod
function ensureDirectories() {
  // Vercel production'da dosya sistemi read-only olduğu için
  // sadece development modunda dizin oluştur
  if (process.env.NODE_ENV === 'development') {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(REVIEWS_DIR)) fs.mkdirSync(REVIEWS_DIR, { recursive: true });
      if (!fs.existsSync(ANALYSIS_DIR)) fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
    } catch (error) {
      console.warn('Dizin oluşturma hatası (normal Vercel davranışı):', error);
    }
  }
}

export interface ReviewData {
  id: string;
  collection_name?: string;
  platform: string;
  product_name: string;
  comment?: string;
  rating?: number;
  timestamp: string;
  product_url: string;
  product_price?: number;
  total_reviews?: number;
  price?: number;
  search_term?: string;
  page_number?: number;
  review_index?: number;
  likes?: number;
  user_name?: string;
  verified_purchase?: boolean;
  created_at?: string;
  last_updated?: string;
}

export interface AnalysisData {
  id: string;
  collection_name: string;
  platform_info: {
    platforms: string[];
    products: string[];
  };
  review_count: number;
  analyzed_comments: number;
  result: string;
  timestamp: string;
  analysis_type: string;
  analysis_version?: string;
}

export interface ScrapingResult {
  success: boolean;
  total_reviews: number;
  products_processed: number;
  platform: string;
  search_term?: string;
  results: Array<{
    success: boolean;
    total_reviews: number;
    collection_name: string;
    product_name: string;
    platform: string;
    price?: number;
    product_url?: string;
  }>;
}

// Güvenli koleksiyon adı oluştur
function createSafeCollectionName(searchTerm: string, platform: string): string {
  const safeTerm = searchTerm
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);
  return `${platform}_reviews_${safeTerm}`;
}

// Yorumları kaydet
export async function saveReviews(collectionName: string, reviews: ReviewData[]): Promise<void> {
  ensureDirectories();
  
  const filePath = path.join(REVIEWS_DIR, `${collectionName}.json`);
  
  // Mevcut dosya varsa oku
  let existingReviews: ReviewData[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      existingReviews = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading existing reviews from ${filePath}:`, error);
    }
  }
  
  // Yeni yorumları ekle (ID'ye göre çakışma kontrolü)
  const existingIds = new Set(existingReviews.map(r => r.id));
  const newReviews = reviews.filter(r => !existingIds.has(r.id));
  
  const allReviews = [...existingReviews, ...newReviews];
  
  // Dosyaya kaydet
  fs.writeFileSync(filePath, JSON.stringify(allReviews, null, 2), 'utf-8');
  
  console.log(`Saved ${newReviews.length} new reviews to ${collectionName}, total: ${allReviews.length}`);
}

// Yorumları oku
export async function getReviews(collectionName?: string, platform?: string, limit: number = 50): Promise<ReviewData[]> {
  ensureDirectories();
  
  if (collectionName) {
    // Belirli koleksiyondan oku
    const filePath = path.join(REVIEWS_DIR, `${collectionName}.json`);
    if (!fs.existsSync(filePath)) return [];
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const reviews = JSON.parse(fileContent) as ReviewData[];
      return reviews.slice(0, limit);
    } catch (error) {
      console.error(`Error reading reviews from ${filePath}:`, error);
      return [];
    }
  }
  
  // Tüm koleksiyonlardan oku
  const files = fs.readdirSync(REVIEWS_DIR).filter(f => f.endsWith('.json'));
  let allReviews: ReviewData[] = [];
  
  for (const file of files) {
    if (platform && !file.startsWith(platform)) continue;
    
    try {
      const filePath = path.join(REVIEWS_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const reviews = JSON.parse(fileContent) as ReviewData[];
      allReviews.push(...reviews);
    } catch (error) {
      console.error(`Error reading reviews from ${file}:`, error);
    }
  }
  
  // Timestamp'e göre sırala ve limit uygula
  allReviews.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return allReviews.slice(0, limit);
}

// Koleksiyon listesi
export async function getCollections(): Promise<Array<{
  name: string;
  platform: string;
  document_count: number;
  last_updated: string;
  product_name: string;
}>> {
  ensureDirectories();
  
  // Vercel production'da dosya sistemi read-only olduğu için
  // empty array döndür
  if (process.env.NODE_ENV === 'production' && !fs.existsSync(REVIEWS_DIR)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(REVIEWS_DIR).filter(f => f.endsWith('.json'));
    const collections = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(REVIEWS_DIR, file);
        const stats = fs.statSync(filePath);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const reviews = JSON.parse(fileContent) as ReviewData[];
        
        const collectionName = file.replace('.json', '');
        const platform = reviews[0]?.platform || 'unknown';
        const productName = reviews[0]?.product_name || collectionName.replace(/_/g, ' ');
        
        collections.push({
          name: collectionName,
          platform: platform,
          document_count: reviews.length,
          last_updated: stats.mtime.toISOString(),
          product_name: productName
        });
      } catch (error) {
        console.error(`Error processing collection ${file}:`, error);
      }
    }
    
    return collections.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
  } catch (error) {
    console.error('Error reading collections directory:', error);
    return [];
  }
}

// Analiz kaydet
export async function saveAnalysis(analysis: AnalysisData): Promise<void> {
  ensureDirectories();
  
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production') {
    console.log('Production modunda analiz kaydı atlandı:', analysis.id);
    return;
  }
  
  try {
    const filePath = path.join(ANALYSIS_DIR, `${analysis.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2), 'utf-8');
    console.log(`Analysis saved: ${analysis.id}`);
  } catch (error) {
    console.error('Analysis kaydetme hatası:', error);
  }
}

// Analiz geçmişi
export async function getAnalysisHistory(limit: number = 50): Promise<AnalysisData[]> {
  ensureDirectories();
  
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production' && !fs.existsSync(ANALYSIS_DIR)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
    const analyses = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(ANALYSIS_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const analysis = JSON.parse(fileContent) as AnalysisData;
        analyses.push(analysis);
      } catch (error) {
        console.error(`Error reading analysis from ${file}:`, error);
      }
    }
    
    // Timestamp'e göre sırala
    analyses.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return analyses.slice(0, limit);
  } catch (error) {
    console.error('Error reading analysis directory:', error);
    return [];
  }
}

// Koleksiyonu sil
export async function deleteCollection(collectionName: string): Promise<boolean> {
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production') {
    console.log('Production modunda collection silme atlandı:', collectionName);
    return false;
  }
  
  try {
    const filePath = path.join(REVIEWS_DIR, `${collectionName}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Collection deleted: ${collectionName}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting collection ${collectionName}:`, error);
    return false;
  }
}

// Analizi sil
export async function deleteAnalysis(analysisId: string): Promise<boolean> {
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production') {
    console.log('Production modunda analysis silme atlandı:', analysisId);
    return false;
  }
  
  try {
    const filePath = path.join(ANALYSIS_DIR, `${analysisId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Analysis deleted: ${analysisId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting analysis ${analysisId}:`, error);
    return false;
  }
}

// Tüm verileri temizle
export async function clearAllData(): Promise<void> {
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production') {
    console.log('Production modunda data silme atlandı');
    return;
  }
  
  try {
    if (fs.existsSync(REVIEWS_DIR)) {
      const files = fs.readdirSync(REVIEWS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(REVIEWS_DIR, file));
      }
    }
    
    if (fs.existsSync(ANALYSIS_DIR)) {
      const files = fs.readdirSync(ANALYSIS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(ANALYSIS_DIR, file));
      }
    }
    
    console.log('All data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
}

// İstatistikler
export async function getStorageStats() {
  ensureDirectories();
  
  // Vercel production'da dosya sistemi read-only
  if (process.env.NODE_ENV === 'production' && (!fs.existsSync(REVIEWS_DIR) || !fs.existsSync(ANALYSIS_DIR))) {
    return {
      total_reviews: 0,
      total_collections: 0,
      total_analyses: 0,
      platform_stats: {},
      storage_size: '0 KB'
    };
  }
  
  try {
    const reviewFiles = fs.readdirSync(REVIEWS_DIR).filter(f => f.endsWith('.json'));
    const analysisFiles = fs.readdirSync(ANALYSIS_DIR).filter(f => f.endsWith('.json'));
  
  let totalReviews = 0;
  const platformStats: Record<string, number> = {};
  
    for (const file of reviewFiles) {
      try {
        const filePath = path.join(REVIEWS_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const reviews = JSON.parse(fileContent) as ReviewData[];
        
        totalReviews += reviews.length;
        
        for (const review of reviews) {
          platformStats[review.platform] = (platformStats[review.platform] || 0) + 1;
        }
      } catch (error) {
        console.error(`Error reading stats from ${file}:`, error);
      }
    }
    
    return {
      total_collections: reviewFiles.length,
      total_reviews: totalReviews,
      total_analyses: analysisFiles.length,
      platform_stats: platformStats,
      storage_size: '0 KB'
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      total_reviews: 0,
      total_collections: 0,
      total_analyses: 0,
      platform_stats: {},
      storage_size: '0 KB'
    };
  }
} 