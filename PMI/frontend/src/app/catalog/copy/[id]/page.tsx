"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";

export default function CopyProductPage() {
  const params = useParams();
  const router = useRouter();
  
  const duplicateProductId = params.id ? parseInt(params.id as string, 10) : null;

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
            PIM / Sao Chép Sản Phẩm
          </span>
        </div>
        
        {duplicateProductId && (
          <ProductForm 
            duplicateProductId={duplicateProductId}
            onSaveSuccess={() => router.push("/catalog")}
          />
        )}
      </div>
    </div>
  );
}
