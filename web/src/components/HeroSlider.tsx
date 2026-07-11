import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  ctaText: string;
  category: string;
  productSlug?: string;
}

interface HeroSliderProps {}

const slides: Slide[] = [
  {
    id: 1,
    title: 'SIÊU PHẨM YONEX ASTROX 100ZZ KURENAI',
    subtitle: 'Vũ khí hủy diệt của huyền thoại Viktor Axelsen. Sức mạnh đập cầu tấn công cực hạn, điểm ngọt tối ưu hóa.',
    badge: 'MÃ JP CHÍNH HÃNG',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Khám Phá Siêu Phẩm',
    category: 'Vợt',
    productSlug: 'yonex-astrox-100zz'
  },
  {
    id: 2,
    title: 'Lining G-Force X5 - Vợt Quốc Dân Trợ Lực',
    subtitle: 'Cực kỳ nhẹ nhàng 5U (79g), thân dẻo dai đàn hồi cao, kiến tạo những pha cầu tốc độ phòng thủ phản tạt không tốn sức.',
    badge: 'GIÁ TỐT NHẬP MÔN',
    image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Mua Ngay Chỉ 850K',
    category: 'Vợt',
    productSlug: 'lining-gforce-x5'
  },
  {
    id: 3,
    title: 'Siêu Sale Cước Đan & Phụ Kiện',
    subtitle: 'Ưu đãi mạnh cho dây cước, túi vợt và phụ kiện chính hãng để hoàn thiện bộ sưu tập cầu lông của bạn.',
    badge: 'KHUYẾN MÃI HOT',
    image: 'https://images.unsplash.com/photo-1613531415875-161a5622c5b7?auto=format&fit=crop&w=1200&q=80',
    ctaText: 'Xem Ngay Ưu Đãi',
    category: 'Cước',
    productSlug: 'yonex-exbolt-68'
  }
];

export default function HeroSlider() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="relative w-full h-[320px] md:h-[500px] overflow-hidden bg-gray-950" id="topvnsport-hero">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/60 to-transparent z-10" />
          <img
            src={slides[current].image}
            alt={slides[current].title}
            className="w-full h-full object-cover opacity-80"
            referrerPolicy="no-referrer"
          />

          {/* Slide Content */}
          <div className="absolute inset-0 z-20 flex items-center">
            <div className="max-w-7xl mx-auto w-full px-6 md:px-12">
              <div className="max-w-xl md:max-w-2xl space-y-4">
                <motion.span
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1 bg-brand-primary text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {slides[current].badge}
                </motion.span>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="font-display font-extrabold text-2xl md:text-5xl text-white tracking-tight leading-none uppercase"
                >
                  {slides[current].title}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xs md:text-base text-gray-300 font-light"
                >
                  {slides[current].subtitle}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-2"
                >
                  <button
                    onClick={() => {
                      if (slides[current].productSlug) {
                        navigate(`/product/${slides[current].productSlug}`);
                      } else {
                        navigate(`/catalog?category=${slides[current].category}`);
                      }
                    }}
                    className="bg-brand-primary hover:bg-brand-secondary text-white text-xs md:text-sm font-bold px-6 py-3 rounded-full transition-all duration-300 shadow-sm hover:shadow-brand-primary/20 "
                  >
                    {slides[current].ctaText}
                  </button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Control buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-brand-primary/80 text-white p-2 rounded-full transition"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-brand-primary/80 text-white p-2 rounded-full transition"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-brand-primary' : 'bg-gray-500'}`}
          />
        ))}
      </div>
    </div>
  );
}
