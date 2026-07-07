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
    <div className="min-h-screen bg-brand-light">
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
              className="btn-outline px-4 py-2 text-xs"
            >
              ← Quay lại danh sách
            </button>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
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
