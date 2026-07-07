import React from "react";
import { 
  ChevronDown, ChevronUp, Star, TrendingUp,
  Image as ImageIcon, ArrowUpDown, Trash2
} from "lucide-react";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { Product } from "./ProductPreviewModal";

interface ProductListTableProps {
  products: Product[];
  loading: boolean;
  expandedProducts: Record<number, boolean>;
  onToggleExpand: (id: number) => void;
  onToggleSort: (field: string) => void;
  onEditProductClick: (id: number) => void;
  onCopyProductClick: (id: number) => void;
  onPreviewClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
  deletingProductId: number | null;
}

export default function ProductListTable({
  products,
  loading,
  expandedProducts,
  onToggleExpand,
  onToggleSort,
  onEditProductClick,
  onCopyProductClick,
  onPreviewClick,
  onDeleteClick,
  deletingProductId
}: ProductListTableProps) {
  // Helper: Get Price Range string
  const getPriceRange = (product: Product) => {
    if (!product.variants || product.variants.length === 0) return "N/A";
    const prices = product.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return `₫${minPrice.toLocaleString("vi-VN")}`;
    }
    return `₫${minPrice.toLocaleString("vi-VN")} - ₫${maxPrice.toLocaleString("vi-VN")}`;
  };

  // Helper: Get Total Stock
  const getTotalStock = (product: Product) => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => sum + v.stock, 0);
  };

  // Helper: Find option cover image
  const getOptionImage = (product: Product, optionName: string | null) => {
    if (!optionName) return null;
    const item = product.media.find(m => m.variant_tier_1_option === optionName);
    return item ? normalizeImageUrl(item.image_url) || item.image_url : null;
  };

  // Helper: Get Product Cover Image
  const getCoverImage = (product: Product) => {
    const cover = product.media.find(m => m.is_cover);
    if (cover) return normalizeImageUrl(cover.image_url) || cover.image_url;
    if (product.media.length > 0) return normalizeImageUrl(product.media[0].image_url) || product.media[0].image_url;
    return null;
  };

  return (
    <div className="pim-table-container">
      <div className="overflow-x-auto">
        <table className="pim-table">
          <thead>
            <tr>
              <th className="px-6 py-4 w-12"><input type="checkbox" className="rounded text-brand-primary" /></th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => onToggleSort("name")}>
                <div className="flex items-center gap-1">
                  Tên sản phẩm
                  <ArrowUpDown className="h-3 w-3 text-gray-500" />
                </div>
              </th>
              <th className="px-6 py-4 w-48 cursor-pointer hover:bg-gray-100" onClick={() => onToggleSort("price")}>
                <div className="flex items-center gap-1">
                  Giá bán
                  <ArrowUpDown className="h-3 w-3 text-gray-500" />
                </div>
              </th>
              <th className="px-6 py-4 w-36 cursor-pointer hover:bg-gray-100" onClick={() => onToggleSort("stock")}>
                <div className="flex items-center gap-1">
                  Kho hàng
                  <ArrowUpDown className="h-3 w-3 text-gray-500" />
                </div>
              </th>
              <th className="px-6 py-4 w-36">Hiệu suất</th>
              <th className="px-6 py-4 w-36">Đánh giá</th>
              <th className="px-6 py-4 w-32 text-right">Thao tác</th>
            </tr>
          </thead>
          
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={7} className="py-20 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="animate-ping h-2.5 w-2.5 rounded-full bg-brand-primary" />
                    <span>Đang tải danh sách sản phẩm...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : products.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7} className="py-20 text-center text-gray-500 space-y-2">
                  <p className="font-semibold text-gray-600 text-base">Không tìm thấy sản phẩm nào</p>
                  <p className="text-xs">Hãy thử thay đổi điều kiện tìm kiếm hoặc thêm sản phẩm mới.</p>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const cover = getCoverImage(product);
                const totalStock = getTotalStock(product);
                const isExpanded = !!expandedProducts[product.id];
                const hasVariants = product.variants && product.variants.length > 1;

                return (
                  <React.Fragment key={product.id}>
                    {/* Product Parent Row */}
                    <tr className={`hover:bg-gray-50/20 transition-colors ${isExpanded ? 'bg-gray-50/10' : ''}`}>
                      <td className="px-6 py-4.5 align-top">
                        <input type="checkbox" className="rounded text-brand-primary mt-1" />
                      </td>
                      
                      {/* Info Column */}
                      <td className="px-6 py-4.5 align-top">
                        <div className="flex gap-4">
                          <div className="h-16 w-16 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center text-gray-500">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div className="space-y-1 max-w-md">
                            <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-snug">
                              {product.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 text-[11px] font-medium text-gray-500">
                              <span>SKU parent: {product.product_code}</span>
                              <span>•</span>
                              <span>ID: {product.id}</span>
                              <span>•</span>
                              <span className={`px-2 py-0.5 rounded-full ${
                                product.status === "Published" 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {product.status === "Published" ? "Đang hoạt động" : "Bản nháp"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price Range */}
                      <td className="px-6 py-4.5 align-top font-semibold text-gray-900">
                        {getPriceRange(product)}
                      </td>

                      {/* Total Stock */}
                      <td className="px-6 py-4.5 align-top font-semibold">
                        {totalStock === 0 ? (
                          <span className="text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full text-xs font-bold inline-block">Hết hàng</span>
                        ) : (
                          <span className="text-gray-700">{totalStock}</span>
                        )}
                      </td>

                      {/* Performance (Mocked) */}
                      <td className="px-6 py-4.5 align-top">
                        <div className="space-y-0.5">
                          <span className="text-gray-700 font-medium text-xs flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            Doanh số: {product.status === "Published" ? "12" : "0"}
                          </span>
                          <p className="text-[10px] text-gray-500">30 ngày qua</p>
                        </div>
                      </td>

                      {/* Rating (Mocked) */}
                      <td className="px-6 py-4.5 align-top">
                        <div className="flex items-center gap-1 text-gray-700 font-medium text-xs">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span>{product.status === "Published" ? "4.8" : "--"}</span>
                          <span className="text-gray-600">/ 5</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 align-top text-right space-y-1.5 text-[11px] font-bold">
                        <button 
                          onClick={() => onEditProductClick(product.id)} 
                          className="text-brand-primary hover:text-primary-700 block ml-auto flex items-center justify-end gap-1"
                        >
                          Cập nhật
                        </button>
                        <button 
                          onClick={() => onCopyProductClick(product.id)} 
                          className="text-gray-500 hover:text-gray-700 block ml-auto flex items-center justify-end gap-1"
                        >
                          Sao chép
                        </button>
                        <button 
                          onClick={() => onPreviewClick(product.id)} 
                          className="text-gray-500 hover:text-gray-600 block ml-auto flex items-center justify-end gap-1"
                        >
                          Xem trước
                        </button>
                        <button 
                          onClick={() => onDeleteClick(product.id)} 
                          disabled={deletingProductId !== null}
                          className="text-rose-500 hover:text-rose-700 disabled:text-gray-600 disabled:cursor-not-allowed block ml-auto flex items-center justify-end gap-1"
                        >
                          {deletingProductId === product.id ? "Đang xóa..." : "Xóa"}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Variants Section Trigger */}
                    {hasVariants && (
                      <tr>
                        <td colSpan={7} className="px-6 py-1 bg-gray-50/30 border-t border-gray-200/60">
                          <button 
                            onClick={() => onToggleExpand(product.id)}
                            className="text-xs font-semibold text-gray-500 hover:text-brand-primary flex items-center gap-1.5 py-1.5 focus:outline-none transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5" /> Thu gọn biến thể
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5" /> Xem thêm (còn {product.variants.length} phân loại)
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Expanded Sub-table */}
                    {isExpanded && hasVariants && (
                      <tr>
                        <td colSpan={7} className="p-0 bg-gray-50">
                          <div className="px-16 py-4 border-t border-b border-gray-200">
                            <table className="w-full text-left text-xs text-gray-500 border-collapse bg-surface rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                              <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200">
                                <tr>
                                  <th className="px-5 py-3 w-16">Hình ảnh</th>
                                  <th className="px-5 py-3">Phân loại hàng</th>
                                  <th className="px-5 py-3">Mã SKU phân loại</th>
                                  <th className="px-5 py-3 w-36">Giá bán</th>
                                  <th className="px-5 py-3 w-32">Kho hàng</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {product.variants.map((v) => {
                                  // Match tier 1 option name to its specific image
                                  const variantImage = getOptionImage(product, v.tier_1_option);
                                  const label = [v.tier_1_option, v.tier_2_option].filter(Boolean).join(" - ");

                                  return (
                                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-5 py-2">
                                        <div className="h-9 w-9 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center text-gray-600">
                                          {variantImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={variantImage} alt={label} className="h-full w-full object-cover" />
                                          ) : cover ? (
                                            // Fallback to parent cover
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={cover} alt={label} className="h-full w-full object-cover" />
                                          ) : (
                                            <ImageIcon className="h-3 w-3" />
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-5 py-2 font-semibold text-gray-700">
                                        {label}
                                      </td>
                                      <td className="px-5 py-2 font-mono text-gray-500">
                                        {v.sku_code}
                                      </td>
                                      <td className="px-5 py-2 font-semibold text-gray-700">
                                        ₫{v.price.toLocaleString("vi-VN")}
                                      </td>
                                      <td className="px-5 py-2 font-semibold">
                                        {v.stock === 0 ? (
                                          <span className="text-rose-500">Hết hàng</span>
                                        ) : (
                                          <span className="text-gray-600">{v.stock}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
