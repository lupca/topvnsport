import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, ShieldCheck, DollarSign, RefreshCw, ChevronRight, Check } from 'lucide-react';
import { Product } from '../types';

interface RacketFinderProps {
  products: Product[];
  
}

export default function RacketFinder({ products }: RacketFinderProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    skill: '',
    style: '',
    budget: ''
  });
  const [recommendations, setRecommendations] = useState<Product[]>([]);

  const handleSelect = (field: 'skill' | 'style' | 'budget', value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => Math.max(1, prev - 1));

  const handleCalculate = () => {
    // Basic heuristic rules for matching rackets based on inputs
    let matches = products.filter(p => p.category === 'Vợt');

    // Filter by budget
    if (answers.budget === 'low') {
      matches = matches.filter(p => p.price <= 1500000);
    } else if (answers.budget === 'medium') {
      matches = matches.filter(p => p.price > 1000000 && p.price <= 3000000);
    } else if (answers.budget === 'high') {
      matches = matches.filter(p => p.price > 3000000);
    }

    // Filter by style
    if (answers.style === 'attack') {
      matches = matches.sort((a, b) => (b.specs.balance || 0) - (a.specs.balance || 0)); // Nặng đầu lên trước
    } else if (answers.style === 'defense') {
      matches = matches.sort((a, b) => (a.specs.balance || 0) - (b.specs.balance || 0)); // Nhẹ đầu lên trước
    }

    // Default Fallbacks if list is too narrow
    if (matches.length === 0) {
      matches = products.filter(p => p.category === 'Vợt').slice(0, 3);
    }

    setRecommendations(matches.slice(0, 3));
    setStep(4);
  };

  const handleReset = () => {
    setAnswers({ skill: '', style: '', budget: '' });
    setRecommendations([]);
    setStep(1);
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-6 md:p-8 text-white border border-gray-800 " id="racket-finder-section">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Title */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary text-xs font-semibold px-3 py-1 rounded-full border border-brand-primary/20 uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5 text-brand-primary" /> Trình cố vấn ảo chọn vợt thông minh
          </span>
          <h2 className="font-display font-extrabold text-xl md:text-3xl tracking-tight leading-tight">
            TÌM KIẾM VỢT PHÙ HỢP CHỈ TRONG <span className="text-brand-primary">30 GIÂY</span>
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-2">
            Giải quyết triệt để vấn đề không thấu hiểu thông số kỹ thuật. Trả lời 3 câu hỏi nhanh, hệ thống sẽ đề xuất mẫu vợt lý tưởng theo thể trạng của bạn.
          </p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step === s ? 'bg-brand-primary text-white font-black scale-110 shadow-sm shadow-brand-primary/20' : step > s ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-gray-800 text-gray-500'}`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-8 md:w-16 h-0.5 rounded-full ${step > s ? 'bg-brand-primary' : 'bg-gray-800'}`} />}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: Skill Level */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold uppercase text-brand-primary tracking-wider text-center mb-4">Câu hỏi 1: Trình độ chơi cầu lông của bạn ở mức nào?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'beginner', title: 'Mới Tập Chơi / Học Sinh', desc: 'Lực cổ tay còn yếu, cần một cây vợt dẻo, trợ lực tốt và dễ điều khiển.' },
                  { id: 'intermediate', title: 'Phong Trào Trung Bình', desc: 'Đã chơi từ 6 tháng - 2 năm, có thể phông cầu và đánh lướt cơ bản.' },
                  { id: 'pro', title: 'Bán Chuyên / Chuyên Nghiệp', desc: 'Cổ tay rất khỏe, thích dòng vợt cứng, độ cân bằng cực đoan để tối ưu kỹ thuật.' }
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect('skill', opt.id)}
                    className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${answers.skill === opt.id ? 'bg-brand-primary/10 border-brand-primary text-white shadow-sm' : 'bg-gray-850 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}`}
                  >
                    <h4 className="font-bold text-base mb-1.5 flex items-center gap-2">
                      <Trophy className={`w-4 h-4 ${answers.skill === opt.id ? 'text-brand-primary' : 'text-gray-400'}`} />
                      {opt.title}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <button
                  disabled={!answers.skill}
                  onClick={nextStep}
                  className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full flex items-center gap-1.5 transition"
                >
                  Tiếp tục <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Play Style */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold uppercase text-brand-primary tracking-wider text-center mb-4">Câu hỏi 2: Lối đánh ưa thích của bạn là gì?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'attack', title: 'Thiên Công Bạo Lực', desc: 'Thích đập nhảy, đập cầu uy lực từ cuối sân. Muốn vợt nặng đầu, đũa cứng.' },
                  { id: 'defense', title: 'Phản Tạt / Tốc Độ', desc: 'Thích thủ cầu, tì đè lưới, phản tạt nhanh. Cần vợt nhẹ đầu để xoay trở mượt.' },
                  { id: 'allround', title: 'Công Thủ Toàn Diện', desc: 'Thích điều cầu, kiểm soát trận đấu và linh hoạt giữa tấn công/phòng thủ.' }
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect('style', opt.id)}
                    className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${answers.style === opt.id ? 'bg-brand-primary/10 border-brand-primary text-white' : 'bg-gray-850 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}`}
                  >
                    <h4 className="font-bold text-base mb-1.5 flex items-center gap-2">
                      <ShieldCheck className={`w-4 h-4 ${answers.style === opt.id ? 'text-brand-primary' : 'text-gray-400'}`} />
                      {opt.title}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <button
                  onClick={prevStep}
                  className="border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full transition"
                >
                  Quay lại
                </button>
                <button
                  disabled={!answers.style}
                  onClick={nextStep}
                  className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full flex items-center gap-1.5 transition"
                >
                  Tiếp tục <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Budget Range */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold uppercase text-brand-primary tracking-wider text-center mb-4">Câu hỏi 3: Khoảng ngân sách đầu tư cho vợt?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'low', title: 'Dưới 1,5 Triệu VNĐ', desc: 'Tối ưu ngân sách, các dòng vợt bền dẻo dai trợ lực tốt của Kumpoo, VNB, Apacs.' },
                  { id: 'medium', title: 'Từ 1,5 - 3 Triệu VNĐ', desc: 'Sở hữu các dòng vợt trung cấp có vật liệu carbon tốt hơn, độ đầm tay cao.' },
                  { id: 'high', title: 'Trên 3 Triệu VNĐ (Cao Cấp)', desc: 'Các dòng vợt flagship Yonex JP, Lining cao cấp với công nghệ carbon hàng không.' }
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect('budget', opt.id)}
                    className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${answers.budget === opt.id ? 'bg-brand-primary/10 border-brand-primary text-white' : 'bg-gray-850 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}`}
                  >
                    <h4 className="font-bold text-base mb-1.5 flex items-center gap-2">
                      <DollarSign className={`w-4 h-4 ${answers.budget === opt.id ? 'text-brand-primary' : 'text-gray-400'}`} />
                      {opt.title}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <button
                  onClick={prevStep}
                  className="border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full transition"
                >
                  Quay lại
                </button>
                <button
                  disabled={!answers.budget}
                  onClick={handleCalculate}
                  className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider px-8 py-2.5 rounded-full flex items-center gap-1.5 transition "
                >
                  Xem đề xuất &rarr;
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Recommendation Results */}
          {step === 4 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-emerald-400 font-bold text-sm">✓ Phân tích hoàn tất! Dưới đây là 3 cây vợt tối ưu nhất dành cho bạn:</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {recommendations.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/product/${p.id}`)}
                    className="bg-gray-850 border border-gray-800 hover:border-brand-primary/50 rounded-xl p-4 cursor-pointer transition-all duration-300 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-square bg-gray-900 rounded-lg p-2 flex items-center justify-center overflow-hidden mb-3">
                        <img src={p.image} alt={p.name} className="max-h-full object-contain group-hover:scale-105 transition duration-300" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-brand-primary block mb-1 uppercase tracking-wider">{p.brand}</span>
                      <h4 className="font-bold text-sm text-white group-hover:text-brand-primary transition line-clamp-2 leading-snug">{p.name}</h4>
                      
                      {/* Specs indicator in result */}
                      <div className="mt-3 space-y-1 text-[11px] text-gray-400 font-mono">
                        <p>• Trọng lượng: <span className="text-white font-bold">{p.specs.weight}</span></p>
                        <p>• Điểm cân bằng: <span className="text-white font-bold">{p.specs.balance}mm</span></p>
                        <p>• Độ cứng đũa: <span className="text-white font-bold">{p.specs.stiffness}</span></p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-brand-primary font-display">{(p.salePrice || p.price).toLocaleString('vi-VN')}đ</span>
                      <span className="text-[10px] bg-brand-primary/20 text-brand-primary font-bold px-2 py-0.5 rounded-full uppercase">Xem ngay &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={handleReset}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-4 h-4" /> Làm lại khảo sát
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
