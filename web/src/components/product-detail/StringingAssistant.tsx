import React from 'react';
import { Sparkles } from 'lucide-react';
import { Product, StringOption, TierVariation } from '../../types';
import { getTensionTooltip, inferStringMeta, isNoStringOption } from './helpers';

interface StringingAssistantProps {
  product: Product;
  isRacket: boolean;
  hasStringingVariation: boolean;
  stringingVariation?: TierVariation;
  stringingTierIndex?: number;
  isDynamicStringingActive: boolean;
  activeStringValue: string;
  selectedTier1: string;
  selectedTier2: string;
  withStringing: boolean;
  selectedString: StringOption | null;
  stringOptions: StringOption[];
  tension: number;
  onSetSelectedTier1: (value: string) => void;
  onSetSelectedTier2: (value: string) => void;
  onSetWithStringing: (value: boolean) => void;
  onSetSelectedString: (value: StringOption | null) => void;
  onSetTension: (value: number) => void;
}

export default function StringingAssistant({
  product,
  isRacket,
  hasStringingVariation,
  stringingVariation,
  stringingTierIndex,
  isDynamicStringingActive,
  activeStringValue,
  selectedTier1,
  selectedTier2,
  withStringing,
  selectedString,
  stringOptions,
  tension,
  onSetSelectedTier1,
  onSetSelectedTier2,
  onSetWithStringing,
  onSetSelectedString,
  onSetTension
}: StringingAssistantProps) {
  if (!hasStringingVariation && !isRacket) {
    return null;
  }

  const isEnabled = hasStringingVariation ? isDynamicStringingActive : withStringing;

  const resolveVariantPrice = (targetOption: string): number => {
    if (!stringingVariation || !stringingTierIndex) {
      return product.salePrice || product.price;
    }

    const matched = product.variants?.find((variant) => {
      const tier1Match = stringingTierIndex !== 1 || variant.tier_1_option === targetOption;
      const tier2Match = stringingTierIndex !== 2 || variant.tier_2_option === targetOption;

      const otherTierIndex = stringingTierIndex === 1 ? 2 : 1;
      const otherSelected = otherTierIndex === 1 ? selectedTier1 : selectedTier2;
      const hasOtherTier = product.tier_variations?.some((tier) => tier.tier_index === otherTierIndex);
      const otherMatch =
        !hasOtherTier ||
        (otherTierIndex === 1
          ? variant.tier_1_option === otherSelected
          : variant.tier_2_option === otherSelected);

      return tier1Match && tier2Match && otherMatch;
    });

    return matched ? matched.price : product.salePrice || product.price;
  };

  return (
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
            checked={isEnabled}
            onChange={(event) => {
              const checked = event.target.checked;

              if (!hasStringingVariation) {
                onSetWithStringing(checked);
                if (checked && !selectedString) {
                  onSetSelectedString(stringOptions[0] || null);
                }
                return;
              }

              if (!stringingVariation || !stringingTierIndex) {
                return;
              }

              const validOption =
                stringingVariation.options.find((option) => !isNoStringOption(option)) ||
                stringingVariation.options[0];
              const noStringOption =
                stringingVariation.options.find((option) => isNoStringOption(option)) ||
                stringingVariation.options[0];
              const targetOption = checked ? validOption : noStringOption;

              if (!targetOption) {
                return;
              }

              if (stringingTierIndex === 1) {
                onSetSelectedTier1(targetOption);
              } else {
                onSetSelectedTier2(targetOption);
              }
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary" />
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-4 animate-in slide-in-from-top-3 duration-200">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase text-gray-500">Bước 1: Chọn mẫu dây cước</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {hasStringingVariation && stringingVariation ? (
                stringingVariation.options
                  .filter((option) => !isNoStringOption(option))
                  .map((optionName) => {
                    const noStringOption = stringingVariation.options.find((option) => isNoStringOption(option));
                    const noStringPrice = noStringOption
                      ? resolveVariantPrice(noStringOption)
                      : product.salePrice || product.price;
                    const optionPrice = resolveVariantPrice(optionName);
                    const diffPrice = optionPrice - noStringPrice;
                    const metadata = inferStringMeta(optionName, stringOptions);
                    const isSelected = activeStringValue === optionName;

                    return (
                      <div
                        key={optionName}
                        onClick={() => {
                          if (stringingTierIndex === 1) {
                            onSetSelectedTier1(optionName);
                          } else {
                            onSetSelectedTier2(optionName);
                          }
                        }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                          isSelected
                            ? 'bg-brand-light/50 border-brand-primary'
                            : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-gray-900">{optionName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {metadata.type} • Ø {metadata.thickness}
                          </p>
                        </div>
                        <span className="text-xs font-extrabold text-brand-primary">
                          {diffPrice > 0 ? `+${diffPrice.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                        </span>
                      </div>
                    );
                  })
              ) : (
                stringOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => onSetSelectedString(option)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                      selectedString?.id === option.id
                        ? 'bg-brand-light/50 border-brand-primary'
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-gray-900">{option.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {option.type} • Ø {option.thickness}
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-brand-primary">
                      +{option.price.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-gray-500">Bước 2: Chọn lực căng (Số Kg/Lbs)</label>
              <span className="text-base font-extrabold text-brand-primary font-mono">{tension.toFixed(1)} kg</span>
            </div>

            <input
              type="range"
              min="9"
              max="13"
              step="0.5"
              value={tension}
              onChange={(event) => onSetTension(parseFloat(event.target.value))}
              className="w-full accent-brand-primary cursor-pointer h-1.5 bg-gray-100 rounded-lg appearance-none"
            />

            <div className="flex justify-between text-[10px] text-gray-400 font-mono px-1">
              <span>9 kg (Học sinh)</span>
              <span>10.5 kg (Mức căng phổ thông)</span>
              <span>13 kg (VĐV Chuyên nghiệp)</span>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-[11px] text-gray-600 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              <span>{getTensionTooltip(tension)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
