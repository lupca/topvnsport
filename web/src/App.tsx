/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HeroSlider from './components/HeroSlider';
import ProductCard from './components/ProductCard';
import RacketFinder from './components/RacketFinder';
import ProductDetailPage from './components/ProductDetailPage';
import BlogSection from './components/BlogSection';
import StoreLocator from './components/StoreLocator';
import CartModal, { CartItem } from './components/CartModal';
import Footer from './components/Footer';
import { sportApi } from './services/sportApi';
import { Product, StringOption, Blog, Branch } from './types';
import { ShieldCheck, Trophy, Sparkles, MapPin, Phone, Star, ShoppingBag, Eye, X, Filter, SlidersHorizontal, RefreshCw, Calendar, Clock, ChevronRight, Home, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QuickViewModal from './components/QuickViewModal';
import TrustBadges from './components/TrustBadges';

export default function App() {
  // API Dynamic States
  const [products, setProducts] = useState<Product[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stringOptions, setStringOptions] = useState<StringOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Navigation & State management
  const [currentView, setCurrentView] = useState<'home' | 'catalog' | 'product-detail' | 'blog-list' | 'blog-detail' | 'store-locator'>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  
  // Shopping Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Quick View Modal product
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Filter States (PLP / Catalog)
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [maxPrice, setMaxPrice] = useState<number>(6000000);
  const [selectedWeight, setSelectedWeight] = useState<string[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<string>('Tất cả');
  const [selectedStiffness, setSelectedStiffness] = useState<string>('Tất cả');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Flash Sale Countdown timer
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 45, seconds: 30 }; // Loop countdown
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hydrate application state with async sportApi calls
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [prodList, blogList, branchList, stringList] = await Promise.all([
          sportApi.getProducts(),
          sportApi.getBlogs(),
          sportApi.getBranches(),
          sportApi.getStringOptions()
        ]);
        if (isMounted) {
          setProducts(prodList);
          setBlogs(blogList);
          setBranches(branchList);
          setStringOptions(stringList);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch data from sportApi:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // View Switcher Router
  const setView = (view: string, extra?: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Parse filters / options if passed
    if (view === 'catalog') {
      if (extra?.category) setSelectedCategory(extra.category);
      else setSelectedCategory('Tất cả');

      if (extra?.brand) {
        setSelectedBrand([extra.brand]);
      } else {
        setSelectedBrand([]);
      }

      if (extra?.characteristics) {
        // Find matching products or query characteristics
        // (will filter characteristics)
      }

      if (extra?.search) {
        setSearchQuery(extra.search);
      } else {
        setSearchQuery('');
      }

      setCurrentView('catalog');
    } else if (view === 'product-detail') {
      if (extra?.productId) {
        setSelectedProductId(extra.productId);
        setCurrentView('product-detail');
      }
    } else if (view === 'blog-detail') {
      if (extra?.blogId) {
        setSelectedBlogId(extra.blogId);
        setCurrentView('blog-detail');
      }
    } else {
      setCurrentView(view as any);
    }
  };

  // Cart operations
  const resolveSkuCode = (product: Product, color: string, weight: string) => {
    const colorSku = product.skuByColor?.[color];
    if (colorSku) return colorSku;

    const byVariant = product.skuByVariant?.[`${color}||${weight}`];
    if (byVariant) return byVariant;

    return product.defaultSku || `SKU-${product.id}-${weight.replace(/\//g, '-')}-${color.replace(/\//g, '-')}`;
  };

  const handleAddToCart = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Add default specs
    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      skuCode: resolveSkuCode(
        product,
        product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn',
        product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn'
      ),
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.salePrice || product.price,
      selectedWeight: product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn',
      selectedColor: product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn',
      stringOption: null,
      tension: 10.5,
      quantity: 1
    };

    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);
  };

  const handleAddToCartWithSpecs = (product: Product, weight: string, color: string, stringChoice: StringOption | null, tension: number) => {
    const newItem: CartItem = {
      id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${Date.now()}`,
      productId: product.id,
      skuCode: resolveSkuCode(product, color, weight),
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.salePrice || product.price,
      selectedWeight: weight,
      selectedColor: color,
      stringOption: stringChoice,
      tension: tension,
      quantity: 1
    };

    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => setCartItems([]);

  // Catalog item filtering logic
  const filteredProducts = products.filter(p => {
    // Category filter
    if (selectedCategory !== 'Tất cả' && p.category !== selectedCategory) return false;
    
    // Brand filter
    if (selectedBrand.length > 0 && !selectedBrand.includes(p.brand)) return false;

    // Price range filter
    const displayPrice = p.salePrice || p.price;
    if (displayPrice > maxPrice) return false;

    // Weight filter
    if (selectedWeight.length > 0 && p.category === 'Vợt') {
      const match = selectedWeight.some(wt => p.specs.weight.includes(wt));
      if (!match) return false;
    }

    // Balance head/light filter
    if (selectedBalance !== 'Tất cả' && p.category === 'Vợt') {
      if (selectedBalance === 'nặng' && p.specs.balance < 298) return false;
      if (selectedBalance === 'nhẹ' && p.specs.balance > 288) return false;
      if (selectedBalance === 'cân bằng' && (p.specs.balance < 288 || p.specs.balance >= 298)) return false;
    }

    // Stiffness filter
    if (selectedStiffness !== 'Tất cả' && p.category === 'Vợt') {
      const pStiff = p.specs.stiffness.toLowerCase();
      if (selectedStiffness === 'cứng' && !pStiff.includes('cứng')) return false;
      if (selectedStiffness === 'dẻo' && !pStiff.includes('dẻo')) return false;
      if (selectedStiffness === 'trung bình' && !pStiff.includes('trung bình')) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = p.brand.toLowerCase().includes(q);
      const matchSeries = p.series && p.series.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSeries) return false;
    }

    return true;
  });

  const resetFilters = () => {
    setSelectedBrand([]);
    setSelectedCategory('Tất cả');
    setMaxPrice(6000000);
    setSelectedWeight([]);
    setSelectedBalance('Tất cả');
    setSelectedStiffness('Tất cả');
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans antialiased" id="api-loading-state">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="relative inline-flex">
            <span className="absolute inline-flex h-12 w-12 rounded-full bg-brand-primary opacity-20 animate-ping"></span>
            <div className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-center  duration-1000">
              <RefreshCw className="w-8 h-8 text-brand-primary animate-spin text-center" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display font-black text-gray-900 text-lg uppercase tracking-wider">TopVNSport API</h3>
            <p className="text-xs text-gray-500 font-medium">Đang tải đồng bộ cơ sở dữ liệu thiết bị cầu lông & O2O chi nhánh...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-brand-primary selection:text-white antialiased pb-16 md:pb-0">
      {/* Header element */}
      <Header
        currentView={currentView}
        setView={setView}
        cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
        openCart={() => setIsCartOpen(true)}
        products={products}
      />

      {/* Primary content router block */}
      <main className="flex-1">
        
        {/* VIEW: HOME */}
        {currentView === 'home' && (
          <div className="space-y-12 animate-in fade-in duration-300">
            {/* Top promotional carousel slider */}
            <HeroSlider onCtaClick={setView} />

            {/* Core trust tags ribbons (Thanh niềm tin) */}
            <TrustBadges />

            {/* Quick access categories grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-8">
              <h2 className="font-display font-black text-lg md:text-2xl text-gray-900 tracking-tight uppercase mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-primary" /> Danh mục trang thiết bị cầu lông
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { id: 'Vợt', name: 'Vợt Cầu Lông', count: '12 mẫu', img: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=300&q=80' },
                  { id: 'Giày', name: 'Giày Chống Lật', count: '8 mẫu', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80' },
                  { id: 'Túi xách', name: 'Túi & Balo', count: '5 mẫu', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80' },
                  { id: 'Cước', name: 'Cước Đan Vợt', count: '7 loại', img: 'https://images.unsplash.com/photo-1613531415875-161a5622c5b7?auto=format&fit=crop&w=300&q=80' },
                  { id: 'Quả cầu', name: 'Hộp Quả Cầu', count: '3 loại', img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=300&q=80' }
                ].map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => setView('catalog', { category: cat.id })}
                    className="group relative bg-white border border-gray-100 rounded-xl overflow-hidden p-4 text-center cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col items-center justify-between"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden mb-3">
                      <img src={cat.img} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-gray-800 group-hover:text-brand-primary transition">{cat.name}</h4>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{cat.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Flash Sale Widget Section with countdown clock */}
            <section className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="bg-brand-accent rounded-2xl p-6 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                
                <div className="space-y-2 text-center lg:text-left">
                  <span className="bg-white/10 text-white border border-white/20 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">GIỜ VÀNG SĂN DEAL CHẤT</span>
                  <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight uppercase leading-none">XẢ KHO CỰC HẠN - GIẢM GIÁ 30%</h3>
                  <p className="text-xs text-red-100 font-medium">Bảo hành chính hãng đầy đủ, đổi trả thuận tiện tại hơn 80 chi nhánh.</p>
                </div>

                {/* Real-time Countdown clock */}
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs text-red-100 uppercase tracking-widest mr-2 hidden md:inline font-bold">Kết thúc sau:</span>
                  <div className="bg-black/35 px-4 py-2.5 rounded-lg text-center min-w-[50px]">
                    <span className="text-base md:text-xl font-extrabold text-white block">{timeLeft.hours.toString().padStart(2, '0')}</span>
                    <span className="text-[8px] text-gray-400 uppercase">Giờ</span>
                  </div>
                  <span className="text-xl font-bold ">:</span>
                  <div className="bg-black/35 px-4 py-2.5 rounded-lg text-center min-w-[50px]">
                    <span className="text-base md:text-xl font-extrabold text-white block">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                    <span className="text-[8px] text-gray-400 uppercase">Phút</span>
                  </div>
                  <span className="text-xl font-bold ">:</span>
                  <div className="bg-black/35 px-4 py-2.5 rounded-lg text-center min-w-[50px]">
                    <span className="text-base md:text-xl font-extrabold text-brand-primary block">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                    <span className="text-[8px] text-gray-400 uppercase">Giây</span>
                  </div>
                </div>
              </div>

              {/* Flash sale products grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                {products.filter(p => p.salePrice).slice(0, 4).map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onViewDetails={(id) => setView('product-detail', { productId: id })}
                    onQuickView={(prod) => setQuickViewProduct(prod)}
                    onAddToCart={(prod, e) => handleAddToCart(prod, e)}
                  />
                ))}
              </div>
            </section>

            {/* Racket Finder Wizard element */}
            <section className="max-w-7xl mx-auto px-4 md:px-8">
              <RacketFinder products={products} onProductClick={(id) => setView('product-detail', { productId: id })} />
            </section>

            {/* Knowledge Base Blog previews */}
            <section className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">Kiến thức chuyên môn</span>
                  <h2 className="font-display font-black text-xl md:text-2xl text-gray-900 tracking-tight uppercase mt-2">
                    BÀI VIẾT NỔI BẬT & ĐÁNH GIÁ THỰC TẾ
                  </h2>
                </div>
                <button
                  onClick={() => setView('blog-list')}
                  className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-0.5"
                >
                  Xem tất cả bài viết <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogs.slice(0, 3).map(blog => (
                  <div
                    key={blog.id}
                    onClick={() => setView('blog-detail', { blogId: blog.id })}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <img src={blog.image} alt={blog.title} className="aspect-[16/10] w-full object-cover" />
                      <div className="p-4 space-y-1.5">
                        <span className="text-[9px] bg-brand-light text-brand-secondary font-bold px-2 py-0.5 rounded-sm uppercase">{blog.category}</span>
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-2 hover:text-brand-primary transition leading-snug">{blog.title}</h4>
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{blog.summary}</p>
                      </div>
                    </div>
                    <div className="p-4 pt-0 text-[10px] text-gray-400 font-mono flex justify-between items-center mt-3">
                      <span>{blog.date}</span>
                      <span className="font-bold text-brand-primary">Đọc ngay &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* VIEW: CATALOG (Product Listing Page - PLP) */}
        {currentView === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-300">
            {/* Title banner */}
            <div className="text-center mb-10">
              <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">TopVNSport Product Directory</span>
              <h1 className="font-display font-black text-2xl md:text-4xl text-gray-900 tracking-tight uppercase mt-2">
                HỆ THỐNG PHÂN LOẠI THIẾT BỊ <span className="text-brand-primary">TIÊU CHUẨN</span>
              </h1>
              <p className="text-xs md:text-sm text-gray-500 max-w-lg mx-auto mt-2">
                Lọc nhanh thông số cây vợt lý tưởng theo cân nặng, điểm cân bằng tĩnh, độ cứng đũa và phân khúc tài chính tối ưu nhất.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Sidebar Filters Column (1 col) */}
              <div className="lg:col-span-1 space-y-5">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-5 sticky top-24">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="font-bold text-xs uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-brand-primary" /> Bộ lọc sản phẩm
                    </span>
                    <button
                      onClick={resetFilters}
                      className="text-[11px] text-gray-400 hover:text-brand-primary font-bold flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Xóa bộ lọc
                    </button>
                  </div>

                  {/* Brand select filter checkboxes */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Thương hiệu quốc tế</h4>
                    <div className="space-y-1.5">
                      {['Yonex', 'Lining', 'Victor', 'Kumpoo'].map(brand => (
                        <label key={brand} className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBrand.includes(brand)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBrand(prev => [...prev, brand]);
                              } else {
                                setSelectedBrand(prev => prev.filter(b => b !== brand));
                              }
                            }}
                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary/40"
                          />
                          <span>{brand}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category tabs filters */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Phân loại sản phẩm</h4>
                    <div className="space-y-1.5 flex flex-col">
                      {['Tất cả', ...Array.from(new Set(products.map(p => p.category)))].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-xs text-left py-1.5 px-2.5 rounded-lg font-bold transition flex items-center justify-between ${selectedCategory === cat ? 'bg-brand-light text-brand-primary font-black' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          <span>{cat}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            ({cat === 'Tất cả' ? products.length : products.filter(p => p.category === cat).length})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price budget handle sliders */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                      <span>Ngân sách tối đa</span>
                      <span className="text-brand-primary font-mono">{maxPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <input
                      type="range"
                      min="100000"
                      max="6000000"
                      step="100000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                      className="w-full accent-brand-primary h-1 bg-gray-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>100Kđ</span>
                      <span>6.0Mđ</span>
                    </div>
                  </div>

                  {/* Weight filter tags (For Rackets only) */}
                  {selectedCategory === 'Vợt' && (
                    <>
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Trọng lượng (U)</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {['3U', '4U', '5U'].map(wt => (
                            <button
                              key={wt}
                              onClick={() => {
                                if (selectedWeight.includes(wt)) {
                                  setSelectedWeight(prev => prev.filter(w => w !== wt));
                                } else {
                                  setSelectedWeight(prev => [...prev, wt]);
                                }
                              }}
                              className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-md border transition ${selectedWeight.includes(wt) ? 'bg-brand-primary text-white border-brand-primary shadow-xs' : 'bg-white border-gray-150 text-gray-700 hover:bg-gray-50'}`}
                            >
                              {wt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Balance static filter */}
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Điểm Cân Bằng</h4>
                        <select
                          value={selectedBalance}
                          onChange={(e) => setSelectedBalance(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-hidden focus:border-brand-primary"
                        >
                          <option value="Tất cả">Mọi điểm cân bằng</option>
                          <option value="nặng">Nặng Đầu (&gt; 298mm - Công)</option>
                          <option value="nhẹ">Nhẹ Đầu (&lt; 288mm - Thủ)</option>
                          <option value="cân bằng">Cân Bằng (288 - 298mm - Công Thủ)</option>
                        </select>
                      </div>

                      {/* Stiffness filter select */}
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Độ Cứng Thân (Stiffness)</h4>
                        <select
                          value={selectedStiffness}
                          onChange={(e) => setSelectedStiffness(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-hidden focus:border-brand-primary"
                        >
                          <option value="Tất cả">Mọi độ cứng</option>
                          <option value="cứng">Siêu Cứng / Cứng (Extra Stiff/Stiff)</option>
                          <option value="trung bình">Trung Bình (Medium)</option>
                          <option value="dẻo">Thân Dẻo Trợ Lực (Flexible)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Product list grid (3 cols) */}
              <div className="lg:col-span-3 space-y-6">
                {searchQuery && (
                  <div className="bg-brand-light border border-blue-100 rounded-xl p-3 flex justify-between items-center">
                    <p className="text-xs text-brand-secondary">Đang tìm kết quả lọc theo từ khóa: <strong>"{searchQuery}"</strong></p>
                    <button onClick={() => setSearchQuery('')} className="p-1 text-brand-secondary hover:bg-brand-light rounded-full"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map(p => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onViewDetails={(id) => setView('product-detail', { productId: id })}
                        onQuickView={(prod) => setQuickViewProduct(prod)}
                        onAddToCart={(prod, e) => handleAddToCart(prod, e)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-24 bg-white border border-gray-100 rounded-2xl p-6">
                    <p className="text-gray-500 text-sm">Không tìm thấy sản phẩm nào khớp với bộ lọc của bạn.</p>
                    <button onClick={resetFilters} className="mt-4 bg-brand-primary text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-secondary transition ">
                      Làm mới bộ lọc
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* VIEW: PRODUCT DETAIL (PDP) */}
        {currentView === 'product-detail' && selectedProductId && (
          <ProductDetailPage
            product={products.find(p => p.id === selectedProductId) || products[0]}
            stringOptions={stringOptions}
            onAddToCartWithSpecs={handleAddToCartWithSpecs}
            onBackToCatalog={() => setView('catalog')}
            onBookTestAtStore={() => setView('store-locator')}
          />
        )}

        {/* VIEW: BLOG SECTIONS (Directory / Reader) */}
        {(currentView === 'blog-list' || currentView === 'blog-detail') && (
          <BlogSection
            blogs={blogs}
            selectedBlogId={currentView === 'blog-detail' ? selectedBlogId : undefined}
            onBlogClick={(id) => setView('blog-detail', { blogId: id })}
            onBackToBlogs={() => setView('blog-list')}
          />
        )}

        {/* VIEW: STORE LOCATOR (O2O Booking) */}
        {currentView === 'store-locator' && (
          <StoreLocator
            branches={branches}
            products={products}
          />
        )}

      </main>

      {/* FOOTER widget */}
      <Footer setView={setView} />

      {/* SHOPPING CART / CHECKOUT SLIDE DRAWER MODAL */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
      />

      {/* QUICK VIEW POPUP MODAL (For lightning speed spec checks!) */}
      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* MOBILE APP-LIKE BOTTOM TAB NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex justify-around items-center py-2 px-2 shadow-sm rounded-t-2xl">
        <button
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 p-1 transition ${currentView === 'home' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Trang chủ</span>
        </button>

        <button
          onClick={() => setView('catalog')}
          className={`flex flex-col items-center gap-1 p-1 transition ${currentView === 'catalog' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px]">Sản phẩm</span>
        </button>

        <button
          onClick={() => {
            setView('home');
            setTimeout(() => {
              const el = document.getElementById('racket-finder-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="flex flex-col items-center gap-1 p-1 text-gray-400 hover:text-brand-primary transition"
        >
          <Sparkles className="w-5 h-5 text-brand-primary " />
          <span className="text-[10px] text-brand-primary font-medium">Chọn vợt AI</span>
        </button>

        <button
          onClick={() => setView('store-locator')}
          className={`flex flex-col items-center gap-1 p-1 transition ${currentView === 'store-locator' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px]">Cửa hàng</span>
        </button>

        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center gap-1 p-1 text-gray-400 hover:text-brand-primary transition relative"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-gray-500" />
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </div>
          <span className="text-[10px]">Giỏ hàng</span>
        </button>
      </div>
    </div>
  );
}
