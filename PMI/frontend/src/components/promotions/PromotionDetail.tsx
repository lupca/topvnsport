"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  Edit,
  Trash2,
  Play,
  Pause,
  StopCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Layers,
  Calendar,
  Percent,
  Check,
} from "lucide-react";
import { Promotion, PromotionStatus, PreviewResponse } from "@/types/promotion";
import {
  getPromotionById,
  activatePromotion,
  pausePromotion,
  resumePromotion,
  endPromotion,
  deletePromotion,
  previewPromotion,
} from "@/services/promotionApi";
import { popupService } from "@/components/ui/popupService";

interface PromotionDetailProps {
  id: string;
}

export default function PromotionDetail({ id }: PromotionDetailProps) {
  const router = useRouter();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"overview" | "scopes" | "variants">("overview");

  // Computed price / preview detail state
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPromotionById(id);
      setPromotion(data);
      setError(null);

      // Trigger preview calculation for computed variant table
      setLoadingPreview(true);
      try {
        const preview = await previewPromotion({
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          max_discount: data.max_discount,
          scopes: data.scopes,
          starts_at: data.starts_at,
          ends_at: data.ends_at,
        });
        setPreviewData(preview);
      } catch (pErr) {
        console.error("Preview load error", pErr);
      } finally {
        setLoadingPreview(false);
      }
    } catch (err: any) {
      console.error("Fetch detail error", err);
      setError(err.message || "Không thể tải thông tin chi tiết khuyến mãi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      await activatePromotion(id);
      await fetchDetail();
    } catch (err: any) {
      await popupService.alert(`Lỗi kích hoạt: ${err.message || "Không thể kích hoạt"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await pausePromotion(id);
      await fetchDetail();
    } catch (err: any) {
      await popupService.alert(`Lỗi tạm dừng: ${err.message || "Không thể tạm dừng"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await resumePromotion(id);
      await fetchDetail();
    } catch (err: any) {
      await popupService.alert(`Lỗi tiếp tục: ${err.message || "Không thể tiếp tục"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    const confirmed = await popupService.confirm("Bạn có chắc chắn muốn kết thúc chương trình khuyến mãi này?");
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await endPromotion(id);
      await fetchDetail();
    } catch (err: any) {
      await popupService.alert(`Lỗi kết thúc: ${err.message || "Không thể kết thúc"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!promotion) return;
    const confirmed = await popupService.confirm(`Bạn có chắc chắn muốn xóa khuyến mãi "${promotion.name}"?`);
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await deletePromotion(id);
      router.push("/promotions");
    } catch (err: any) {
      await popupService.alert(`Lỗi xóa: ${err.message || "Không thể xóa"}`);
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN").format(val) + "đ";
  };

  const renderStatusBadge = (status?: PromotionStatus) => {
    if (!status) return null;
    const config: Record<PromotionStatus, { bg: string; label: string; icon: any }> = {
      DRAFT: { bg: "bg-gray-100 text-gray-700 border-gray-200", label: "Bản nháp", icon: Clock },
      SCHEDULED: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Lên lịch", icon: Clock },
      ACTIVE: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Đang hoạt động", icon: CheckCircle },
      PAUSED: { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Tạm dừng", icon: AlertCircle },
      ENDED: { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Đã kết thúc", icon: StopCircle },
    };
    const cfg = config[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200", label: status, icon: Clock };
    const Icon = cfg.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg}`}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary/30 border-t-brand-primary animate-spin" />
        <span className="text-xs font-semibold text-gray-500">Đang tải thông tin chi tiết...</span>
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto my-12">
        <h2 className="text-base font-bold text-rose-600 mb-2">Không thể tải thông tin</h2>
        <p className="text-xs text-gray-500 mb-4">{error || "Khuyến mãi không tồn tại"}</p>
        <Link
          href="/promotions"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </Link>
      </div>
    );
  }

  const affectedCount = promotion.affected_variants_count ?? previewData?.affected_variants_count ?? 0;
  const totalSavings = previewData?.total_discount_amount ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Action Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/promotions"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-lg border border-gray-200">
                  {promotion.code}
                </span>
                {renderStatusBadge(promotion.status)}
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1">{promotion.name}</h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/promotions/edit/${promotion.id}`}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Edit className="w-4 h-4 text-gray-500" />
              <span>Chỉnh sửa</span>
            </Link>

            {(promotion.status === "DRAFT" || promotion.status === "SCHEDULED") && (
              <button
                disabled={actionLoading}
                onClick={handleActivate}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Kích hoạt</span>
              </button>
            )}

            {promotion.status === "ACTIVE" && (
              <button
                disabled={actionLoading}
                onClick={handlePause}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" />
                <span>Tạm dừng</span>
              </button>
            )}

            {promotion.status === "PAUSED" && (
              <button
                disabled={actionLoading}
                onClick={handleResume}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Tiếp tục</span>
              </button>
            )}

            {(promotion.status === "ACTIVE" || promotion.status === "PAUSED") && (
              <button
                disabled={actionLoading}
                onClick={handleEnd}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" />
                <span>Kết thúc</span>
              </button>
            )}

            <button
              disabled={actionLoading}
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-rose-600 hover:bg-gray-100 rounded-xl transition-colors"
              title="Xóa khuyến mãi"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Biến thể bị ảnh hưởng</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {affectedCount} <span className="text-xs font-normal text-gray-500">biến thể</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Tổng tiền giảm tiềm năng</span>
            <p className="text-2xl font-bold text-indigo-900 mt-1">
              {formatCurrency(totalSavings)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500">Độ ưu tiên (Priority)</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {promotion.priority}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 pt-3 flex gap-4 bg-gray-50/50">
          {[
            { key: "overview", label: "Tổng quan", icon: Tag },
            { key: "scopes", label: "Phạm vi & Loại trừ", icon: Layers },
            { key: "variants", label: "Biến thể áp dụng & Giá tính toán", icon: Sparkles },
          ].map((t) => {
            const isActive = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-4 py-3 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                  isActive
                    ? "bg-white text-brand-primary border-brand-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-900 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Chi tiết thông số khuyến mãi</h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Loại giảm giá:</span>
                      <span className="font-bold text-gray-900">{promotion.discount_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Giá trị giảm:</span>
                      <span className="font-bold text-emerald-600">
                        {promotion.discount_type === "PERCENTAGE"
                          ? `-${promotion.discount_value}%`
                          : formatCurrency(promotion.discount_value)}
                      </span>
                    </div>
                    {promotion.max_discount && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Giảm tối đa (Cap):</span>
                        <span className="font-bold text-gray-900">{formatCurrency(promotion.max_discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Thời gian bắt đầu:</span>
                      <span className="font-semibold text-gray-800">
                        {promotion.starts_at ? new Date(promotion.starts_at).toLocaleString("vi-VN") : "Ngay lập tức"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Thời gian kết thúc:</span>
                      <span className="font-semibold text-gray-800">
                        {promotion.ends_at ? new Date(promotion.ends_at).toLocaleString("vi-VN") : "Vô thời hạn"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900">Mô tả & AI Intent</h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <div>
                      <span className="text-gray-500 font-medium block mb-1">Mô tả chương trình:</span>
                      <p className="text-gray-800">{promotion.description || "Không có mô tả"}</p>
                    </div>
                    {promotion.intent && (
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-gray-500 font-medium block mb-1">AI Prompt Intent:</span>
                        <p className="text-indigo-900 font-medium italic bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          "{promotion.intent}"
                        </p>
                      </div>
                    )}
                    {promotion.ai_reasoning && (
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-gray-500 font-medium block mb-1">AI Reasoning:</span>
                        <p className="text-gray-600 italic">{promotion.ai_reasoning}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TARGET SCOPES & EXCLUSIONS */}
          {activeTab === "scopes" && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Danh sách quy tắc phạm vi áp dụng</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Loại đối tượng</th>
                      <th className="px-4 py-3">Mã Target ID</th>
                      <th className="px-4 py-3">Tác dụng quy tắc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {!promotion.scopes || promotion.scopes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                          Áp dụng cho tất cả sản phẩm (Default ALL)
                        </td>
                      </tr>
                    ) : (
                      promotion.scopes.map((s, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {s.scope_type === "ALL" ? "Tất cả sản phẩm" : s.scope_type}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700">
                            {s.target_id || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {s.is_exclusion ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                Loại trừ (Exclusion)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Bao gồm (Inclusion)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AFFECTED VARIANTS & COMPUTED PRICES TABLE */}
          {activeTab === "variants" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">
                  Biến thể bị ảnh hưởng & Bảng giá tính toán
                </h3>
                {loadingPreview && (
                  <span className="text-xs text-brand-primary font-medium">Đang cập nhật bảng giá...</span>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Mã SKU / Biến thể</th>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3 text-right">Giá gốc</th>
                      <th className="px-4 py-3 text-right">Giá sau khuyến mãi</th>
                      <th className="px-4 py-3 text-right">Mức tiết kiệm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {!previewData || previewData.sample_variants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          Chưa có dữ liệu biến thể bị ảnh hưởng hoặc chương trình chưa tính toán giá
                        </td>
                      </tr>
                    ) : (
                      previewData.sample_variants.map((v, idx) => (
                        <tr key={v.variant_id || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-medium text-gray-700">
                            {v.sku_code || v.variant_id}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {v.product_name || "Sản phẩm"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 line-through">
                            {formatCurrency(v.original_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {formatCurrency(v.computed_price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                              -{v.percentage_discount ? `${Math.round(v.percentage_discount)}%` : formatCurrency(v.discount_amount)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
