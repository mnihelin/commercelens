import bcrypt from 'bcryptjs';

interface User {
  username: string;
  password: string;
  email: string;
  createdAt: Date;
  lastLogin: Date | null;
  mongodbConfig: {
    isConnected: boolean;
    connectionString: string | null;
    databaseName: string;
    lastConnectionAttempt: Date | null;
    connectionError: string | null;
  };
}

export class UserModel {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map(); // Geçici olarak memory'de saklayacağız
  }

  // Kullanıcı oluştur
  async createUser(username: string, password: string, email: string) {
    if (this.users.has(username)) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Şifreyi hash'le
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = {
      username,
      password: hashedPassword,
      email,
      createdAt: new Date(),
      lastLogin: null,
      mongodbConfig: {
        isConnected: false,
        connectionString: null,
        databaseName: 'ecommerce_analytics',
        lastConnectionAttempt: null,
        connectionError: null
      }
    };

    this.users.set(username, user);
    return { username, email, createdAt: user.createdAt };
  }

  // Kullanıcı doğrula
  async validateUser(username: string, password: string) {
    const user = this.users.get(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      // Son giriş zamanını güncelle
      user.lastLogin = new Date();
      return { 
        username: user.username, 
        email: user.email, 
        lastLogin: user.lastLogin,
        mongodbConfig: user.mongodbConfig
      };
    }

    return null;
  }

  // MongoDB bağlantı durumunu güncelle
  updateMongoConnection(username: string, connectionData: Partial<User['mongodbConfig']>) {
    const user = this.users.get(username);
    if (user) {
      user.mongodbConfig = {
        ...user.mongodbConfig,
        ...connectionData,
        lastConnectionAttempt: new Date()
      };
      return true;
    }
    return false;
  }

  // Kullanıcının MongoDB ayarlarını getir
  getUserMongoConfig(username: string) {
    const user = this.users.get(username);
    return user ? user.mongodbConfig : null;
  }

  // Kullanıcı var mı kontrol et
  userExists(username: string) {
    return this.users.has(username);
  }

  // Tüm kullanıcıları listele (admin için)
  getAllUsers() {
    const users = [];
    for (const [username, user] of Array.from(this.users.entries())) {
      users.push({
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        mongodbConnected: user.mongodbConfig.isConnected
      });
    }
    return users;
  }
}

// Singleton instance
const userModel = new UserModel();

// Varsayılan admin kullanıcısı ekle (MongoDB'ye zaten bağlı)
userModel.createUser('theclico', 'theclico2021', 'admin@theclico.com').then(() => {
  // Admin kullanıcısı için MongoDB bağlantısını aktif olarak ayarla
  userModel.updateMongoConnection('theclico', {
    isConnected: true,
    connectionString: 'mongodb://localhost:27017',
    databaseName: 'ecommerce_analytics'
  });
}).catch(() => {
  // Hata varsa görmezden gel (zaten var demektir)
});

export default userModel; 