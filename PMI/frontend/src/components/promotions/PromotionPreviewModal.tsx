"use client";

import React from "react";
import { X, Tag, AlertCircle, Sparkles } from "lucide-react";
import { PreviewResponse } from "@/types/promotion";

interface PromotionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: PreviewResponse | null;
  loading?: boolean;
  error?: string | null;
}

export default function PromotionPreviewModal({
  isOpen,
  onClose,
  previewData,
  loading = false,
  error = null,
}: PromotionPreviewModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN").format(val) + "đ";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Xem trước tác động khuyến mãi</h3>
              <p className="text-xs text-gray-500">Mô phỏng áp dụng khuyến mãi lên danh mục sản phẩm trước khi lưu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-brand-primary/20 border-t-brand-primary animate-spin" />
              <p className="text-xs font-semibold text-gray-500">Đang tính toán tác động khuyến mãi...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : previewData ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-emerald-700">Số biến thể bị ảnh hưởng</span>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {previewData.affected_variants_count} <span className="text-xs font-normal text-emerald-600">biến thể</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Tag className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-indigo-700">Tổng tiền giảm ước tính</span>
                    <p className="text-2xl font-bold text-indigo-900 mt-1">
                      {formatCurrency(previewData.total_discount_amount)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Sample Variants Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Danh sách biến thể mẫu ({previewData.sample_variants.length} mẫu)
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Mã SKU / Biến thể</th>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-right">Giá gốc</th>
                        <th className="px-4 py-3 text-right">Giá khuyến mãi</th>
                        <th className="px-4 py-3 text-right">Mức giảm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.sample_variants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                            Không có biến thể nào khớp với phạm vi đã chọn
                          </td>
                        </tr>
                      ) : (
                        previewData.sample_variants.map((v, idx) => (
                          <tr key={v.variant_id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-medium text-gray-700">
                              {v.sku_code || v.variant_id}
                              {(v.tier_1_option || v.tier_2_option) && (
                                <span className="block text-[10px] text-gray-400 font-sans">
                                  {[v.tier_1_option, v.tier_2_option].filter(Boolean).join(" - ")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {v.product_name || "Sản phẩm"}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400 line-through">
                              {formatCurrency(v.original_price)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {formatCurrency(v.computed_price)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                                -{v.percentage_discount ? `${Math.round(v.percentage_discount)}%` : formatCurrency(v.discount_amount)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 text-xs py-8">Chưa có dữ liệu xem trước</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
