import React from 'react';
import { Check, Star } from 'lucide-react';
import { Product } from '../../types';

export type DetailTab = 'details' | 'tech' | 'reviews';

interface ProductDetailTabsProps {
  product: Product;
  isRacket: boolean;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}

export default function ProductDetailTabs({ product, isRacket, activeTab, onTabChange }: ProductDetailTabsProps) {
  const technicalAttributes = product.attributes || [];

  return (
    <div className="mt-14 border-t border-gray-100 pt-10">
      <div className="flex border-b border-gray-200">
        {[
          { id: 'details', label: 'Mô tả thực tế & Cảm nhận' },
          { id: 'tech', label: isRacket ? 'Bảng Điều Khiển Kỹ Thuật (Dashboard)' : 'Thông số kỹ thuật' },
          { id: 'reviews', label: `Đánh giá tay vợt (${product.reviews.length || 2})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as DetailTab)}
            className={`pb-3 px-4 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="py-6 min-h-[250px]">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4 text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900 text-base">Cảm giác đánh thực tế & Phân tích chuyên sâu:</p>
              <p>{product.description}</p>
              <div className="space-y-2 mt-4">
                <p className="font-bold text-gray-900 text-xs uppercase text-brand-primary">Điểm nổi bật:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  {product.features?.map((feature, index) => (
                    <li key={index}>{feature}</li>
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
                    <strong className="text-gray-900">
                      {product.specs.maxTension} Lbs ({Math.round((product.specs.maxTension / 2.20462) * 10) / 10} Kg)
                    </strong>
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
                  {technicalAttributes.length > 0 ? (
                    technicalAttributes.map((attribute) => (
                      <div key={attribute.id} className="flex justify-between border-b border-gray-100 pb-1.5 gap-3">
                        <span>{attribute.name}:</span>
                        <strong className="text-gray-900 text-right">{attribute.value}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Sản phẩm chưa có thông số kỹ thuật chi tiết.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="space-y-8 animate-in fade-in-30">
            {isRacket ? (
              <div className="bg-gray-950 text-white rounded-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-4 gap-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl" />

                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Trọng lượng (Weight)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-brand-primary"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset={product.category === 'Vợt' ? '100' : '180'}
                      />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.weight.split(' ')[0]}</div>
                  </div>
                  <p className="text-xs text-gray-400">{product.specs.weight}</p>
                </div>

                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Điểm Cân Bằng (Balance)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-brand-primary"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset={product.specs.balance > 295 ? '50' : '150'}
                      />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.balance}mm</div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {product.specs.balance === 0
                      ? 'Tiêu chuẩn'
                      : product.specs.balance > 295
                        ? 'Nặng đầu (Tấn Công)'
                        : product.specs.balance < 285
                          ? 'Nhẹ đầu (Tốc độ)'
                          : 'Cân bằng (Toàn diện)'}
                  </p>
                </div>

                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Độ Cứng Thân (Stiffness)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-brand-primary"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset={product.specs.stiffness.includes('Cứng') ? '60' : '170'}
                      />
                    </svg>
                    <div className="absolute font-sans text-[10px] font-bold text-white text-center px-2 truncate leading-none">
                      {product.specs.stiffness.split(' ')[0]}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{product.specs.stiffness}</p>
                </div>

                <div className="text-center p-4 bg-gray-900 rounded-xl border border-gray-800 space-y-3">
                  <p className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Sức Căng Khung (Max Tension)</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" className="stroke-gray-800" strokeWidth="6" fill="transparent" />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-brand-primary"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset="80"
                      />
                    </svg>
                    <div className="absolute font-mono text-sm font-bold text-white">{product.specs.maxTension} Lbs</div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {product.specs.maxTension === 0
                      ? 'Tiêu chuẩn'
                      : `Lên tới ~ ${Math.round((product.specs.maxTension / 2.20462) * 10) / 10} Kg`}
                  </p>
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
                        {technicalAttributes.map((attribute) => (
                          <tr key={attribute.id} className="border-b border-gray-50">
                            <td className="py-2 pr-3 text-gray-600">{attribute.name}</td>
                            <td className="py-2 font-semibold text-gray-900">{attribute.value}</td>
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

            {product.technologies && product.technologies.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-display font-extrabold text-sm uppercase text-gray-900">
                  Bản đồ công nghệ độc quyền (Technology Mapping)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {product.technologies.map((technology, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-brand-light/20 transition duration-200"
                    >
                      <span className="text-[10px] bg-brand-light text-brand-primary font-bold px-2.5 py-1 rounded-sm uppercase tracking-widest block w-max mb-2">
                        {technology.name}
                      </span>
                      <p className="text-xs text-gray-600 leading-normal">{technology.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
                {product.reviews.map((review, index) => (
                  <div key={index} className="py-5 flex gap-4">
                    <img
                      src={
                        review.avatar ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
                      }
                      alt={review.author}
                      className="w-10 h-10 object-cover rounded-full bg-gray-100"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm text-gray-900">{review.author}</strong>
                        <span className="text-[11px] text-gray-400 font-mono">{review.date}</span>
                      </div>

                      <div className="flex text-amber-400 gap-0.5">
                        {Array.from({ length: review.rating }).map((_, ratingIndex) => (
                          <Star key={ratingIndex} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>

                      <p className="text-xs text-gray-700 leading-relaxed">{review.comment}</p>

                      {review.verified && (
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
  );
}
