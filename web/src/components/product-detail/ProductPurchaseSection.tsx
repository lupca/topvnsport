import React from 'react';
import { ArrowLeft, Phone, ShoppingCart, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Product, StringOption, TierVariation } from '../../types';
import StringingAssistant from './StringingAssistant';

interface ProductPurchaseSectionProps {
  product: Product;
  isRacket: boolean;
  totalDisplayPrice: number;
  displayOriginalPrice: number;
  stringPrice: number;
  selectedTier1: string;
  selectedTier2: string;
  selectedWeight: string;
  selectedColor: string;
  withStringing: boolean;
  selectedString: StringOption | null;
  tension: number;
  stringOptions: StringOption[];
  hasStringingVariation: boolean;
  stringingVariation?: TierVariation;
  stringingTierIndex?: number;
  isDynamicStringingActive: boolean;
  activeStringValue: string;
  isOutOfStock: boolean;
  onSetSelectedTier1: (value: string) => void;
  onSetSelectedTier2: (value: string) => void;
  onSetSelectedWeight: (value: string) => void;
  onSetSelectedColor: (value: string) => void;
  onSetWithStringing: (value: boolean) => void;
  onSetSelectedString: (value: StringOption | null) => void;
  onSetTension: (value: number) => void;
  onAddToCart: () => void;
  getVariantStock: (tier1: string, tier2: string) => number;
}

export default function ProductPurchaseSection({
  product,
  isRacket,
  totalDisplayPrice,
  displayOriginalPrice,
  stringPrice,
  selectedTier1,
  selectedTier2,
  selectedWeight,
  selectedColor,
  withStringing,
  selectedString,
  tension,
  stringOptions,
  hasStringingVariation,
  stringingVariation,
  stringingTierIndex,
  isDynamicStringingActive,
  activeStringValue,
  isOutOfStock,
  onSetSelectedTier1,
  onSetSelectedTier2,
  onSetSelectedWeight,
  onSetSelectedColor,
  onSetWithStringing,
  onSetSelectedString,
  onSetTension,
  onAddToCart,
  getVariantStock
}: ProductPurchaseSectionProps) {
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary font-medium mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại danh mục sản phẩm
      </button>

      <div className="space-y-6">
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

          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-4.5 h-4.5 fill-current" />
              ))}
            </div>
            <span className="text-gray-500 font-medium">({product.reviews.length || 3} đánh giá từ các tay vợt)</span>
          </div>
        </div>

        <div className="bg-brand-light/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Giá bán hiện tại</p>
            <div className="flex items-end gap-2.5 mt-1">
              <span className="text-2xl md:text-3xl font-extrabold text-brand-primary font-display">
                {totalDisplayPrice.toLocaleString('vi-VN')}đ
              </span>
              {product.salePrice && (
                <span className="text-sm text-gray-400 line-through mb-1.5 font-medium">
                  {(displayOriginalPrice + stringPrice).toLocaleString('vi-VN')}đ
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

        {product.tier_variations && product.tier_variations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {product.tier_variations
              .filter((tier) => tier.name !== 'Loại cước')
              .map((tier) => {
                const selectedValue = tier.tier_index === 1 ? selectedTier1 : selectedTier2;
                const setValue = tier.tier_index === 1 ? onSetSelectedTier1 : onSetSelectedTier2;
                const otherTierValue = tier.tier_index === 1 ? selectedTier2 : selectedTier1;

                return (
                  <div key={tier.tier_index}>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">{tier.name}</label>
                    <div className="flex flex-wrap gap-2">
                      {tier.options.map((option) => {
                        const stockForOption = tier.tier_index === 1
                          ? getVariantStock(option, otherTierValue)
                          : getVariantStock(otherTierValue, option);
                        const optionOutOfStock = stockForOption <= 0;

                        return (
                          <button
                            key={option}
                            onClick={() => !optionOutOfStock && setValue(option)}
                            disabled={optionOutOfStock}
                            className={`relative text-xs px-3.5 py-2 rounded-lg border font-bold transition ${
                              optionOutOfStock
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 line-through'
                                : selectedValue === option
                                  ? 'bg-brand-primary border-brand-primary text-white shadow-md'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {option}
                            {optionOutOfStock && (
                              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-sm font-bold">
                                Hết
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isRacket && (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Trọng lượng / Cán cầm</label>
                <div className="flex gap-2">
                  {['4U/G5', '3U/G5', '5U/G5'].map((weight) => (
                    <button
                      key={weight}
                      onClick={() => onSetSelectedWeight(weight)}
                      className={`text-xs px-3.5 py-2 rounded-lg border font-bold transition ${
                        selectedWeight === weight
                          ? 'bg-brand-primary border-brand-primary text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {weight}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Phối màu / Phiên bản</label>
                <div className="flex gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => onSetSelectedColor(color)}
                      className={`text-xs px-3.5 py-2 rounded-lg border font-bold transition ${
                        selectedColor === color
                          ? 'bg-brand-primary border-brand-primary text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <StringingAssistant
          product={product}
          isRacket={isRacket}
          hasStringingVariation={hasStringingVariation}
          stringingVariation={stringingVariation}
          stringingTierIndex={stringingTierIndex}
          isDynamicStringingActive={isDynamicStringingActive}
          activeStringValue={activeStringValue}
          selectedTier1={selectedTier1}
          selectedTier2={selectedTier2}
          withStringing={withStringing}
          selectedString={selectedString}
          stringOptions={stringOptions}
          tension={tension}
          onSetSelectedTier1={onSetSelectedTier1}
          onSetSelectedTier2={onSetSelectedTier2}
          onSetWithStringing={onSetWithStringing}
          onSetSelectedString={onSetSelectedString}
          onSetTension={onSetTension}
        />

        {isOutOfStock && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <span className="text-red-600 font-semibold text-sm">
              Sản phẩm này tạm hết hàng
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={onAddToCart}
            disabled={isOutOfStock}
            className={`flex-1 rounded-sm px-6 py-3 uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-sm transition ${
              isOutOfStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            <ShoppingCart className="w-4.5 h-4.5" />
            {isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
          </button>

          <button
            onClick={() => navigate('/stores')}
            className="btn-outline rounded-sm py-3.5 px-6 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Phone className="w-4.5 h-4.5" /> Trải nghiệm tại cửa hàng
          </button>
        </div>
      </div>
    </>
  );
}
