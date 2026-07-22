import { ChevronRight, Sparkles } from 'lucide-react';
import { MouseEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import HeroSlider from '../../components/HeroSlider';
import ProductCard from '../../components/ProductCard';
import RacketFinder from '../../components/RacketFinder';
import TrustBadges from '../../components/TrustBadges';
import { getProductCategoryCounts, getTopLevelProductCategories } from '../../utils/categories';
import { addCartItem, buildDefaultCartItem, openCart, setQuickViewProduct } from '../cart/cartSlice';
import { categoryTileThemes, getCategoryMonogram, getCategorySubtitle } from './categoryTileThemes';

import { sportApi } from '../../services/sportApi';
import { PromotionItem } from '../../services/sport-api/types';

export default function HomePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const products = useAppSelector(state => state.appData.products);
  const blogs = useAppSelector(state => state.appData.blogs);
  const categories = useAppSelector(state => state.appData.categories);

  const topLevelCategories = getTopLevelProductCategories(categories);
  const categoryCounts = getProductCategoryCounts(products);

  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });
  const [activePromo, setActivePromo] = useState<PromotionItem | null>(null);

  useEffect(() => {
    sportApi.getActivePromotions().then(promos => {
      if (promos && promos.length > 0) {
        setActivePromo(promos[0]);
      }
    }).catch(err => console.warn('Active promo fetch error:', err));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 45, seconds: 30 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  const handleAddToCart = (product: (typeof products)[number], e?: MouseEvent) => {
    if (e) e.stopPropagation();
    dispatch(addCartItem(buildDefaultCartItem(product)));
    dispatch(openCart());
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      <HeroSlider />
      <TrustBadges />

      {topLevelCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="font-display font-black text-lg md:text-2xl text-gray-900 tracking-tight uppercase mb-6 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-primary" /> Danh mục trang thiết bị cầu lông
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topLevelCategories.map((cat, index) => {
              const theme = categoryTileThemes[index % categoryTileThemes.length];

              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => navigate(`/catalog?category=${encodeURIComponent(cat.name)}`)}
                  aria-label={`Mở danh mục ${cat.name}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${theme.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                  <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${theme.shell}`} />

                  <div className="relative flex h-full min-h-[180px] flex-col gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.28em] ${theme.chip}`}>
                        {categoryCounts[cat.name] || 0} sản phẩm
                      </span>
                      <ChevronRight className={`w-4 h-4 ${theme.badge} transition-transform duration-300 group-hover:translate-x-1`} />
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gray-400 group-hover:text-brand-primary transition">Danh mục</p>
                        <h3 className="mt-1 font-display text-xl font-black tracking-tight text-gray-900 group-hover:text-brand-primary transition">
                          {cat.name}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-3">
                          {getCategorySubtitle(cat)}
                        </p>
                      </div>

                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br ${theme.shell} shadow-inner`}>
                        <span className={`font-display text-xl font-black tracking-tight ${theme.monogram}`}>
                          {getCategoryMonogram(cat.name)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between text-[11px] font-medium text-gray-500">
                      <span>{categoryCounts[cat.name] || 0} sản phẩm</span>
                      <span className="font-bold text-brand-primary">Khám phá</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="bg-brand-accent rounded-2xl p-6 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

          <div className="space-y-2 text-center lg:text-left">
            <span className="bg-white/10 text-white border border-white/20 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
              {activePromo ? `CHƯƠNG TRÌNH KHUYẾN MÃI` : `GIỜ VÀNG SĂN DEAL CHẤT`}
            </span>
            <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight uppercase leading-none">
              {activePromo ? activePromo.name : `XẢ KHO CỰC HẠN - GIẢM GIÁ 30%`}
            </h3>
            <p className="text-xs text-red-100 font-medium">
              {activePromo ? (
                <>Nhập mã <strong className="bg-white text-black px-2 py-0.5 rounded font-mono font-bold text-xs">{activePromo.code}</strong> khi thanh toán để nhận ưu đãi!</>
              ) : (
                `Bảo hành chính hãng đầy đủ, đổi trả thuận tiện tại hơn 80 chi nhánh.`
              )}
            </p>
          </div>

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


        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {products
            .filter(p => p.salePrice)
            .slice(0, 4)
            .map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={prod => dispatch(setQuickViewProduct(prod))}
                onAddToCart={(prod, e) => handleAddToCart(prod, e)}
              />
            ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <RacketFinder products={products} />
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">Kiến thức chuyên môn</span>
            <h2 className="font-display font-black text-xl md:text-2xl text-gray-900 tracking-tight uppercase mt-2">
              BÀI VIẾT NỔI BẬT & ĐÁNH GIÁ THỰC TẾ
            </h2>
          </div>
          <button
            onClick={() => navigate('/blog')}
            className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-0.5"
          >
            Xem tất cả bài viết <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogs.slice(0, 3).map(blog => (
            <div
              key={blog.id}
              onClick={() => navigate(`/blog/${blog.id}`)}
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
  );
}
