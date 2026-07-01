import React from 'react';
import { ShieldCheck, Trophy, ShoppingBag, MapPin } from 'lucide-react';

export default function TrustBadges() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8" id="trust-badges-ribbon">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div className="space-y-1">
          <ShieldCheck className="w-8 h-8 text-orange-500 mx-auto" />
          <h4 className="font-bold text-gray-900 text-xs uppercase">100% Chính Hãng</h4>
          <p className="text-[10px] text-gray-500 font-light">Hoàn tiền 1000% nếu phát hiện giả nhái.</p>
        </div>
        <div className="space-y-1 border-l border-gray-100">
          <Trophy className="w-8 h-8 text-orange-500 mx-auto" />
          <h4 className="font-bold text-gray-900 text-xs uppercase font-display">Lỗi 1 đổi 1</h4>
          <p className="text-[10px] text-gray-500 font-light">Đổi mới miễn phí lên tới 90 ngày.</p>
        </div>
        <div className="space-y-1 border-l border-gray-100">
          <ShoppingBag className="w-8 h-8 text-orange-500 mx-auto" />
          <h4 className="font-bold text-gray-900 text-xs uppercase">COD toàn quốc</h4>
          <p className="text-[10px] text-gray-500 font-light">Kiểm tra cầm nắm thử trước khi thanh toán.</p>
        </div>
        <div className="space-y-1 border-l border-gray-100">
          <MapPin className="w-8 h-8 text-orange-500 mx-auto" />
          <h4 className="font-bold text-gray-900 text-xs uppercase font-display">Cửa hàng Hà Nội</h4>
          <p className="text-[10px] text-gray-500 font-light">Địa chỉ trải nghiệm & đan vợt lấy ngay.</p>
        </div>
      </div>
    </div>
  );
}
