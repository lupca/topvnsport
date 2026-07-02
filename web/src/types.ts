export interface ProductSpecs {
  weight: string;       // e.g., "4U (80-84g)", "3U (85-89g)", "5U (75-79g)"
  stiffness: string;    // e.g., "Cứng (Stiff)", "Trung bình (Medium)", "Dẻo (Flexible)"
  balance: number;      // Balance point in mm, e.g., 295
  maxTension: number;   // Max tension in lbs or kg, e.g., 28 lbs (12.5 kg)
  swingWeight?: number;  // Swing weight in kg/cm2, e.g., 85.5
}

export interface ProductTechnology {
  name: string;
  description: string;
}

export interface ProductReview {
  author: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
  avatar?: string;
  tags?: string[];
}

export interface Product {
  id: string;
  name: string;
  brand: 'Yonex' | 'Lining' | 'Victor' | 'Kumpoo' | 'Other';
  image: string;
  gallery?: string[];
  category: 'Vợt' | 'Giày' | 'Túi xách' | 'Cước' | 'Quả cầu' | 'Phụ kiện';
  price: number;
  salePrice?: number;
  specs: ProductSpecs;
  series?: string; // e.g., "ASTROX", "Axforce", "Exbolt"
  characteristics?: 'Tấn Công' | 'Phòng Thủ' | 'Toàn Diện' | 'Người Mới'; // For rackets/paddles
  description: string;
  features?: string[];
  technologies?: ProductTechnology[];
  reviews: ProductReview[];
  stock: number;
  defaultSku?: string;
  skuByColor?: Record<string, string>;
  skuByVariant?: Record<string, string>;
  badge?: 'NEW' | 'HOT' | 'SALE' | 'LIMITED' | 'PRO' | 'TOUR' | 'GAME' | 'PLAY';
  isWide?: boolean; // Specially for Shoes wide form
  colors?: string[];
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  country: string;
  category: 'Đơn Nam' | 'Đơn Nữ' | 'Đôi Nam' | 'Đôi Nữ' | 'Huyền Thoại';
  racketId: string;
  shoesId: string;
  stringId: string;
  description: string;
  setupProducts: {
    racketName: string;
    shoesName: string;
    stringName: string;
  };
}

export interface Blog {
  id: string;
  title: string;
  category: 'Đánh giá thiết bị' | 'Hướng dẫn kỹ thuật' | 'Đánh giá sân bãi' | 'Tin tức';
  summary: string;
  content: string;
  date: string;
  image: string;
  author: string;
  tags: string[];
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  schedule: string;
  city: 'Hà Nội' | 'TP. Hồ Chí Minh' | 'Đà Nẵng' | 'Hải Dương' | 'Cần Thơ';
  mapEmbedUrl?: string;
}

export interface StringOption {
  id: string;
  name: string;
  brand: 'Yonex' | 'Lining' | 'Victor';
  type: 'Trợ lực / Âm thanh' | 'Độ bền' | 'Kiểm soát';
  thickness: string; // e.g., "0.63mm", "0.68mm", "0.70mm"
  price: number;
  colors: string[];
}
