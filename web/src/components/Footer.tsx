import React from 'react';
import { Trophy, Phone, MapPin, Mail, ShieldCheck, Heart, Sparkles, Facebook, Youtube, Share2 } from 'lucide-react';

interface FooterProps {
  setView: (view: string, extra?: any) => void;
}

export default function Footer({ setView }: FooterProps) {
  return (
    <footer className="bg-gray-950 text-gray-400 text-xs md:text-sm border-t border-gray-900 mt-20" id="topvnsport-footer">
      
      {/* Top Banner: core trust value pillars */}
      <div className="bg-gray-900 border-b border-gray-950 py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">100% CHÍNH HÃNG</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Phát hiện hàng giả đền bù gấp 10 lần giá trị.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">BẢO HÀNH CHU ĐÁO</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Bảo hành chính hãng 1 đổi 1 trong 90 ngày.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">HỖ TRỢ KỸ THUẬT</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Tư vấn thông số và cách căng lưới đúng kỹ thuật.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">CỬA HÀNG TRẢI NGHIỆM</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Trụ sở chính tại Hà Nội hỗ trợ chu đáo nhất.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand about block */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-md border border-gray-800 flex items-center justify-center overflow-hidden">
              <img 
                src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                alt="TopVNSport Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display font-black text-xl text-white tracking-tight">TOPVN<span className="text-brand-primary">SPORT</span></span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Hệ thống siêu thị thể thao cầu lông số 1 Việt Nam. Chuyên cung cấp các sản phẩm vợt, giày, cước đan Yonex, Lining, Victor tiêu chuẩn thi đấu quốc tế.
          </p>
          <div className="flex items-center gap-3 text-gray-500">
            <Facebook className="w-4 h-4 hover:text-white transition cursor-pointer" />
            <Youtube className="w-4 h-4 hover:text-white transition cursor-pointer" />
            <Share2 className="w-4 h-4 hover:text-white transition cursor-pointer" />
          </div>
        </div>

        {/* Directory links */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">Sản phẩm cốt lõi</h4>
          <ul className="space-y-1.5 text-xs text-gray-500">
            <li><button onClick={() => setView('catalog', { category: 'Vợt' })} className="hover:text-white transition">Vợt Cầu Lông Yonex Nhật Bản</button></li>
            <li><button onClick={() => setView('catalog', { category: 'Vợt' })} className="hover:text-white transition">Vợt Cầu Lông Lining Chuyên Công</button></li>
            <li><button onClick={() => setView('catalog', { category: 'Giày' })} className="hover:text-white transition">Giày Cầu Lông Chống Lật Cổ Chân</button></li>
            <li><button onClick={() => setView('catalog', { category: 'Cước' })} className="hover:text-white transition">Dây Cước Đan Exbolt Đanh Tiếng</button></li>
          </ul>
        </div>

        {/* Support links */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">Dịch vụ & Hậu mãi</h4>
          <ul className="space-y-1.5 text-xs">
            <li><button onClick={() => setView('store-locator')} className="hover:text-white transition">Cửa hàng trải nghiệm trực tiếp</button></li>
            <li><button className="hover:text-white transition">Chính sách bảo hành 90 ngày</button></li>
            <li><button className="hover:text-white transition">Đặt lịch đan cước lấy ngay</button></li>
            <li><button onClick={() => setView('blog-list')} className="hover:text-white transition">Đánh giá chất lượng sân đấu</button></li>
            <li><button className="hover:text-white transition">Hướng dẫn chọn vợt theo lực cổ tay</button></li>
          </ul>
        </div>

        {/* Contact address */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider">Trụ sở & Liên hệ</h4>
          <ul className="space-y-2 text-gray-500">
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
              <span>Số 1, ngõ 141/3, phố Lê Văn Hiến, Phường Đức Thắng, Quận Bắc Từ Liêm, Hà Nội</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-primary shrink-0" />
              <span>097 6007006 (08:00 - 22:00)</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-primary shrink-0" />
              <span>support@topvnsport.com.vn</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Copyright */}
      <div className="bg-gray-985 border-t border-gray-900/60 py-5 text-center text-xs text-gray-600 px-4">
        <p>© 2026 TopVNSport. Hệ thống phân phối thiết bị cầu lông quốc tế hàng đầu Việt Nam.</p>
        <p className="mt-1 text-[10px] text-gray-700">Giấy phép ĐKKD số 0102030405 cấp bởi Sở Kế Hoạch và Đầu Tư Hà Nội.</p>
      </div>

    </footer>
  );
}
