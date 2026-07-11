import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, MapPin, Phone, ShieldCheck, Heart, User, Sparkles, Trophy, BookOpen, ChevronDown, Check, Trash, Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Product } from '../types';
import { getTopLevelProductCategories } from '../utils/categories';
import { getProductPath } from '../utils/productSlug';

interface HeaderProps {
  cartCount: number;
  openCart: () => void;
  products: Product[];
  categories: Category[];
}

export default function Header({ cartCount, openCart, products, categories }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.includes('catalog') ? 'catalog' : location.pathname.includes('blog') ? 'blog-list' : location.pathname.includes('store') ? 'store-locator' : location.pathname === '/' ? 'home' : '';
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

  const handleSearchSelect = (product: Product) => {
    navigate(getProductPath(product));
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const topLevelCategories = getTopLevelProductCategories(categories);

  const trendKeywords = ['Yonex Astrox', 'Giày Lining', 'Balo cầu lông', 'Cước đan vợt'];

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50 shadow-xs" id="topvnsport-header">
      {/* Top Bar */}
      <div className="hidden md:flex bg-gray-900 text-gray-300 text-xs py-2 px-8 flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-brand-primary" />
            Hotline: <strong className="text-white">097 6007006</strong> (08:00 - 22:00)
          </span>
          <span className="hidden md:inline text-gray-500">|</span>
          <span className="hidden md:flex items-center gap-1 text-brand-primary">
            <ShieldCheck className="w-3 h-3" /> Cam kết 100% chính hãng - Đền gấp 10 nếu giả
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/stores')} 
            className={`hover:text-brand-primary transition flex items-center gap-1 ${currentView === 'store-locator' ? 'text-brand-primary font-medium' : ''}`}
          >
            <MapPin className="w-3 h-3" /> Cửa hàng trải nghiệm TopVNSport
          </button>
          <span>|</span>
          <button className="hover:text-brand-primary transition">Tra cứu bảo hành</button>
          <span>|</span>
          <button className="hover:text-brand-primary transition">Kiểm tra đơn hàng</button>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 md:py-4 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
        {/* Brand Logo & Mobile Trigger & Mobile Quick Cart */}
        <div className="w-full md:w-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1.5 text-gray-700 hover:text-brand-primary hover:bg-gray-100 rounded-lg transition md:hidden"
              aria-label="Open mobile menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg border border-gray-100 shadow-xs flex items-center justify-center overflow-hidden group-hover:border-brand-primary/50 transition shrink-0">
                <img 
                  src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                  alt="TopVNSport Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="font-display font-extrabold text-lg md:text-2xl tracking-tight text-gray-900 block leading-none">
                  TOPVN<span className="text-brand-primary">SPORT</span>
                </span>
                <p className="text-[8px] md:text-[9px] text-gray-400 tracking-widest uppercase font-semibold mt-0.5">Badminton Speciality Store</p>
              </div>
            </div>
          </div>

          {/* Quick Cart on top right for mobile */}
          <button 
            onClick={openCart}
            className="md:hidden text-gray-700 hover:text-brand-primary transition relative flex items-center gap-1.5 p-2 bg-gray-50 hover:bg-brand-light rounded-full"
          >
            <ShoppingBag className="w-5 h-5 text-gray-800" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
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
              className="w-full pl-10 pr-4 py-1.5 md:py-2 bg-gray-50 border border-gray-200 rounded-full text-xs md:text-sm text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
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
                  navigate(`/catalog?search={kw }`);
                }}
                className="hover:text-brand-primary hover:underline transition"
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Dynamic Dropdown Search Results (AJAX Mockup) */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-xl shadow-sm z-50 overflow-hidden divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-400 tracking-wider uppercase">Kết quả tìm kiếm phù hợp</div>
              {searchResults.length > 0 ? (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSearchSelect(p)}
                    className="p-3 hover:bg-brand-light/50 cursor-pointer flex items-center gap-3 transition"
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
                      <p className="text-xs font-bold text-brand-primary">{(p.salePrice || p.price).toLocaleString('vi-VN')}đ</p>
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
                  navigate(`/catalog?search={searchQuery }`);
                  setShowSearchDropdown(false);
                }} 
                className="p-2.5 bg-brand-light text-center text-xs font-semibold text-brand-primary hover:bg-brand-light cursor-pointer transition"
              >
                Xem tất cả kết quả cho "{searchQuery}"
              </div>
            </div>
          )}
        </div>

        {/* Icons Right Side */}
        <div className="hidden md:flex items-center gap-5">
          <button 
            onClick={() => navigate('/catalog')}
            className={`hidden lg:flex items-center gap-1.5 text-sm font-medium hover:text-brand-primary transition ${currentView === 'catalog' ? 'text-brand-primary' : 'text-gray-700'}`}
          >
            <Trophy className="w-4.5 h-4.5" />
            <span>Sản Phẩm</span>
          </button>
          
          <button 
            onClick={() => navigate('/blog')}
            className={`hidden lg:flex items-center gap-1.5 text-sm font-medium hover:text-brand-primary transition ${currentView.startsWith('blog') ? 'text-brand-primary' : 'text-gray-700'}`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span>Góc Kiến Thức</span>
          </button>

          <button className="text-gray-600 hover:text-brand-primary transition relative">
            <Heart className="w-5 h-5" />
          </button>

          <button 
            onClick={openCart}
            className="text-gray-600 hover:text-brand-primary transition relative flex items-center gap-1 p-2 bg-gray-50 hover:bg-brand-light rounded-full"
          >
            <ShoppingBag className="w-5 h-5 text-gray-800 group-hover:text-brand-primary" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
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
                    <span className="font-display font-extrabold text-base text-gray-900 tracking-tight">TOPVN<span className="text-brand-primary">SPORT</span></span>
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
                  {topLevelCategories.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Danh Mục Sản Phẩm</h4>
                      <div className="grid grid-cols-1 gap-1">
                        {topLevelCategories.map((category, index) => (
                          <button
                            key={category.id}
                            onClick={() => { navigate(`/catalog?category=${encodeURIComponent(category.name)}`); setIsMobileMenuOpen(false); }}
                            className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${currentView === 'catalog' ? 'bg-brand-light text-brand-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            {index === 0 ? (
                              <Trophy className="w-4 h-4 text-brand-primary" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            {category.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playstyle Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Lối Chơi (Playstyle)</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <button 
                        onClick={() => { navigate(`/catalog?characteristics=Tấn Công`); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-brand-primary font-semibold text-gray-700"
                      >
                        💥 Thiên Công
                      </button>
                      <button 
                        onClick={() => { navigate(`/catalog?characteristics=Phòng Thủ`); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-brand-primary font-semibold text-gray-700"
                      >
                        ⚡ Phản Tạt
                      </button>
                      <button 
                        onClick={() => { navigate(`/catalog?characteristics=Toàn Diện`); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-brand-primary font-semibold text-gray-700"
                      >
                        🛡️ Toàn Diện
                      </button>
                      <button 
                        onClick={() => { navigate(`/catalog?characteristics=Người Mới`); setIsMobileMenuOpen(false); }}
                        className="p-2 border border-gray-100 rounded-lg text-center hover:border-brand-primary font-semibold text-gray-700"
                      >
                        🔰 Người Mới
                      </button>
                    </div>
                  </div>

                  {/* Hot Brands Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Thương Hiệu Hot</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {['Yonex', 'Lining', 'Victor', 'Kumpoo', 'Mizuno', 'Joola'].map(brand => (
                        <button
                          key={brand}
                          onClick={() => { navigate(`/catalog?brand=${brand}`); setIsMobileMenuOpen(false); }}
                          className="text-[11px] font-bold px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 hover:bg-brand-light hover:text-brand-primary transition"
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-1.5 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700">
                    <button 
                      onClick={() => { navigate('/blog'); setIsMobileMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-2 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                    >
                      <BookOpen className="w-4 h-4 text-brand-primary" />
                      Góc Kiến Thức & Đánh Giá Sân
                    </button>
                    <button 
                      onClick={() => { navigate('/stores'); setIsMobileMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-2 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4 text-brand-primary" />
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
            {topLevelCategories.map(category => (
              <button key={category.id} onClick={() => navigate(`/catalog?category=${encodeURIComponent(category.name)}`)} className="text-gray-800 hover:text-brand-primary transition shrink-0 py-1">{category.name}</button>
            ))}
            
            <button onClick={() => navigate('/blog')} className="text-gray-800 hover:text-brand-primary transition shrink-0 py-1">Đánh Giá Sân Bãi</button>
          </div>

          {/* Consultation button */}
          <button 
            onClick={() => {
              const el = document.getElementById('racket-finder-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else navigate('/');
            }}
            className="hidden md:flex items-center gap-1.5 text-xs text-brand-primary bg-brand-light hover:bg-brand-light px-3 py-1.5 rounded-full border border-blue-100 transition duration-200"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Trình Cố Vấn Chọn Vợt</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
