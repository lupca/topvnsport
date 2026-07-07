import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Clock, Calendar, ShieldCheck, CheckCircle2, User, ChevronRight, MessageSquare } from 'lucide-react';
import { Branch, Product } from '../types';
import { popupService } from './ui/popupService';

interface StoreLocatorProps {
  branches: Branch[];
  products: Product[];
  initialBranchId?: string;
  onClose?: () => void;
}

export default function StoreLocator({ branches, products, initialBranchId, onClose }: StoreLocatorProps) {
  const [selectedCity, setSelectedCity] = useState<'Tất cả' | 'Hà Nội' | 'TP. Hồ Chí Minh' | 'Đà Nẵng' | 'Hải Dương'>('Tất cả');
  const [activeBranch, setActiveBranch] = useState<Branch>(
    branches.find(b => b.id === initialBranchId) || branches[0]
  );

  // Synchronize state if branches or initialBranchId changes asynchronously
  useEffect(() => {
    if (branches.length > 0) {
      setActiveBranch(prev => prev || branches.find(b => b.id === initialBranchId) || branches[0]);
    }
  }, [branches, initialBranchId]);

  // Booking Form States
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingRacket, setBookingRacket] = useState('');
  const [isBooked, setIsBooked] = useState(false);

  const filteredBranches = selectedCity === 'Tất cả' 
    ? branches 
    : branches.filter(b => b.city === selectedCity);

  const handleBookDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingPhone || !bookingDate) {
      await popupService.alert('Vui lòng điền đầy đủ họ tên, số điện thoại và ngày trải nghiệm.');
      return;
    }
    setIsBooked(true);
  };

  const resetBookingForm = () => {
    setBookingName('');
    setBookingPhone('');
    setBookingDate('');
    setBookingTime('09:00');
    setBookingRacket('');
    setIsBooked(false);
  };

  if (!activeBranch) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[400px]" id="store-locator-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-300" id="store-locator-page">
      {/* Page Title */}
      <div className="text-center mb-10">
        <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">
          Địa điểm Trải Nghiệm Offline To Online (O2O)
        </span>
        <h1 className="font-display font-black text-2xl md:text-4xl text-gray-900 tracking-tight mt-3">
          CỬA HÀNG TRẢI NGHIỆM <span className="text-brand-primary">TOPVNSPORT</span>
        </h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto mt-2">
          Đến trực tiếp cửa hàng để vung thử, đo đạc thông số tay vợt và sử dụng dịch vụ đan lưới đẳng cấp thế giới. Đặt lịch trải nghiệm miễn phí bên dưới.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: List of stores with filters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-xs">
            <h3 className="font-bold text-gray-900 text-sm mb-1">Khu vực phục vụ:</h3>
            <p className="text-xs text-gray-400 mb-3 font-medium">Bản doanh căng cước và thử vợt</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs px-3 py-1.5 rounded-full border bg-brand-primary text-white border-brand-primary font-bold">
                Hà Nội
              </span>
            </div>
          </div>

          {/* Store Cards */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
            {branches.map(branch => (
              <div
                key={branch.id}
                onClick={() => setActiveBranch(branch)}
                className="p-4 rounded-xl border bg-brand-light/70 border-brand-primary shadow-md ring-1 ring-brand-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-brand-primary" />
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{branch.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{branch.address}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-gray-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-brand-primary" /> {branch.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-brand-primary" /> {branch.schedule}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle/Right: Live Map View & Booking Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Branch Map */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
            <div className="bg-gray-950 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] bg-brand-primary text-white px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">ĐANG CHỌN TRẢI NGHIỆM</span>
                <h3 className="font-display font-bold text-base mt-1">{activeBranch.name}</h3>
              </div>
              <a
                href={`tel:${activeBranch.phone}`}
                className="bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 transition"
              >
                <Phone className="w-3.5 h-3.5" /> Gọi điện: {activeBranch.phone}
              </a>
            </div>

            {/* Embedded maps iframe or beautiful graphics */}
            <div className="aspect-[16/7] w-full bg-gray-100 relative">
              {activeBranch.mapEmbedUrl ? (
                <iframe
                  title={activeBranch.name}
                  src={activeBranch.mapEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-brand-light/30">
                  <MapPin className="w-12 h-12 text-brand-primary mb-2 " />
                  <p className="font-bold text-gray-800 text-sm">Bản đồ số đang đồng bộ định vị...</p>
                  <p className="text-xs text-gray-500 mt-1">Đường dây nóng hỗ trợ khách hàng: 097 6007006</p>
                </div>
              )}
            </div>
          </div>

          {/* O2O Booking Slot Form */}
          <div className="bg-gray-900 text-white rounded-2xl p-6 md:p-8 border border-gray-800 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl" />
            
            {!isBooked ? (
              <form onSubmit={handleBookDemo} className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                  <div>
                    <h3 className="font-display font-extrabold text-lg text-white">ĐĂNG KÝ TRẢI NGHIỆM VỢT VÀ ĐAN CƯỚC TẠI SHOP</h3>
                    <p className="text-xs text-gray-400">Chọn mẫu vợt bạn muốn vung thử miễn phí, đội ngũ chuyên gia của chúng tôi sẽ chuẩn bị sẵn sàng.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Họ và tên khách hàng *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={bookingName}
                      onChange={e => setBookingName(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-brand-primary transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Số điện thoại liên hệ *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ví dụ: 0912345678"
                      value={bookingPhone}
                      onChange={e => setBookingPhone(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-brand-primary transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Ngày trải nghiệm *</label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={e => setBookingDate(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-brand-primary transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Khung giờ vàng</label>
                    <select
                      value={bookingTime}
                      onChange={e => setBookingTime(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-brand-primary transition"
                    >
                      <option value="09:00">09:00 - Sáng sớm</option>
                      <option value="11:00">11:00 - Trưa</option>
                      <option value="15:00">15:00 - Chiều mát</option>
                      <option value="18:30">18:30 - Tối tan ca</option>
                      <option value="20:00">20:00 - Tối muộn</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Chọn sản phẩm muốn thử</label>
                    <select
                      value={bookingRacket}
                      onChange={e => setBookingRacket(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-brand-primary transition"
                    >
                      <option value="">-- Click để lựa chọn --</option>
                      {products.filter(p => p.category === 'Vợt').map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-850/50 p-3 rounded-lg border border-gray-800 flex items-start gap-2 text-xs text-gray-400 leading-normal">
                  <ShieldCheck className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                  <span>
                    TopVNSport cam kết bảo mật thông tin cá nhân của bạn. Chuyên viên sẽ gọi điện xác nhận lịch hẹn của bạn trong vòng 10 phút.
                  </span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs uppercase tracking-wider px-8 py-3 rounded-full flex items-center gap-1.5 transition "
                  >
                    Xác nhận đặt lịch &rarr;
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                <h3 className="font-display font-extrabold text-2xl text-white uppercase">ĐẶT LỊCH TRẢI NGHIỆM THÀNH CÔNG!</h3>
                <div className="max-w-md mx-auto bg-gray-850 p-4 rounded-xl text-left border border-gray-800 text-xs text-gray-300 space-y-2">
                  <p>• <strong>Khách hàng:</strong> {bookingName}</p>
                  <p>• <strong>Số điện thoại:</strong> {bookingPhone}</p>
                  <p>• <strong>Địa điểm:</strong> {activeBranch.name}</p>
                  <p>• <strong>Thời gian hẹn:</strong> {bookingDate} lúc {bookingTime}</p>
                  {bookingRacket && <p>• <strong>Sản phẩm đăng ký vung thử:</strong> {bookingRacket}</p>}
                </div>
                <p className="text-xs text-gray-400">
                  Lịch hẹn của bạn đã được ghi nhận vào hệ thống quản lý chi nhánh. Đội ngũ kỹ thuật viên đan vợt TopVNSport đã nhận thông tin và sẽ liên hệ xác nhận trong giây lát.
                </p>
                <div className="pt-2">
                  <button
                    onClick={resetBookingForm}
                    className="border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-wider px-6 py-2 rounded-full transition"
                  >
                    Đặt lịch khác
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
