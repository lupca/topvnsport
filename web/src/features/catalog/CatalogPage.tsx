import { RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import { Product } from '../../types';

type CatalogPageProps = {
  products: Product[];
  filteredProducts: Product[];
  searchQuery: string;
  selectedBrand: string[];
  selectedCategory: string;
  maxPrice: number;
  selectedWeight: string[];
  selectedBalance: string;
  selectedStiffness: string;
  onSearchQueryChange: (value: string) => void;
  onSelectedCategoryChange: (value: string) => void;
  onSelectedBalanceChange: (value: string) => void;
  onSelectedStiffnessChange: (value: string) => void;
  onSelectedWeightChange: (updater: (prev: string[]) => string[]) => void;
  onSelectedBrandChange: (updater: (prev: string[]) => string[]) => void;
  onMaxPriceChange: (value: number) => void;
  onResetFilters: () => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, e?: React.MouseEvent) => void;
};

export default function CatalogPage({
  products,
  filteredProducts,
  searchQuery,
  selectedBrand,
  selectedCategory,
  maxPrice,
  selectedWeight,
  selectedBalance,
  selectedStiffness,
  onSearchQueryChange,
  onSelectedCategoryChange,
  onSelectedBalanceChange,
  onSelectedStiffnessChange,
  onSelectedWeightChange,
  onSelectedBrandChange,
  onMaxPriceChange,
  onResetFilters,
  onQuickView,
  onAddToCart
}: CatalogPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-300">
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
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-5 sticky top-24">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-brand-primary" /> Bộ lọc sản phẩm
              </span>
              <button
                onClick={onResetFilters}
                className="text-[11px] text-gray-400 hover:text-brand-primary font-bold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Xóa bộ lọc
              </button>
            </div>

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
                          onSelectedBrandChange(prev => [...prev, brand]);
                        } else {
                          onSelectedBrandChange(prev => prev.filter(b => b !== brand));
                        }
                      }}
                      className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary/40"
                    />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Phân loại sản phẩm</h4>
              <div className="space-y-1.5 flex flex-col">
                {['Tất cả', ...Array.from(new Set(products.map(p => p.category)))].map(cat => (
                  <button
                    key={cat}
                    onClick={() => onSelectedCategoryChange(cat)}
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
                onChange={(e) => onMaxPriceChange(parseInt(e.target.value, 10))}
                className="w-full accent-brand-primary h-1 bg-gray-100 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>100Kđ</span>
                <span>6.0Mđ</span>
              </div>
            </div>

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
                            onSelectedWeightChange(prev => prev.filter(w => w !== wt));
                          } else {
                            onSelectedWeightChange(prev => [...prev, wt]);
                          }
                        }}
                        className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-md border transition ${selectedWeight.includes(wt) ? 'bg-brand-primary text-white border-brand-primary shadow-xs' : 'bg-white border-gray-150 text-gray-700 hover:bg-gray-50'}`}
                      >
                        {wt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Điểm Cân Bằng</h4>
                  <select
                    value={selectedBalance}
                    onChange={(e) => onSelectedBalanceChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-hidden focus:border-brand-primary"
                  >
                    <option value="Tất cả">Mọi điểm cân bằng</option>
                    <option value="nặng">Nặng Đầu (&gt; 298mm - Công)</option>
                    <option value="nhẹ">Nhẹ Đầu (&lt; 288mm - Thủ)</option>
                    <option value="cân bằng">Cân Bằng (288 - 298mm - Công Thủ)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-gray-500">Độ Cứng Thân (Stiffness)</h4>
                  <select
                    value={selectedStiffness}
                    onChange={(e) => onSelectedStiffnessChange(e.target.value)}
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

        <div className="lg:col-span-3 space-y-6">
          {searchQuery && (
            <div className="bg-brand-light border border-blue-100 rounded-xl p-3 flex justify-between items-center">
              <p className="text-xs text-brand-secondary">Đang tìm kết quả lọc theo từ khóa: <strong>"{searchQuery}"</strong></p>
              <button onClick={() => onSearchQueryChange('')} className="p-1 text-brand-secondary hover:bg-brand-light rounded-full"><X className="w-4 h-4" /></button>
            </div>
          )}

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onQuickView={(prod) => onQuickView(prod)}
                  onAddToCart={(prod, e) => onAddToCart(prod, e)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-gray-100 rounded-2xl p-6">
              <p className="text-gray-500 text-sm">Không tìm thấy sản phẩm nào khớp với bộ lọc của bạn.</p>
              <button onClick={onResetFilters} className="mt-4 bg-brand-primary text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-secondary transition ">
                Làm mới bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
