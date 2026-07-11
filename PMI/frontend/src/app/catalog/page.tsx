"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ProductList from "@/components/ProductList";

export default function CatalogPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-brand-light">
      <ProductList 
        onAddProductClick={() => router.push("/catalog/create")} 
        onEditProductClick={(id) => router.push(`/catalog/edit/${id}`)}
        onCopyProductClick={(id) => router.push(`/catalog/copy/${id}`)}
      />
    </div>
  );
}
