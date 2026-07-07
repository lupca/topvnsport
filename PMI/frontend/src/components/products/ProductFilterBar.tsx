import React from "react";
import { Search, RotateCcw } from "lucide-react";

export interface Category {
  id: number;
  name: string;
  code: string;
}

interface ProductFilterBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  productType: string;
  setProductType: (val: string) => void;
  categories: Category[];
  onResetFilters: () => void;
  onApplyFilters: () => void;
}

export default function ProductFilterBar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  productType,
  setProductType,
  categories,
  onResetFilters,
  onApplyFilters
}: ProductFilterBarProps) {
  return (
    <div className="pim-card space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Text Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Tìm Tên sản phẩm, SKU sản phẩm, SKU phân loại..."
            className="pim-input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Select */}
        <div>
          <select
            className="pim-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="0">Ngành hàng (Tất cả)</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Product Type Select */}
        <div>
          <select
            className="pim-input"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
          >
            <option value="all">Sản phẩm chủ lực (Tất cả)</option>
            <option value="best_seller">Sản phẩm bán chạy</option>
            <option value="new">Sản phẩm mới ra mắt</option>
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button 
          onClick={onResetFilters}
          className="btn-outline text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Đặt lại
        </button>
        <button 
          onClick={onApplyFilters}
          className="btn-primary text-xs"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}
