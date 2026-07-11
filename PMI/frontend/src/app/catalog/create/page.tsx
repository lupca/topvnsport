"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";

export default function CreateProductPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="space-y-2">
        {/* Top Back Action Bar */}
        <div className="max-w-6xl mx-auto pt-8 px-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/catalog")}
            className="btn-outline px-4 py-2 text-xs"
          >
            ← Quay lại danh sách
          </button>
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
            PIM / Thêm Sản Phẩm Mới
          </span>
        </div>
        
        <ProductForm 
          onSaveSuccess={() => router.push("/catalog")}
        />
      </div>
    </div>
  );
}
