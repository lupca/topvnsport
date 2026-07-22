import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { Eye, ShoppingCart, Star, Zap, Activity } from 'lucide-react';
import { getProductPath } from '../utils/productSlug';

interface ProductCardProps {
  key?: string;
  product: Product;
  
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

export default function ProductCard({ product, onQuickView, onAddToCart }: ProductCardProps) {
  const navigate = useNavigate();
  const hasActivePromotion = Boolean(
    product.hasActivePromotion ||
    (product.computedPrice !== undefined && product.originalPrice !== undefined && product.computedPrice < product.originalPrice) ||
    (product.salePrice !== undefined && product.salePrice < product.price)
  );

  const originalPrice = product.originalPrice ?? product.price;
  const salePrice = product.computedPrice ?? product.salePrice ?? product.price;
  const discountPercent = product.percentageDiscount ?? (hasActivePromotion && originalPrice > 0 ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0);

  // Visual helper for racket playstyles
  const characteristicStyles = {
    'Tấn Công': { bg: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-500' },
    'Phòng Thủ': { bg: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500' },
    'Toàn Diện': { bg: 'bg-green-50 text-green-600 border-green-100', dot: 'bg-green-500' },
    'Người Mới': { bg: 'bg-brand-light text-brand-primary border-blue-100', dot: 'bg-brand-primary' }
  };

  const badgeStyles = {
    'NEW': 'bg-emerald-500 text-white',
    'HOT': 'bg-brand-primary text-white',
    'SALE': 'bg-red-500 text-white ',
    'LIMITED': 'bg-purple-600 text-white',
    'PRO': 'bg-gray-900 text-yellow-400 border border-yellow-400',
    'TOUR': 'bg-blue-700 text-white',
    'GAME': 'bg-teal-600 text-white',
    'PLAY': 'bg-gray-500 text-white'
  };

  return (
    <div 
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300 flex flex-col justify-between h-full relative"
      id={`product-card-${product.id}`}
    >
      {/* Product Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {product.stock <= 0 && (
          <span className="text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-sm shadow-xs bg-gray-600 text-white">
            Hết hàng
          </span>
        )}
        {product.badge && product.stock > 0 && (
          <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-sm shadow-xs ${badgeStyles[product.badge] || 'bg-gray-500 text-white'}`}>
            {product.badge}
          </span>
        )}
        {hasActivePromotion && discountPercent > 0 && product.stock > 0 && (
          <span
            className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-sm shadow-xs"
            data-testid="discount-badge"
          >
            -{discountPercent}%
          </span>
        )}
      </div>

      {/* Main product photo area */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 flex items-center justify-center p-4">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        {/* Quick actions overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2.5 z-10">
          <button
            onClick={() => onQuickView(product)}
            className="p-2 bg-white text-gray-800 rounded-full hover:bg-brand-primary hover:text-white shadow-md hover:scale-110 transition duration-200"
            title="Xem nhanh thông số"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => product.stock > 0 && onAddToCart(product, e)}
            disabled={product.stock <= 0}
            className={`p-2 rounded-full shadow-md transition duration-200 ${
              product.stock <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white text-gray-800 hover:bg-brand-primary hover:text-white hover:scale-110'
            }`}
            title={product.stock <= 0 ? 'Sản phẩm hết hàng' : 'Thêm nhanh vào giỏ'}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content details block */}
      <div className="p-4 flex-1 flex flex-col justify-between" onClick={() => navigate(getProductPath(product))}>
        <div className="space-y-1.5 cursor-pointer">
          {/* Brand & category */}
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-gray-400">
            <span className="text-brand-primary uppercase tracking-wider">{product.brand}</span>
            <span>{product.category}</span>
          </div>

          {/* Product Name */}
          <h3 className="font-sans font-semibold text-sm text-gray-800 group-hover:text-brand-primary line-clamp-2 transition leading-snug">
            {product.name}
          </h3>

          {/* Core Technical Indicator Tags (for Rackets / Paddles) */}
          {product.category === 'Vợt' && product.specs && (
            <div className="py-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-b border-gray-50 my-2 text-[10px] text-gray-500 font-mono">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Trọng lượng:</span>
                <span className="font-semibold text-gray-700">{product.specs?.weight?.split(' ')[0] ?? 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Điểm CB:</span>
                <span className="font-semibold text-gray-700">{product.specs?.balance ?? 0}mm</span>
              </div>
              <div className="flex items-center gap-1 col-span-2">
                <span className="text-gray-400">Độ cứng:</span>
                <span className="font-semibold text-gray-700 truncate max-w-[120px]">{product.specs?.stiffness?.split(' ')[0] ?? 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Wide format shoe indicator */}
          {product.category === 'Giày' && product.isWide && (
            <div className="my-1.5 inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded border border-amber-100 font-medium">
              <Activity className="w-3 h-3" /> Form chân bè (Wide Fit)
            </div>
          )}

          {/* Characteristics Badge */}
          {product.characteristics && (
            <div className="my-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${characteristicStyles[product.characteristics]?.bg || 'bg-gray-100 text-gray-700'}`}>
                <span className={`w-1 h-1 rounded-full ${characteristicStyles[product.characteristics]?.dot || 'bg-gray-500'}`}></span>
                {product.characteristics}
              </span>
            </div>
          )}
        </div>

        {/* Pricing Block */}
        <div className="mt-4 flex items-end justify-between pt-2 border-t border-gray-50">
          <div>
            {hasActivePromotion ? (
              <>
                <span className="text-base font-bold text-red-600 font-display block leading-tight" data-testid="sale-price">
                  {(salePrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
                <span className="text-xs text-gray-400 line-through block leading-none" data-testid="original-price">
                  {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
              </>
            ) : (
              <span className="text-base font-extrabold text-brand-primary font-display" data-testid="regular-price">
                {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(getProductPath(product));
            }}
            className="text-xs font-bold text-gray-900 group-hover:text-brand-primary hover:underline transition"
          >
            Chi tiết &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
