import React, { useEffect } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash, Upload, Loader2, HelpCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { fetchWithAuth, apiClient } from "@/utils/apiClient";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface ProductVariationsProps {
  tier1Images: Record<string, string>;
  setTier1Images: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  uploadingTier1: Record<string, boolean>;
  setUploadingTier1: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  bulkPrice: string;
  setBulkPrice: (val: string) => void;
  bulkStock: string;
  setBulkStock: (val: string) => void;
}

export default function ProductVariations({
  tier1Images,
  setTier1Images,
  uploadingTier1,
  setUploadingTier1,
  bulkPrice,
  setBulkPrice,
  bulkStock,
  setBulkStock
}: ProductVariationsProps) {
  const { control, register, watch, setValue, formState: { errors } } = useFormContext();
  const { fields: tierFields, append: appendTier, remove: removeTier, update: updateTier } = useFieldArray({
    control,
    name: "tier_variations"
  });

  const watchTiers = watch("tier_variations");
  const watchParentSku = watch("product_code");
  const watchVariants = watch("variants");

  useEffect(() => {
    tierFields.forEach((_, index) => {
      const currentTierIndex = watchTiers?.[index]?.tier_index;
      if (currentTierIndex !== index + 1) {
        setValue(`tier_variations.${index}.tier_index`, index + 1, { shouldDirty: true });
      }
    });
  }, [tierFields.length, setValue, watchTiers]);

  const handleTier1ImageUpload = async (optionName: string, file: File) => {
    setUploadingTier1(prev => ({ ...prev, [optionName]: true }));
    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await apiClient.post("/upload", formData);
      setTier1Images(prev => ({ ...prev, [optionName]: normalizeImageUrl(data.image_url) || data.image_url }));
    } catch (err) {
      console.error(err);
      void popupService.alert(`Không thể tải lên ảnh cho phân loại ${optionName}`);
    } finally {
      setUploadingTier1(prev => ({ ...prev, [optionName]: false }));
    }
  };

  const handleMassApply = () => {
    if (!watchVariants) return;

    const price = parseFloat(bulkPrice);
    const stock = parseInt(bulkStock);

    const updated = watchVariants.map((v: any) => {
      const val = { ...v };
      if (!isNaN(price)) val.price = price;
      if (!isNaN(stock)) val.stock = stock;
      return val;
    });

    setValue("variants", updated);
  };

  return (
    <div className="pim-card space-y-6">
      <div className="flex items-center justify-between border-b pb-3 border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Thông tin bán hàng</h2>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <HelpCircle className="h-4 w-4" />
          <span>Hỗ trợ tối đa 2 nhóm phân loại</span>
        </div>
      </div>

      {/* Tier Variation Creation UI */}
      <div className="space-y-6">
        {tierFields.map((field, tierIndex) => (
          <div key={field.id} className="p-6 bg-gray-50 border border-gray-200 rounded-2xl space-y-4 relative">
            <button 
              type="button" 
              onClick={() => removeTier(tierIndex)}
              className="absolute top-4 right-4 text-gray-500 hover:text-rose-500 transition-colors"
            >
              <Trash className="h-5 w-5" />
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-600">Tên nhóm phân loại {tierIndex + 1}</label>
                <input 
                  type="text" 
                  placeholder={tierIndex === 0 ? "Ví dụ: Màu sắc" : "Ví dụ: Kích cỡ"}
                  className="pim-input"
                  {...register(`tier_variations.${tierIndex}.name` as const)}
                />
                {(errors.tier_variations as any)?.[tierIndex]?.name && (
                  <p className="text-xs text-rose-500 font-medium">{(errors.tier_variations as any)[tierIndex]?.name?.message}</p>
                )}
              </div>
              
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-semibold text-gray-600">Phân loại hàng (Các tùy chọn)</label>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const currentOpts = watchTiers?.[tierIndex]?.options || [];
                    const displayOpts = currentOpts.length > 0 && currentOpts[currentOpts.length - 1] === "" 
                      ? currentOpts 
                      : [...currentOpts, ""];
                    
                    return displayOpts.map((opt: string, optIndex: number) => (
                      <div key={optIndex} className="relative w-40">
                        <input 
                          type="text" 
                          placeholder="Thêm phân loại"
                          className="pim-input pr-8"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...currentOpts];
                            newOpts[optIndex] = e.target.value;
                            setValue(`tier_variations.${tierIndex}.options`, newOpts, { shouldDirty: true, shouldValidate: true });
                            if (!watchTiers?.[tierIndex]?.tier_index) {
                               setValue(`tier_variations.${tierIndex}.tier_index`, tierIndex + 1);
                            }
                          }}
                          onBlur={() => {
                            const newOpts = (watchTiers?.[tierIndex]?.options || []).filter((o: string) => o.trim() !== "");
                            setValue(`tier_variations.${tierIndex}.options`, newOpts, { shouldDirty: true, shouldValidate: true });
                          }}
                        />
                        {opt !== "" && (
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = [...currentOpts];
                              newOpts.splice(optIndex, 1);
                              setValue(`tier_variations.${tierIndex}.options`, newOpts, { shouldDirty: true, shouldValidate: true });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ));
                  })()}
                </div>
                {(errors.tier_variations as any)?.[tierIndex]?.options && (
                  <p className="text-xs text-rose-500 font-medium">{(errors.tier_variations as any)[tierIndex]?.options?.message}</p>
                )}
              </div>
            </div>

            {/* Tier 1 specific option media uploads */}
            {tierIndex === 0 && watchTiers?.[0]?.options && watchTiers[0].options.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Hình ảnh cho phân loại thứ 1</label>
                <div className="flex flex-wrap gap-4">
                  {watchTiers[0].options.map((opt: string) => (
                    <div key={opt} className="flex flex-col items-center gap-1.5 p-3 bg-surface border border-gray-200 rounded-xl">
                      <span className="text-xs text-gray-600 font-medium max-w-[80px] truncate">{opt}</span>
                      <div className="relative h-14 w-14 border border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden hover:border-primary-400 cursor-pointer">
                        {tier1Images[opt] ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tier1Images[opt]} alt={opt} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setTier1Images(prev => {
                                const next = { ...prev };
                                delete next[opt];
                                return next;
                              })}
                              className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-[8px] font-bold"
                            >
                              Xóa
                            </button>
                          </>
                        ) : (
                          <label className="h-full w-full flex items-center justify-center cursor-pointer">
                            {uploadingTier1[opt] ? (
                              <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                            ) : (
                              <Upload className="h-4 w-4 text-gray-500" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleTier1ImageUpload(opt, file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {tierFields.length < 2 && (
          <button 
            type="button" 
            onClick={() => appendTier({ tier_index: tierFields.length + 1, name: "", options: [] })}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-gray-500 hover:text-brand-primary hover:border-brand-primary hover:bg-blue-50 transition-all font-semibold"
          >
            <Plus className="h-5 w-5" /> Thêm nhóm phân loại hàng
          </button>
        )}
      </div>

      {/* Mass Edit / Apply to all Row */}
      {watchVariants && watchVariants.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-bold text-gray-700">Áp dụng hàng loạt:</span>
            <div className="w-32">
              <input 
                type="number" 
                placeholder="Giá"
                className="pim-input"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
              />
            </div>
            <div className="w-32">
              <input 
                type="number" 
                placeholder="Kho hàng"
                className="pim-input"
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleMassApply}
              className="px-4 py-2 bg-brand-light text-brand-primary border border-primary-100 rounded-xl hover:bg-primary-100 font-semibold text-sm transition-colors"
            >
              Áp dụng cho tất cả
            </button>
          </div>
        </div>
      )}

      {/* Variations Table / Matrix */}
      <div className="overflow-x-auto border border-gray-200 rounded-2xl">
        <table className="w-full border-collapse text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
            <tr>
              {watchTiers?.[0]?.name && <th className="px-6 py-4">{watchTiers[0].name}</th>}
              {watchTiers?.[1]?.name && <th className="px-6 py-4">{watchTiers[1].name}</th>}
              <th className="px-6 py-4">Mã vạch (Barcode)</th>
              <th className="px-6 py-4">Giá bán *</th>
              <th className="px-6 py-4">Kho hàng *</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {watchVariants?.map((v: any, idx: number) => {
              let isFirstInGroup = false;
              let rowSpan = 1;
              if (v.tier_1_option !== null) {
                if (idx === 0 || watchVariants[idx - 1].tier_1_option !== v.tier_1_option) {
                  isFirstInGroup = true;
                  let count = 1;
                  for (let i = idx + 1; i < watchVariants.length; i++) {
                    if (watchVariants[i].tier_1_option === v.tier_1_option) count++;
                    else break;
                  }
                  rowSpan = count;
                }
              }

              return (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  {v.tier_1_option !== null && isFirstInGroup && (
                    <td rowSpan={rowSpan} className="px-6 py-4 font-semibold text-gray-900 border-r border-gray-100 align-middle bg-white">
                      {v.tier_1_option}
                    </td>
                  )}
                  {v.tier_2_option !== null && (
                    <td className="px-6 py-4 text-gray-500">{v.tier_2_option}</td>
                  )}

                <td className="px-6 py-3">
                  <input 
                    type="text" 
                    placeholder="Mã vạch"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-primary-500"
                    {...register(`variants.${idx}.barcode` as const)}
                  />
                </td>
                <td className="px-6 py-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₫</span>
                    <input 
                      type="number" 
                      className="pl-6 pr-3 py-1.5 border border-gray-300 rounded-lg w-32 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-primary-500"
                      {...register(`variants.${idx}.price` as const)}
                    />
                  </div>
                  {(errors.variants as any)?.[idx]?.price && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{(errors.variants as any)[idx]?.price?.message}</p>
                  )}
                </td>
                <td className="px-6 py-3">
                  <input 
                    type="number" 
                    className="px-3 py-1.5 border border-gray-300 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-primary-500"
                    {...register(`variants.${idx}.stock` as const)}
                  />
                  {(errors.variants as any)?.[idx]?.stock && (
                    <p className="text-[10px] text-rose-500 mt-0.5">{(errors.variants as any)[idx]?.stock?.message}</p>
                  )}
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
