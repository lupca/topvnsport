import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface MobilePurchaseBarProps {
  productName: string;
  productImage: string;
  totalDisplayPrice: number;
  onBuyNow: () => void;
}

export default function MobilePurchaseBar({
  productName,
  productImage,
  totalDisplayPrice,
  onBuyNow
}: MobilePurchaseBarProps) {
  return (
    <div className="fixed bottom-[57px] left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-sm p-3 flex items-center justify-between gap-3 md:hidden">
      <div className="flex items-center gap-2 min-w-0">
        <img
          src={productImage}
          alt={productName}
          className="w-10 h-10 object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0"
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0">
          <h4 className="font-bold text-xs text-gray-900 truncate">{productName}</h4>
          <p className="text-brand-primary font-bold text-xs font-mono">{totalDisplayPrice.toLocaleString('vi-VN')}đ</p>
        </div>
      </div>
      <button
        onClick={onBuyNow}
        className="btn-primary text-xs px-4 py-2.5 rounded-sm flex items-center gap-1.5 shrink-0 shadow-sm"
      >
        <ShoppingCart className="w-4 h-4" /> Mua ngay
      </button>
    </div>
  );
}
