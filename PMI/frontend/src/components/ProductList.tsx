"use client";

import React, { useState, useEffect } from "react";
import { Plus, HelpCircle, Sparkles, List, Grid, Download, ChevronDown, Trash2 } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

import ProductFilterBar, { Category } from "./products/ProductFilterBar";
import ProductListTable from "./products/ProductListTable";
import ProductPagination from "./products/ProductPagination";
import ProductPreviewModal, { Product } from "./products/ProductPreviewModal";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

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

  // Selection states
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

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
  const [batchDeleteMode, setBatchDeleteMode] = useState(false);

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

    setBatchDeleteMode(false);
    setDeleteError(null);
    setDeleteTarget(product);
  };

  const handleBatchDeleteClick = () => {
    if (deletingProductId !== null) return;
    setBatchDeleteMode(true);
    setDeleteError(null);
    setDeleteTarget({ id: -1, name: "Batch Delete", product_code: "BATCH" } as Product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget || deletingProductId !== null) return;

    if (batchDeleteMode) {
      setDeletingProductId(-1);
      try {
        const res = await fetch(`${API_BASE_URL}/products/batch-delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ product_ids: selectedProductIds })
        });

        if (!res.ok) {
          let detail = "Xóa nhiều sản phẩm thất bại.";
          try {
            const data = await res.json();
            if (data?.detail) {
              detail = String(data.detail);
            }
          } catch {}
          setDeleteError(detail);
          return;
        }

        setProducts(prev => prev.filter(p => !selectedProductIds.includes(p.id)));
        setTotalItems(prev => Math.max(0, prev - selectedProductIds.length));
        setSelectedProductIds([]);
        setDeleteTarget(null);
        setDeleteError(null);
      } catch (err) {
        console.error("Error batch deleting products:", err);
        setDeleteError("Không thể kết nối tới máy chủ để xóa sản phẩm.");
      } finally {
        setDeletingProductId(null);
      }
    } else {
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
          } catch {}
          setDeleteError(detail);
          return;
        }

        setProducts(prev => prev.filter(p => p.id !== productId));
        setSelectedProductIds(prev => prev.filter(id => id !== productId));
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

  // Reset selection on products list refresh
  useEffect(() => {
    setSelectedProductIds([]);
  }, [products]);

  const handleToggleSelectProduct = (productId: number) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handleExport = (platform: "shopee" | "tiktok") => {
    setShowExportDropdown(false);
    let url = `${API_BASE_URL}/api/export/${platform}?status=Published`;
    if (selectedProductIds.length > 0) {
      url += `&product_ids=${selectedProductIds.join(",")}`;
    }
    window.location.href = url;
  };

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
        <div className="flex items-center gap-3 shrink-0">
          {selectedProductIds.length > 0 && (
            <span className="text-xs text-gray-500 font-medium mr-1">
              Đã chọn {selectedProductIds.length} sản phẩm
            </span>
          )}
          
          {/* Dropdown Button */}
          <div className="relative inline-block text-left">
            <button 
              type="button"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="btn-outline px-5 py-2.5 rounded-2xl text-sm flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> 
              Xuất dữ liệu 
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showExportDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowExportDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-surface shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport("shopee")}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 gap-2 transition-colors text-left"
                    >
                      <span>📥</span> Xuất file Shopee (Đã Published)
                    </button>
                    <button
                      onClick={() => handleExport("tiktok")}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 gap-2 transition-colors text-left"
                    >
                      <span>📥</span> Xuất file TikTok (Đã Published)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedProductIds.length > 0 && (
            <button
              onClick={handleBatchDeleteClick}
              className="px-5 py-2.5 rounded-2xl text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-2 transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Xóa đã chọn
            </button>
          )}

          <button 
            onClick={onAddProductClick}
            className="btn-primary px-5 py-2.5 rounded-2xl text-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Thêm 1 sản phẩm mới
          </button>
        </div>
      </div>

      {/* ADVANCED SEARCH BOX */}
      <ProductFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        productType={productType}
        setProductType={setProductType}
        categories={categories}
        onResetFilters={handleResetFilters}
        onApplyFilters={handleApplyFilters}
      />

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
            {sortBy === "name" && (sortOrder === "asc" ? <span className="text-xs">↑</span> : <span className="text-xs">↓</span>)}
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
            {sortBy === "price" && (sortOrder === "asc" ? <span className="text-xs">↑</span> : <span className="text-xs">↓</span>)}
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
            {sortBy === "stock" && (sortOrder === "asc" ? <span className="text-xs">↑</span> : <span className="text-xs">↓</span>)}
          </button>
        </div>
      </div>

      {/* PRODUCT LIST TABLE */}
      <ProductListTable
        products={products}
        loading={loading}
        expandedProducts={expandedProducts}
        selectedProductIds={selectedProductIds}
        onToggleSelectProduct={handleToggleSelectProduct}
        onToggleSelectAll={handleToggleSelectAll}
        onToggleExpand={toggleExpand}
        onToggleSort={toggleSort}
        onEditProductClick={onEditProductClick}
        onCopyProductClick={onCopyProductClick}
        onPreviewClick={handlePreviewClick}
        onDeleteClick={handleDeleteClick}
        deletingProductId={deletingProductId}
      />

      {/* PAGINATION SYSTEM FOOTER */}
      {!loading && totalItems > 0 && (
        <ProductPagination
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          pageSizeOptions={APP_SETTINGS.pagination.options}
        />
      )}

      {/* PREVIEW MODAL */}
      <ProductPreviewModal
        showPreviewModal={showPreviewModal}
        onClose={() => { setShowPreviewModal(false); setPreviewProduct(null); }}
        previewLoading={previewLoading}
        previewProduct={previewProduct}
        categories={categories}
        onEditProductClick={onEditProductClick}
      />

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="pim-modal-backdrop">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-rose-50/40">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                {batchDeleteMode ? "Xác nhận xóa nhiều sản phẩm" : "Xác nhận xóa sản phẩm"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {batchDeleteMode 
                  ? "Thao tác này sẽ xóa vĩnh viễn các sản phẩm đã chọn khỏi hệ thống PMI." 
                  : "Thao tác này sẽ xóa dữ liệu sản phẩm khỏi hệ thống PMI."}
              </p>
            </div>

            <div className="px-6 py-5 space-y-3">
              {batchDeleteMode ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-bold text-gray-900">
                    Bạn sắp xóa vĩnh viễn {selectedProductIds.length} sản phẩm đã chọn.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Hành động này không thể hoàn tác.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-bold text-gray-900 line-clamp-2">{deleteTarget.name}</p>
                  <p className="text-xs text-gray-500 mt-1">SKU parent: {deleteTarget.product_code}</p>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {deleteTarget.id}</p>
                </div>
              )}

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
                {deletingProductId !== null ? "Đang xóa..." : batchDeleteMode ? "Xóa các sản phẩm" : "Xóa sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
