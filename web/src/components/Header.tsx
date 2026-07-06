import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, MapPin, Phone, ShieldCheck, Heart, User, Sparkles, Trophy, BookOpen, ChevronDown, Check, Trash, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';

interface HeaderProps {
  currentView: string;
  setView: (view: string, extra?: any) => void;
  cartCount: number;
  openCart: () => void;
  products: Product[];
}

export default function Header({ currentView, setView, cartCount, openCart, products }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // AJAX search emulation
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.series && p.series.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(filtered.slice(0, 5));
      setShowSearchDropdown(true);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [searchQuery, products]);

  const handleSearchSelect = (productId: string) => {
    setView('product-detail', { productId });
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const trendKeywords = ['Yonex Astrox', 'Giày Lining', 'Balo cầu lông', 'Cước đan vợt'];

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50 shadow-xs" id="topvnsport-header">
      {/* Top Bar */}
      <div className="hidden md:flex bg-gray-900 text-gray-300 text-xs py-2 px-8 flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-orange-500" />
            Hotline: <strong className="text-white">097 6007006</strong> (08:00 - 22:00)
          </span>
          <span className="hidden md:inline text-gray-500">|</span>
          <span className="hidden md:flex items-center gap-1 text-orange-400">
            <ShieldCheck className="w-3 h-3" /> Cam kết 100% chính hãng - Đền gấp 10 nếu giả
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('store-locator')} 
            className={`hover:text-orange-400 transition flex items-center gap-1 ${currentView === 'store-locator' ? 'text-orange-400 font-medium' : ''}`}
          >
            <MapPin className="w-3 h-3" /> Cửa hàng trải nghiệm TopVNSport
          </button>
          <span>|</span>
          <button className="hover:text-orange-400 transition">Tra cứu bảo hành</button>
          <span>|</span>
          <button className="hover:text-orange-400 transition">Kiểm tra đơn hàng</button>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 md:py-4 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
        {/* Brand Logo & Mobile Trigger & Mobile Quick Cart */}
        <div className="w-full md:w-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1.5 text-gray-700 hover:text-orange-500 hover:bg-gray-100 rounded-lg transition md:hidden"
              aria-label="Open mobile menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div 
              onClick={() => setView('home')} 
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg border border-gray-100 shadow-xs flex items-center justify-center overflow-hidden group-hover:border-orange-300 transition shrink-0">
                <img 
                  src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                  alt="TopVNSport Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="font-display font-extrabold text-lg md:text-2xl tracking-tight text-gray-900 block leading-none">
                  TOPVN<span className="text-orange-500">SPORT</span>
                </span>
                <p className="text-[8px] md:text-[9px] text-gray-400 tracking-widest uppercase font-semibold mt-0.5">Badminton Speciality Store</p>
              </div>
            </div>
          </div>

          {/* Quick Cart on top right for mobile */}
          <button 
            onClick={openCart}
            className="md:hidden text-gray-700 hover:text-orange-500 transition relative flex items-center gap-1.5 p-2 bg-gray-50 hover:bg-orange-50 rounded-full"
          >
            <ShoppingBag className="w-5 h-5 text-gray-800" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar Widget with suggestions */}
        <div className="w-full md:max-w-xl relative" ref={dropdownRef}>
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm vợt Yonex, Lining, cước đan, giày cầu lông..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchDropdown(true)}
              className="w-full pl-10 pr-4 py-1.5 md:py-2 bg-gray-50 border border-gray-200 rounded-full text-xs md:text-sm text-gray-800 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
            />
            <Search className="absolute left-3.5 top-2 md:top-2.5 w-4 h-4 md:w-4.5 md:h-4.5 text-gray-400" />
          </div>

          {/* Quick Trends under Search Bar */}
          <div className="hidden md:flex mt-1.5 flex-wrap items-center gap-1.5 text-[11px] text-gray-500 px-2">
            <span className="font-medium text-gray-400">Xu hướng:</span>
            {trendKeywords.map((kw, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(kw);
                  setView('catalog', { search: kw });
                }}
                className="hover:text-orange-500 hover:underline transition"
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Dynamic Dropdown Search Results (AJAX Mockup) */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-400 tracking-wider uppercase">Kết quả tìm kiếm phù hợp</div>
              {searchResults.length > 0 ? (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSearchSelect(p.id)}
                    className="p-3 hover:bg-orange-50/50 cursor-pointer flex items-center gap-3 transition"
                  >
                    <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded-md border border-gray-100" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase">{p.brand}</span>
                        {p.specs.weight && <span className="text-[10px] text-gray-400">{p.specs.weight}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-orange-600">{(p.salePrice || p.price).toLocaleString('vi-VN')}đ</p>
                      {p.salePrice && (
                        <p className="text-[10px] text-gray-400 line-through">{p.price.toLocaleString('vi-VN')}đ</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">Không tìm thấy sản phẩm nào khớp với từ khóa.</div>
              )}
              <div 
                onClick={() => {
                  setView('catalog', { search: searchQuery });
                  setShowSearchDropdown(false);
                }} 
                className="p-2.5 bg-orange-50 text-center text-xs font-semibold text-orange-600 hover:bg-orange-100 cursor-pointer transition"
              >
                Xem tất cả kết quả cho "{searchQuery}"
              </div>
            </div>
          )}
        </div>

        {/* Icons Right Side */}
        <div className="hidden md:flex items-center gap-5">
          <button 
            onClick={() => setView('catalog')}
            className={`hidden lg:flex items-center gap-1.5 text-sm font-medium hover:text-orange-500 transition ${currentView === 'catalog' ? 'text-orange-500' : 'text-gray-700'}`}
          >
            <Trophy className="w-4.5 h-4.5" />
            <span>Sản Phẩm</span>
          </button>
          
          <button 
            onClick={() => setView('blog-list')}
            className={`hidden lg:flex items-center gap-1.5 text-sm font-medium hover:text-orange-500 transition ${currentView.startsWith('blog') ? 'text-orange-500' : 'text-gray-700'}`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span>Góc Kiến Thức</span>
          </button>

          <button className="text-gray-600 hover:text-orange-500 transition relative">
            <Heart className="w-5 h-5" />
          </button>

          <button 
            onClick={openCart}
            className="text-gray-600 hover:text-orange-500 transition relative flex items-center gap-1 p-2 bg-gray-50 hover:bg-orange-50 rounded-full"
          >
            <ShoppingBag className="w-5 h-5 text-gray-800 group-hover:text-orange-500" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" id="mobile-sidebar-drawer">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black"
            />

            {/* Sidebar content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 left-0 w-4/5 max-w-xs bg-white shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <img 
                      src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                      alt="Logo" 
                      className="w-7 h-7 rounded-md object-cover border border-gray-200 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-display font-extrabold text-base text-gray-900 tracking-tight">TOPVN<span className="text-orange-500">SPORT</span></span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg bg-white border border-gray-100 transition shadow-xs"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Main Links */}
                <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                  {/* Shop Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Danh Mục Sản Phẩm</h4>
                    <div className="grid grid-cols-1 gap-1">
                      <button 
                        onClick={() => { setView('catalog', { category: 'Vợt' }); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${currentView === 'catalog' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <Trophy className="w-4 h-4 text-orange-500" />
                        Vợt Cầu Lông Chuyên Nghiệp
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { category: 'Giày' }); setIsMobileMenuOpen(false); }}
                        className="w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        Giày Cầu Lông Chuyên Dụng
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { category: 'Túi xách' }); setIsMobileMenuOpen(false); }}
                        className="w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        Bao Vợt & Balo Thể Thao
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { category: 'Cước' }); setIsMobileMenuOpen(false); }}
                        className="w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        Cước Đan Vợt Chính Hãng
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { category: 'Quả cầu' }); setIsMobileMenuOpen(false); }}
                        className="w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        Quả Cầu Lông Chất Lượng
                      </button>
                    </div>
                  </div>

                  {/* Playstyle Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Lối Chơi (Playstyle)</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <button 
                        onClick={() => { setView('catalog', { characteristics: 'Tấn Công' }); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-orange-500 font-semibold text-gray-700"
                      >
                        💥 Thiên Công
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { characteristics: 'Phòng Thủ' }); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-orange-500 font-semibold text-gray-700"
                      >
                        ⚡ Phản Tạt
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { characteristics: 'Toàn Diện' }); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-orange-500 font-semibold text-gray-700"
                      >
                        🛡️ Toàn Diện
                      </button>
                      <button 
                        onClick={() => { setView('catalog', { characteristics: 'Người Mới' }); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-orange-500 font-semibold text-gray-700"
                      >
                        🔰 Người Mới
                      </button>
                    </div>
                  </div>

                  {/* Hot Brands Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Thương Hiệu Hot</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {['Yonex', 'Lining', 'Victor', 'Kumpoo', 'Mizuno', 'Joola'].map(brand => (
                        <button
                          key={brand}
                          onClick={() => { setView('catalog', { brand }); setIsMobileMenuOpen(false); }}
                          className="text-[11px] font-bold px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition"
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-1.5 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700">
                    <button 
                      onClick={() => { setView('blog-list'); setIsMobileMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-2 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                    >
                      <BookOpen className="w-4 h-4 text-orange-500" />
                      Góc Kiến Thức & Đánh Giá Sân
                    </button>
                    <button 
                      onClick={() => { setView('store-locator'); setIsMobileMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-2 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4 text-orange-500" />
                      Cửa hàng Trải Nghiệm Hà Nội
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer info */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400 font-medium space-y-1">
                <p>Hotline: 097 6007006</p>
                <p>© TopVNSport • O2O Badminton Hub</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mega Menu Navigation */}
      <nav className="hidden md:block bg-gray-50 border-t border-gray-100 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm font-medium">
          {/* Main Links */}
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide py-3 pr-4">
            {/* Vợt Cầu Lông Dropdown Trigger */}
            <div className="relative group cursor-pointer py-1 text-gray-800 hover:text-orange-500 transition flex items-center gap-1 shrink-0">
              <span onClick={() => setView('catalog', { category: 'Vợt' })}>Vợt Cầu Lông</span>
              <ChevronDown className="w-3.5 h-3.5" />
              {/* Mega Dropdown */}
              <div className="absolute top-full left-0 mt-3 w-[520px] bg-white border border-gray-100 rounded-xl shadow-2xl p-5 hidden group-hover:grid grid-cols-2 gap-6 z-50">
                <div>
                  <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2 text-xs uppercase tracking-wider text-orange-600">Thương hiệu quốc tế</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {['Yonex (Nhật Bản)', 'Lining (Trung Quốc)', 'Victor (Đài Loan)', 'Kumpoo (Quốc dân)', 'Mizuno (Nhật Bản)'].map((b, i) => (
                      <li key={i} onClick={() => setView('catalog', { brand: b.split(' ')[0] })} className="hover:text-orange-500 hover:pl-1 transition-all py-1">Vợt {b}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2 text-xs uppercase tracking-wider text-orange-600">Đặc tính lối chơi</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li onClick={() => setView('catalog', { characteristics: 'Tấn Công' })} className="hover:text-orange-500 hover:pl-1 transition-all py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Thiên công (Heavy Head)
                    </li>
                    <li onClick={() => setView('catalog', { characteristics: 'Phòng Thủ' })} className="hover:text-orange-500 hover:pl-1 transition-all py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Phản tạt / Tốc độ (Speed)
                    </li>
                    <li onClick={() => setView('catalog', { characteristics: 'Toàn Diện' })} className="hover:text-orange-500 hover:pl-1 transition-all py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Công thủ toàn diện (Even)
                    </li>
                    <li onClick={() => setView('catalog', { characteristics: 'Người Mới' })} className="hover:text-orange-500 hover:pl-1 transition-all py-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Dành cho người mới tập chơi
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Giày Cầu Lông Trigger */}
            <div className="relative group cursor-pointer py-1 text-gray-800 hover:text-orange-500 transition flex items-center gap-1 shrink-0">
              <span onClick={() => setView('catalog', { category: 'Giày' })}>Giày Cầu Lông</span>
              <ChevronDown className="w-3.5 h-3.5" />
              {/* Dropdown */}
              <div className="absolute top-full left-0 mt-3 w-[220px] bg-white border border-gray-100 rounded-lg shadow-xl p-3 hidden group-hover:block z-50">
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li onClick={() => setView('catalog', { category: 'Giày', isWide: true })} className="hover:text-orange-500 py-1 flex items-center justify-between">
                    <span>Giày Form Bè (Wide)</span>
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded-sm font-bold">Chân Bè</span>
                  </li>
                  <li onClick={() => setView('catalog', { category: 'Giày', brand: 'Yonex' })} className="hover:text-orange-500 py-1">Giày Yonex Power Cushion</li>
                  <li onClick={() => setView('catalog', { category: 'Giày', brand: 'Lining' })} className="hover:text-orange-500 py-1">Giày Lining Chuyên Dụng</li>
                </ul>
              </div>
            </div>

            {/* Other Categories */}
            <button onClick={() => setView('catalog', { category: 'Túi xách' })} className="text-gray-800 hover:text-orange-500 transition shrink-0 py-1">Bao Vợt & Balo</button>
            <button onClick={() => setView('catalog', { category: 'Cước' })} className="text-gray-800 hover:text-orange-500 transition shrink-0 py-1">Cước Đan Vợt</button>
            <button onClick={() => setView('catalog', { category: 'Quả cầu' })} className="text-gray-800 hover:text-orange-500 transition shrink-0 py-1">Quả Cầu Lông</button>
            
            <button onClick={() => setView('blog-list')} className="text-gray-800 hover:text-orange-500 transition shrink-0 py-1">Đánh Giá Sân Bãi</button>
          </div>

          {/* Consultation button */}
          <button 
            onClick={() => {
              const el = document.getElementById('racket-finder-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else setView('home', { scrollToWizard: true });
            }}
            className="hidden md:flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full border border-orange-100 transition duration-200"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Trình Cố Vấn Chọn Vợt</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
