"use client";

import React from "react";
import { useParams } from "next/navigation";
import PromotionDetail from "@/components/promotions/PromotionDetail";

export default function PromotionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return <PromotionDetail id={id} />;
}
