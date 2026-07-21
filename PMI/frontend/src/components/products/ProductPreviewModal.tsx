import React from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { normalizeImageUrl } from "@/utils/imageUrl";

export interface Variant {
  id: number;
  tier_1_option: string | null;
  tier_2_option: string | null;
  sku_code: string;
  price: number;
}

export interface Media {
  id: number;
  image_url: string;
  is_cover: boolean;
  variant_tier_1_option: string | null;
}

export interface Product {
  id: number;
  product_code: string;
  name: string;
  description: string;
  category_id: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  is_pre_order?: boolean;
  dts_days?: number;
  status: string;
  variants: Variant[];
  tier_variations: { name: string; options: string[]; tier_index: number }[];
  media: Media[];
}

interface Category {
  id: number;
  name: string;
  code: string;
}

interface ProductPreviewModalProps {
  showPreviewModal: boolean;
  onClose: () => void;
  previewLoading: boolean;
  previewProduct: Product | null;
  categories: Category[];
  onEditProductClick: (id: number) => void;
}

export default function ProductPreviewModal({
  showPreviewModal,
  onClose,
  previewLoading,
  previewProduct,
  categories,
  onEditProductClick
}: ProductPreviewModalProps) {
  if (!showPreviewModal) return null;

  return (
    <div className="pim-modal-backdrop z-50">
      <div className="pim-modal-content max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <span className="text-xs bg-blue-50 text-brand-primary px-2.5 py-1 rounded-full font-bold border border-blue-100">
              Chi tiết sản phẩm
            </span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Xem trước thông tin</h2>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {previewLoading ? (
            <div className="py-20 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <span className="animate-ping h-2.5 w-2.5 rounded-full bg-brand-primary" />
                <span>Đang tải thông tin chi tiết...</span>
              </div>
            </div>
          ) : previewProduct ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Side: Images & Logistics */}
              <div className="space-y-6">
                {/* Main Image & Gallery */}
                <div>
                  <div className="aspect-square bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden flex items-center justify-center text-gray-600 relative">
                    {previewProduct.media.find(m => m.is_cover) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={normalizeImageUrl(previewProduct.media.find(m => m.is_cover)?.image_url) || previewProduct.media.find(m => m.is_cover)?.image_url} 
                        alt={previewProduct.name} 
                        className="h-full w-full object-cover" 
                      />
                    ) : previewProduct.media.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={normalizeImageUrl(previewProduct.media[0].image_url) || previewProduct.media[0].image_url} 
                        alt={previewProduct.name} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12" />
                    )}
                  </div>
                  
                  {/* Media Thumbnails */}
                  {previewProduct.media.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {previewProduct.media.map((img) => (
                        <div key={img.id} className={`h-14 w-14 border rounded-xl overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center ${img.is_cover ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={normalizeImageUrl(img.image_url) || img.image_url} alt="Thumbnail" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Logistics Card */}
                <div className="bg-gray-50 p-4.5 rounded-2xl border border-gray-200/60 space-y-3">
                  <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Thông tin vận chuyển</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">Cân nặng (sau đóng gói):</span>
                      <strong className="text-gray-700">{previewProduct.weight} g</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Kích thước đóng gói:</span>
                      <strong className="text-gray-700">
                        {[previewProduct.length, previewProduct.width, previewProduct.height].filter(Boolean).join(" x ") || "N/A"} cm
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Hàng đặt trước:</span>
                      <strong className="text-gray-700">{previewProduct.is_pre_order ? `Có (${previewProduct.dts_days} ngày)` : "Không"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Trạng thái:</span>
                      <strong className="text-gray-700">{previewProduct.status === "Published" ? "Đang hoạt động" : "Bản nháp"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Basic Info & Variants */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                      {categories.find(c => c.id === previewProduct.category_id)?.name || "Chưa phân loại"}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-xs font-mono text-gray-500">Parent SKU: {previewProduct.product_code}</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 leading-snug">{previewProduct.name}</h1>
                  <div className="text-xs font-medium text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-y-auto max-h-36 whitespace-pre-wrap">
                    {previewProduct.description || "Không có mô tả sản phẩm."}
                  </div>
                </div>

                {/* Variations Table */}
                <div className="space-y-2.5">
                  <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Danh sách phân loại sản phẩm</h3>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs text-gray-600 border-collapse bg-surface">
                      <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5">Phân loại</th>
                          <th className="px-4 py-2.5">SKU phân loại</th>
                          <th className="px-4 py-2.5">Giá bán</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewProduct.variants.map((v) => {
                          const label = [v.tier_1_option, v.tier_2_option].filter(Boolean).join(" - ");
                          return (
                            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2 font-bold text-gray-700">{label || "Mặc định"}</td>
                              <td className="px-4 py-2 font-mono text-gray-500 text-[11px]">{v.sku_code}</td>
                              <td className="px-4 py-2 font-bold text-brand-primary">₫{v.price.toLocaleString("vi-VN")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500">Không thể tải thông tin sản phẩm.</div>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="btn-outline text-xs"
          >
            Đóng
          </button>
          {previewProduct && (
            <button 
              onClick={() => {
                onClose();
                onEditProductClick(previewProduct.id);
              }}
              className="btn-primary text-xs"
            >
              Cập nhật sản phẩm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
