"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import PromotionForm from "@/components/promotions/PromotionForm";
import { getPromotionById } from "@/services/promotionApi";
import { Promotion } from "@/types/promotion";

export default function PromotionEditPage() {
  const params = useParams();
  const id = params?.id as string;
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPromotionById(id)
      .then((data) => {
        setPromotion(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load promotion detail", err);
        setError(err.message || "Không thể tải thông tin khuyến mãi");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary/30 border-t-brand-primary animate-spin" />
        <span className="text-xs font-semibold text-gray-500">Đang tải thông tin khuyến mãi...</span>
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto my-12">
        <h2 className="text-base font-bold text-rose-600 mb-2">Lỗi tải dữ liệu</h2>
        <p className="text-xs text-gray-500 mb-4">{error || "Khuyến mãi không tồn tại"}</p>
      </div>
    );
  }

  return <PromotionForm initialData={promotion} isEdit={true} />;
}
