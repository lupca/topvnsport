import React, { useState, useEffect } from 'react';
import { Product, StringOption } from '../types';
import { motion } from 'motion/react';
import { Star, ShoppingCart, ShieldCheck, Heart, Sparkles, Check, Phone, ArrowLeft, Trophy, Calendar, MapPin, Gauge } from 'lucide-react';

interface ProductDetailPageProps {
  product: Product;
  stringOptions: StringOption[];
  onAddToCartWithSpecs: (product: Product, selectedWeight: string, selectedColor: string, stringChoice: StringOption | null, tension: number) => void;
  onBackToCatalog: () => void;
  onBookTestAtStore: (branchId: string) => void;
}

export default function ProductDetailPage({ product, stringOptions, onAddToCartWithSpecs, onBackToCatalog, onBookTestAtStore }: ProductDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'tech' | 'reviews'>('details');
  const [selectedImage, setSelectedImage] = useState(product.image);
  
  // Custom Variants Configuration
  const [selectedWeight, setSelectedWeight] = useState(
    product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn'
  );
  const [selectedColor, setSelectedColor] = useState(
    product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn'
  );

  // Virtual Stringing Assistant States
  const [withStringing, setWithStringing] = useState(false);
  const [selectedString, setSelectedString] = useState<StringOption | null>(null);
  const [tension, setTension] = useState(10.5); // Default tension in kg (approx 23 lbs)
  const isRacket = product.category === 'Vợt';
  const technicalAttributes = product.attributes || [];

  useEffect(() => {
    setSelectedImage(product.image);
    // Reset stringing states
    setWithStringing(false);
    setSelectedString(null);
    setTension(10.5);
  }, [product]);

  // Pricing math
  const displayBasePrice = product.salePrice || product.price;
  const stringPrice = withStringing && selectedString ? selectedString.price : 0;
  const totalDisplayPrice = displayBasePrice + stringPrice;

  // Custom tooltips & alerts for the Interactive Tension Slider
  const getTensionTooltip = (kg: number) => {
    if (kg < 10) return 'Mức căng nhẹ (9 - 9.5 kg): Phù hợp tuyệt đối với người mới tập, trẻ em, phụ nữ lực tay nhẹ, ưu tiên trợ lực tối đa.';
    if (kg >= 10 && kg <= 11) return 'Mức căng trung bình (10 - 11 kg): Khuyên dùng cho người chơi phong trào lâu năm, kỹ thuật khá, cân bằng trợ lực và kiểm soát.';
    return 'Mức căng cao chuyên nghiệp (11.5 - 13 kg+): Dành riêng cho tay vợt bán chuyên/chuyên nghiệp, lực cổ tay cực khỏe, kiểm soát cầu chính xác 100% nhưng hoàn toàn không trợ lực.';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 animate-in fade-in duration-300" id="product-detail-page">
      {/* Breadcrumb / Back button */}
      <button
        onClick={onBackToCatalog}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary font-medium mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại danh mục sản phẩm
      </button>

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Media Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 flex items-center justify-center relative aspect-square group overflow-hidden shadow-xs">
            <img
              src={selectedImage}
              alt={product.name}
              className="max-h-full max-w-full object-contain transition duration-500 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
          
          {/* Gallery Thumbnails */}
          {product.gallery && product.gallery.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedImage(product.image)}
                className={`w-16 h-16 p-1 bg-white rounded-lg border flex items-center justify-center overflow-hidden shrink-0 transition-all ${selectedImage === product.image ? 'border-brand-primary ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <img src={product.image} alt={product.name} className="max-h-full object-contain" referrerPolicy="no-referrer" />
              </button>
              {product.gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 p-1 bg-white rounded-lg border flex items-center justify-center overflow-hidden shrink-0 transition-all ${selectedImage === img ? 'border-brand-primary ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <img src={img} alt={`${product.name} gallery ${i}`} className="max-h-full object-contain" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}

          {/* Core Trust Seals Panel */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Cam kết chính hãng 100%</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand-primary shrink-0" />
              <span>Bảo hành lưới gãy 90 ngày</span>
            </div>
          </div>
        </div>

        {/* Right Column: Information, Specs, Assistants (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Title and Badge block */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] bg-brand-primary text-white font-extrabold uppercase px-2 py-0.5 rounded-sm shadow-xs">
                {product.brand}
              </span>
              {product.badge && (
                <span className="text-[10px] bg-purple-600 text-white font-extrabold uppercase px-2 py-0.5 rounded-sm">
                  {product.badge}
                </span>
              )}
              {product.characteristics && (
                <span className="text-[10px] bg-gray-900 text-yellow-400 font-extrabold uppercase px-2 py-0.5 rounded-sm border border-yellow-400">
                  {product.characteristics}
                </span>
              )}
            </div>
            
            <h1 className="font-display font-black text-xl md:text-3xl text-gray-900 tracking-tight leading-snug">
              {product.name}
            </h1>
            
            {/* Reviews summary */}
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="w-4.5 h-4.5 fill-current" />
                ))}
              </div>
              <span className="text-gray-500 font-medium">({product.reviews.length || 3} đánh giá từ các tay vợt)</span>
            </div>
          </div>

          {/* Price Segment */}
          <div className="bg-brand-light/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Giá bán hiện tại</p>
              <div className="flex items-end gap-2.5 mt-1">
                <span className="text-2xl md:text-3xl font-extrabold text-brand-primary font-display">
                  {totalDisplayPrice.toLocaleString('vi-VN')}đ
                </span>
                {product.salePrice && (
                  <span className="text-sm text-gray-400 line-through mb-1.5 font-medium">
                    {(product.price + stringPrice).toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </div>
            {product.salePrice && (
              <span className="bg-brand-primary text-white text-[11px] font-black px-3 py-1.5 rounded-full">
                TIẾT KIỆM {Math.round(((product.price - product.salePrice) / product.price) * 100)}%
              </span>
            )}
          </div>

          {/* Racket Attributes Selection (Weight/Color) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Weight select */}
            {isRacket && (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Trọng lượng / Cán cầm</label>
                <div className="flex gap-2">
                  {['4U/G5', '3U/G5', '5U/G5'].map(wt => (
                    <button
                      key={wt}
                      onClick={() => setSelectedWeight(wt)}
                      className={`text-xs px-3.5 py-2 rounded-lg border font-bold transition ${selectedWeight === wt ? 'bg-brand-primary border-brand-primary text-white shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors Select */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Phối màu / Phiên bản</label>
                <div className="flex gap-2">
                  {product.colors.map(col => (
                    <button
                      key={col}
                      onClick={() => setSelectedColor(col)}
                      className={`text-xs px-3.5 py-2 rounded-lg border font-bold transition ${selectedColor === col ? 'bg-brand-primary border-brand-primary text-white shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VIRTUAL STRINGING ASSISTANT (Add-on UI Logic) */}
          {isRacket && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-primary" />
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 uppercase">Dịch vụ đan cước chuyên nghiệp</h3>
                    <p className="text-[11px] text-gray-400">Chọn cước và lực căng tùy biến theo trình độ</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withStringing}
                    onChange={(e) => {
                      setWithStringing(e.target.checked);
                      if (e.target.checked && !selectedString) {
                        setSelectedString(stringOptions[0]);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>

              {withStringing && (
                <div className="space-y-4 animate-in slide-in-from-top-3 duration-200">
                  {/* Step 1: Select String */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase text-gray-500">Bước 1: Chọn mẫu dây cước</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {stringOptions.map((str) => (
                        <div
                          key={str.id}
                          onClick={() => setSelectedString(str)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${selectedString?.id === str.id ? 'bg-brand-light/50 border-brand-primary' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                        >
                          <div>
                            <p className="font-bold text-xs text-gray-900">{str.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{str.type} • Ø {str.thickness}</p>
                          </div>
                          <span className="text-xs font-extrabold text-brand-primary">+{str.price.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Tension slider with safe alerts */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase text-gray-500">Bước 2: Chọn lực căng (Số Kg/Lbs)</label>
                      <span className="text-base font-extrabold text-brand-primary font-mono">
                        {tension.toFixed(1)} kg
                      </span>
                    </div>

                    <input
                      type="range"
                      min="9"
                      max="13"
                      step="0.5"
                      value={tension}
                      onChange={(e) => setTension(parseFloat(e.target.value))}
                      className="w-full accent-brand-primary cursor-pointer h-1.5 bg-gray-100 rounded-lg appearance-none"
                    />

                    {/* Safe ranges visual indicators */}
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono px-1">
                      <span>9 kg (Học sinh)</span>
                      <span>10.5 kg (Mức căng phổ thông)</span>
                      <span>13 kg (VĐV Chuyên nghiệp)</span>
                    </div>

                    {/* Contextual description tooltip based on selected tension */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-[11px] text-gray-600 leading-relaxed flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                      <span>{getTensionTooltip(tension)}</span>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons (Add to cart & Book at store) */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={() => {
                onAddToCartWithSpecs(product, selectedWeight, selectedColor, withStringing ? selectedString : null, tension);
              }}
              className="flex-1 btn-primary rounded-sm px-6 py-3 uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <ShoppingCart className="w-4.5 h-4.5" /> Thêm vào giỏ hàng
            </button>

            <button
              onClick={() => onBookTestAtStore(product.id)}
              className="btn-outline rounded-sm py-3.5 px-6 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Phone className="w-4.5 h-4.5" /> Trải nghiệm tại cửa hàng
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Layout for Technical Dashboard & Reviews */}
      <div className="mt-14 border-t border-gray-100 pt-10">
        <div className="flex border-b border-gray-200">
            {[
            { id: 'details', label: 'Mô tả thực tế & Cảm nhận' },
            { id: 'tech', label: isRacket ? 'Bảng Điều Khiển Kỹ Thuật (Dashboard)' : 'Thông số kỹ thuật' },
            { id: 'reviews', label: `Đánh giá tay vợt (${product.reviews.length || 2})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition ${activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content area */}
        <div className="py-6 min-h-[250px]">
          
          {/* TAB 1: General Descriptions */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-4 text-sm text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900 text-base">Cảm giác đánh thực tế & Phân tích chuyên sâu:</p>
                <p>{product.description}</p>
                <div className="space-y-2 mt-4">
                  <p className="font-bold text-gray-900 text-xs uppercase text-brand-primary">Điểm nổi bật:</p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {product.features?.map((ft, i) => (
                      <li key={i}>{ft}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="lg:col-span-4 bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-4 text-brand-primary">Thông số cơ bản:</h4>
                {isRacket ? (
                  <div className="space-y-2.5 text-xs text-gray-600 font-mono">
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span>Trọng lượng:</span>
                      <strong className="text-gray-900">{product.specs.weight}</strong>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span>Độ cứng đũa:</span>
                      <strong className="text-gray-900">{product.specs.stiffness}</strong>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span>Điểm cân bằng:</span>
                      <strong className="text-gray-900">{product.specs.balance} mm</strong>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span>Sức căng tối đa:</span>
                      <strong className="text-gray-900">{product.specs.maxTension} Lbs ({Math.round(product.specs.maxTension / 2.20462 * 10) / 10} Kg)</strong>
                    </div>
                    {product.specs.swingWeight && (
                      <div className="flex justify-between border-b border-gray-100 pb-1.5">
                        <span>Swing Weight:</span>
                        <strong className="text-gray-900">{product.specs.swingWeight} kg/cm²</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs text-gray-600">
                    {technicalAttributes.length > 0 ? technicalAttributes.map(attr => (
                      <div key={attr.id} className="flex justify-between border-b border-gray-100 pb-1.5 gap-3">
                        <span>{attr.name}:</span>
                        <strong className="text-gray-900 text-right">{attr.value}</strong>
                      </div>
                    )) : (
                      <p className="text-gray-500">Sản phẩm chưa có thông số kỹ thuật chi tiết.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL DASHBOARD (Gauges/Meters visualization) */}
          {activeTab === 'tech' && (
            <div className="space-y-8 animate-in fade-in-30">
              {isRacket ? (
              <div className="bg-gray-950 text-white rounded-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-4 gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl" />
                
                {/* Gauge 1: Weight */}
                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Trọng lượng (Weight)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-brand-primary" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset={product.category === 'Vợt' ? "100" : "180"} />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.weight.split(' ')[0]}</div>
                  </div>
                  <p className="text-xs text-gray-400">{product.specs.weight}</p>
                </div>

                {/* Gauge 2: Balance Point */}
                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Điểm Cân Bằng (Balance)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-brand-primary" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset={product.specs.balance > 295 ? "50" : "150"} />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.balance}mm</div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {product.specs.balance === 0 ? 'Tiêu chuẩn' : product.specs.balance > 295 ? 'Nặng đầu (Tấn Công)' : product.specs.balance < 285 ? 'Nhẹ đầu (Tốc độ)' : 'Cân bằng (Toàn diện)'}
                  </p>
                </div>

                {/* Gauge 3: Shaft Stiffness */}
                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Độ Cứng Thân (Stiffness)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-brand-primary" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset={product.specs.stiffness.includes('Cứng') ? "60" : "170"} />
                    </svg>
                    <div className="absolute font-sans text-[10px] font-bold text-white text-center px-2 truncate leading-none">{product.specs.stiffness.split(' ')[0]}</div>
                  </div>
                  <p className="text-xs text-gray-400">{product.specs.stiffness}</p>
                </div>

                {/* Gauge 4: Swing weight / Tension */}
                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Sức Căng Khung (Max Tension)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle cx="48" cy="48" r="40" className="stroke-brand-primary" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset="80" />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.maxTension} Lbs</div>
                  </div>
                  <p className="text-xs text-gray-400">{product.specs.maxTension === 0 ? 'Tiêu chuẩn' : `Lên tới ~ ${Math.round(product.specs.maxTension / 2.20462 * 10) / 10} Kg`}</p>
                </div>
              </div>
              ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h4 className="font-display font-extrabold text-sm uppercase text-gray-900 mb-4">Thông số cơ bản</h4>
                {technicalAttributes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase">
                          <th className="py-2 pr-3">Thuộc tính</th>
                          <th className="py-2">Giá trị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {technicalAttributes.map(attr => (
                          <tr key={attr.id} className="border-b border-gray-50">
                            <td className="py-2 pr-3 text-gray-600">{attr.name}</td>
                            <td className="py-2 font-semibold text-gray-900">{attr.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sản phẩm chưa có thông số kỹ thuật chi tiết.</p>
                )}
              </div>
              )}

              {/* Technologies logos list with explanations */}
              {product.technologies && product.technologies.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-display font-extrabold text-sm uppercase text-gray-900">Bản đồ công nghệ độc quyền (Technology Mapping)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {product.technologies.map((tech, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-brand-light/20 transition duration-200">
                        <span className="text-[10px] bg-brand-light text-brand-primary font-bold px-2.5 py-1 rounded-sm uppercase tracking-widest block w-max mb-2">{tech.name}</span>
                        <p className="text-xs text-gray-600 leading-normal">{tech.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOMER REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 gap-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-base">Phản hồi từ khách hàng thực tế</h4>
                  <p className="text-xs text-gray-500">Được kiểm chứng mua hàng bởi hóa đơn hệ thống cửa hàng</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs font-semibold">
                  <Check className="w-4 h-4 text-emerald-500" /> 100% Đánh giá chính xác từ người dùng thật
                </div>
              </div>

              {product.reviews && product.reviews.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {product.reviews.map((rev, idx) => (
                    <div key={idx} className="py-5 flex gap-4">
                      <img
                        src={rev.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                        alt={rev.author}
                        className="w-10 h-10 object-cover rounded-full bg-gray-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-gray-900">{rev.author}</strong>
                          <span className="text-[11px] text-gray-400 font-mono">{rev.date}</span>
                        </div>
                        
                        {/* Rating stars */}
                        <div className="flex text-amber-400 gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>

                        <p className="text-xs text-gray-700 leading-relaxed">{rev.comment}</p>
                        
                        {rev.verified && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                            ✓ Đã mua hàng tại TopVNSport
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 text-sm">Chưa có đánh giá nào cho cây vợt này. Hãy là người đầu tiên trải nghiệm!</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* STICKY BOTTOM PURCHASE BAR FOR MOBILE */}
      <div className="fixed bottom-[57px] left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-sm p-3 flex items-center justify-between gap-3 md:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <img src={product.image} alt={product.name} className="w-10 h-10 object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-gray-900 truncate">{product.name}</h4>
            <p className="text-brand-primary font-bold text-xs font-mono">{(product.salePrice || product.price).toLocaleString('vi-VN')}đ</p>
          </div>
        </div>
        <button
          onClick={async () => {
            onAddToCartWithSpecs(product, selectedWeight, selectedColor, withStringing ? selectedString : null, tension);
          }}
          className="btn-primary text-xs px-4 py-2.5 rounded-sm flex items-center gap-1.5 shrink-0 shadow-sm"
        >
          <ShoppingCart className="w-4 h-4" /> Mua ngay
        </button>
      </div>
    </div>
  );
}
