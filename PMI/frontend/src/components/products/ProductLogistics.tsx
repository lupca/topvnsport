import React from "react";
import { useFormContext } from "react-hook-form";

export default function ProductLogistics() {
  const { register, watch, formState: { errors } } = useFormContext();
  const watchIsPreOrder = watch("is_pre_order");

  return (
    <div className="space-y-8">
      {/* SECTION 4: LOGISTICS & SHIPPING */}
      <div className="pim-card space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Vận chuyển & Logistics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Cân nặng (sau đóng gói) *</label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                className="pim-input pr-12"
                {...register("weight")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-xs">gram</span>
            </div>
            {errors.weight && <p className="text-xs text-rose-500 font-medium">{errors.weight.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Chiều dài</label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                className="pim-input pr-12"
                {...register("length")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-xs">cm</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Chiều rộng</label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                className="pim-input pr-12"
                {...register("width")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-xs">cm</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Chiều cao</label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                className="pim-input pr-12"
                {...register("height")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-xs">cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: PRE-ORDER & STATUS */}
      <div className="pim-card space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Thông tin khác</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Pre Order Switch */}
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900">Hàng đặt trước</h4>
                <p className="text-xs text-gray-500 mt-0.5">Tôi cần thêm thời gian chuẩn bị hàng (7-30 ngày)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  {...register("is_pre_order")}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
              </label>
            </div>

            {watchIsPreOrder && (
              <div className="space-y-1.5 pt-2 border-t border-gray-300/50">
                <label className="text-xs font-semibold text-gray-600">Thời gian chuẩn bị hàng (dts_days) *</label>
                <div className="relative w-36">
                  <input 
                    type="number" 
                    min={7}
                    max={30}
                    className="pim-input pr-12"
                    {...register("dts_days")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">ngày</span>
                </div>
                {errors.dts_days && <p className="text-xs text-rose-500 font-medium">{errors.dts_days.message as string}</p>}
              </div>
            )}
          </div>

          {/* Status Option */}
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
            <h4 className="font-bold text-gray-900">Trạng thái phát hành</h4>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-700">
                <input 
                  type="radio" 
                  value="Draft"
                  className="text-brand-primary focus:ring-brand-primary"
                  {...register("status")}
                />
                Lưu bản nháp (Draft)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-700">
                <input 
                  type="radio" 
                  value="Published"
                  className="text-brand-primary focus:ring-brand-primary"
                  {...register("status")}
                />
                Công khai ngay (Published)
              </label>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
