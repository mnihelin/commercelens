import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import userModel from '../../../../lib/models/User';

export async function POST(request: NextRequest) {
  try {
    const { username, connectionString, databaseName } = await request.json();
    
    console.log('MongoDB Connect API - Gelen veriler:', { username, connectionString, databaseName });

    if (!username || !connectionString || !databaseName) {
      console.log('MongoDB Connect API - Eksik parametreler');
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı, bağlantı string ve veritabanı adı gereklidir' },
        { status: 400 }
      );
    }

    // Kullanıcının var olup olmadığını kontrol et
    const userExists = userModel.userExists(username);
    console.log('MongoDB Connect API - Kullanıcı kontrolü:', { username, userExists });
    
    if (!userExists) {
      console.log('MongoDB Connect API - Kullanıcı bulunamadı:', username);
      console.log('MongoDB Connect API - Mevcut kullanıcılar:', userModel.getAllUsers().map(u => u.username));
      return NextResponse.json(
        { success: false, error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // MongoDB bağlantısını test et
    let client;
    try {
      // Connection string'i düzelt (http:// varsa kaldır)
      let cleanConnectionString = connectionString.trim();
      if (cleanConnectionString.startsWith('http://')) {
        cleanConnectionString = cleanConnectionString.replace('http://', '');
      }
      if (cleanConnectionString.startsWith('https://')) {
        cleanConnectionString = cleanConnectionString.replace('https://', '');
      }
      
      // mongodb:// prefix'i yoksa ekle
      if (!cleanConnectionString.startsWith('mongodb://') && !cleanConnectionString.startsWith('mongodb+srv://')) {
        cleanConnectionString = `mongodb://${cleanConnectionString}`;
      }

      client = new MongoClient(cleanConnectionString, {
        serverSelectionTimeoutMS: 5000, // 5 saniye timeout
        connectTimeoutMS: 5000
      });

      await client.connect();
      
      // Veritabanına erişimi test et
      const db = client.db(databaseName);
      await db.admin().ping();

      // Bağlantı başarılı, kullanıcı ayarlarını güncelle
      userModel.updateMongoConnection(username, {
        isConnected: true,
        connectionString: cleanConnectionString,
        databaseName: databaseName,
        connectionError: null
      });

      return NextResponse.json({
        success: true,
        message: 'MongoDB bağlantısı başarılı!',
        connectionInfo: {
          connectionString: cleanConnectionString,
          databaseName: databaseName,
          connectedAt: new Date()
        }
      });

    } catch (connectionError: any) {
      // Bağlantı hatası, kullanıcı ayarlarını güncelle
      userModel.updateMongoConnection(username, {
        isConnected: false,
        connectionString: connectionString,
        databaseName: databaseName,
        connectionError: connectionError.message
      });

      return NextResponse.json({
        success: false,
        error: 'MongoDB bağlantısı başarısız',
        details: connectionError.message,
        suggestions: [
          'MongoDB servisinizin çalıştığından emin olun',
          'Bağlantı string\'inin doğru olduğunu kontrol edin',
          'Ağ bağlantınızı kontrol edin',
          'Firewall ayarlarınızı kontrol edin'
        ]
      }, { status: 400 });

    } finally {
      if (client) {
        await client.close();
      }
    }

  } catch (error: any) {
    console.error('MongoDB connect API error:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu' },
      { status: 500 }
    );
  }
}

// Kullanıcının mevcut MongoDB ayarlarını getir
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı adı gereklidir' },
        { status: 400 }
      );
    }

    const mongoConfig = userModel.getUserMongoConfig(username);
    
    if (!mongoConfig) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        isConnected: mongoConfig.isConnected,
        databaseName: mongoConfig.databaseName,
        lastConnectionAttempt: mongoConfig.lastConnectionAttempt,
        connectionError: mongoConfig.connectionError
      }
    });

  } catch (error: any) {
    console.error('MongoDB config GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası oluştu' },
      { status: 500 }
    );
  }
} 