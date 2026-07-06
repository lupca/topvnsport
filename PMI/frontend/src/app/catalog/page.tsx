"use client";

import React, { useState } from "react";
import ProductList from "@/components/ProductList";
import ProductForm from "@/components/ProductForm";

export default function CatalogPage() {
  const [view, setView] = useState<"list" | "create" | "edit" | "copy">("list");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const handleEdit = (id: number) => {
    setSelectedProductId(id);
    setView("edit");
  };

  const handleCopy = (id: number) => {
    setSelectedProductId(id);
    setView("copy");
  };

  const handleBack = () => {
    setSelectedProductId(null);
    setView("list");
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {view === "list" ? (
        <ProductList 
          onAddProductClick={() => setView("create")} 
          onEditProductClick={handleEdit}
          onCopyProductClick={handleCopy}
        />
      ) : (
        <div className="space-y-2">
          {/* Top Back Action Bar */}
          <div className="max-w-6xl mx-auto pt-8 px-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-slate-900 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-bold text-xs shadow-sm"
            >
              ← Quay lại danh sách
            </button>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              PIM / {view === "create" ? "Thêm Sản Phẩm Mới" : view === "edit" ? "Cập Nhật Sản Phẩm" : "Sao Chép Sản Phẩm"}
            </span>
          </div>
          
          <ProductForm 
            productId={view === "edit" ? selectedProductId : undefined}
            duplicateProductId={view === "copy" ? selectedProductId : undefined}
            onSaveSuccess={handleBack}
          />
        </div>
      )}
    </div>
  );
}
