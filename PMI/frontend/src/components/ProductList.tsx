"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, RotateCcw, ChevronDown, ChevronUp, 
  Plus, Grid, List, HelpCircle, Star, Sparkles, TrendingUp,
  Image as ImageIcon, ChevronLeft, ChevronRight, ArrowUpDown,
  Eye, Copy, Trash2, X, ExternalLink
} from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { normalizeImageUrl } from "@/utils/imageUrl";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface Category {
  id: number;
  name: string;
  code: string;
}

interface Variant {
  id: number;
  tier_1_option: string | null;
  tier_2_option: string | null;
  sku_code: string;
  price: number;
  stock: number;
}

interface Media {
  id: number;
  image_url: string;
  is_cover: boolean;
  variant_tier_1_option: string | null;
}

interface Product {
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

interface ProductListProps {
  onAddProductClick: () => void;
  onEditProductClick: (id: number) => void;
  onCopyProductClick: (id: number) => void;
}

export default function ProductList({ 
  onAddProductClick,
  onEditProductClick,
  onCopyProductClick
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("0");
  const [productType, setProductType] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "Published" | "Draft">("all");

  // Sorting states
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Expanded product IDs map for nested variant tables
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});

  // Preview & Delete States
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handlePreviewClick = (productId: number) => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    fetch(`${API_BASE_URL}/products/${productId}`)
      .then(res => res.json())
      .then(data => {
        setPreviewProduct(data);
        setPreviewLoading(false);
      })
      .catch(err => {
        console.error("Error fetching preview product:", err);
        setPreviewLoading(false);
      });
  };

  const handleDeleteClick = async (productId: number) => {
    if (deletingProductId !== null) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    setDeleteError(null);
    setDeleteTarget(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget || deletingProductId !== null) return;

    const productId = deleteTarget.id;

    setDeletingProductId(productId);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        let detail = "Xóa sản phẩm thất bại.";
        try {
          const data = await res.json();
          if (data?.detail) {
            detail = String(data.detail);
          }
        } catch {
          // Keep generic detail if API did not return JSON payload
        }
        setDeleteError(detail);
        return;
      }

      setProducts(prev => prev.filter(p => p.id !== productId));
      setTotalItems(prev => Math.max(0, prev - 1));
      setDeleteTarget(null);
      setDeleteError(null);

      if (showPreviewModal && previewProduct?.id === productId) {
        setShowPreviewModal(false);
        setPreviewProduct(null);
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      setDeleteError("Không thể kết nối tới máy chủ để xóa sản phẩm.");
    } finally {
      setDeletingProductId(null);
    }
  };

  // Applied filter states for query execution
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("0");

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE_URL}/categories`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error("Error categories:", err));
  }, []);

  // Fetch products based on filters, sorting, tab, and pagination
  useEffect(() => {
    setLoading(true);
    let url = `${API_BASE_URL}/products?page=${currentPage}&limit=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}&`;
    
    if (appliedSearch) {
      url += `q=${encodeURIComponent(appliedSearch)}&`;
    }
    if (appliedCategory !== "0") {
      url += `category_id=${appliedCategory}&`;
    }
    if (activeTab !== "all") {
      url += `status=${activeTab}&`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        // Handle paginated structure
        setProducts(data.items || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error products:", err);
        setProducts([]);
        setLoading(false);
      });
  }, [appliedSearch, appliedCategory, activeTab, sortBy, sortOrder, currentPage, pageSize]);

  // Reset pagination on filter or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, appliedCategory, activeTab, sortBy, sortOrder, pageSize]);

  useEffect(() => {
    if (!loading && products.length === 0 && currentPage > 1 && totalItems > 0) {
      setCurrentPage(prev => Math.max(1, prev - 1));
    }
  }, [loading, products.length, currentPage, totalItems]);

  const handleApplyFilters = () => {
    setAppliedSearch(searchQuery);
    setAppliedCategory(selectedCategory);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("0");
    setProductType("all");
    setAppliedSearch("");
    setAppliedCategory("0");
  };

  const toggleExpand = (productId: number) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

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
    <div className="pim-page">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            Danh Sách Sản Phẩm <Sparkles className="h-5 w-5 text-brand-primary fill-blue-100" />
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="pim-muted-chip">
              Hạn mức đăng bán: 5000
            </span>
            <HelpCircle className="h-4 w-4 text-gray-400 cursor-pointer" />
          </div>
        </div>
        <button 
          onClick={onAddProductClick}
          className="btn-primary px-5 py-2.5 rounded-2xl text-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Thêm 1 sản phẩm mới
        </button>
      </div>

      {/* ADVANCED SEARCH BOX */}
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
            onClick={handleResetFilters}
            className="btn-outline text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Đặt lại
          </button>
          <button 
            onClick={handleApplyFilters}
            className="btn-primary text-xs"
          >
            Áp dụng
          </button>
        </div>
      </div>

      {/* FILTER TABS & QUICK SORT BAR */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 text-sm font-bold transition-all relative ${
                activeTab === "all" ? "text-brand-primary" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Tất cả {totalItems > 0 && activeTab === "all" ? `(${totalItems})` : ""}
              {activeTab === "all" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab("Published")}
              className={`pb-3 text-sm font-bold transition-all relative ${
                activeTab === "Published" ? "text-brand-primary" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Đang hoạt động {totalItems > 0 && activeTab === "Published" ? `(${totalItems})` : ""}
              {activeTab === "Published" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab("Draft")}
              className={`pb-3 text-sm font-bold transition-all relative ${
                activeTab === "Draft" ? "text-brand-primary" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Chưa được đăng (Nháp) {totalItems > 0 && activeTab === "Draft" ? `(${totalItems})` : ""}
              {activeTab === "Draft" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full" />}
            </button>
          </div>

          <div className="flex items-center gap-2 text-gray-500">
            <button className="btn-icon p-1"><List className="h-4 w-4" /></button>
            <button className="btn-icon p-1"><Grid className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Shopee-like Quick Sort Toolbar */}
        <div className="pim-toolbar flex flex-wrap items-center gap-4">
          <span className="text-gray-500">Sắp xếp theo:</span>
          
          <button 
            onClick={() => { setSortBy("id"); setSortOrder("desc"); }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              sortBy === "id" 
                ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                : "hover:bg-gray-100"
            }`}
          >
            Mới nhất
          </button>
          
          <button 
            onClick={() => { setSortBy("name"); toggleSort("name"); }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              sortBy === "name" 
                ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                : "hover:bg-gray-100"
            }`}
          >
            Tên sản phẩm
            {sortBy === "name" && (sortOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
          </button>

          <button 
            onClick={() => { setSortBy("price"); toggleSort("price"); }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              sortBy === "price" 
                ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                : "hover:bg-gray-100"
            }`}
          >
            Giá bán
            {sortBy === "price" && (sortOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
          </button>

          <button 
            onClick={() => { setSortBy("stock"); toggleSort("stock"); }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              sortBy === "stock" 
                ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                : "hover:bg-gray-100"
            }`}
          >
            Tồn kho
            {sortBy === "stock" && (sortOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
          </button>
        </div>
      </div>

      {/* PRODUCT LIST TABLE */}
      <div className="pim-table-container">
        <div className="overflow-x-auto">
          <table className="pim-table">
            <thead>
              <tr>
                <th className="px-6 py-4 w-12"><input type="checkbox" className="rounded text-brand-primary" /></th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort("name")}>
                  <div className="flex items-center gap-1">
                    Tên sản phẩm
                    <ArrowUpDown className="h-3 w-3 text-gray-500" />
                  </div>
                </th>
                <th className="px-6 py-4 w-48 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort("price")}>
                  <div className="flex items-center gap-1">
                    Giá bán
                    <ArrowUpDown className="h-3 w-3 text-gray-500" />
                  </div>
                </th>
                <th className="px-6 py-4 w-36 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort("stock")}>
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
                            onClick={() => handlePreviewClick(product.id)} 
                            className="text-gray-500 hover:text-gray-600 block ml-auto flex items-center justify-end gap-1"
                          >
                            Xem trước
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(product.id)} 
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
                              onClick={() => toggleExpand(product.id)}
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

        {/* PAGINATION SYSTEM FOOTER */}
        {!loading && totalItems > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-gray-500">
            {/* Rows Per Page Select */}
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                className="px-2 py-1 border border-gray-300 rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-brand-primary"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {APP_SETTINGS.pagination.options.map(opt => (
                  <option key={opt} value={opt}>{opt} hàng / trang</option>
                ))}
              </select>
              <span>
                từ {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} - {Math.min(totalItems, currentPage * pageSize)} trên tổng số {totalItems} sản phẩm
              </span>
            </div>

            {/* Page Nav controls */}
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-gray-300 bg-surface hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-surface transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    currentPage === p
                      ? "bg-primary-600 text-white font-bold"
                      : "border border-gray-300 bg-surface hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-gray-300 bg-surface hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-surface transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW MODAL */}
      {showPreviewModal && (
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
                onClick={() => { setShowPreviewModal(false); setPreviewProduct(null); }}
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
                              <th className="px-4 py-2.5 w-24">Kho hàng</th>
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
                                  <td className="px-4 py-2 text-gray-500 font-semibold">{v.stock}</td>
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
                onClick={() => { setShowPreviewModal(false); setPreviewProduct(null); }}
                className="btn-outline text-xs"
              >
                Đóng
              </button>
              {previewProduct && (
                <button 
                  onClick={() => {
                    setShowPreviewModal(false);
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
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="pim-modal-backdrop">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-rose-50/40">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Xác nhận xóa sản phẩm</h3>
              <p className="text-xs text-gray-500 mt-1">Thao tác này sẽ xóa dữ liệu sản phẩm khỏi hệ thống PMI.</p>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-bold text-gray-900 line-clamp-2">{deleteTarget.name}</p>
                <p className="text-xs text-gray-500 mt-1">SKU parent: {deleteTarget.product_code}</p>
                <p className="text-xs text-gray-500 mt-0.5">ID: {deleteTarget.id}</p>
              </div>

              {deleteError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (deletingProductId !== null) return;
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                disabled={deletingProductId !== null}
                className="btn-outline text-xs"
              >
                Hủy
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={deletingProductId !== null}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:bg-rose-300 disabled:cursor-not-allowed transition-colors"
              >
                {deletingProductId === deleteTarget.id ? "Đang xóa..." : "Xóa sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
