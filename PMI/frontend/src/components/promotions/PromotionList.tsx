"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Play,
  Pause,
  StopCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Promotion, PromotionStatus } from "@/types/promotion";
import {
  getPromotions,
  deletePromotion,
  activatePromotion,
  pausePromotion,
  resumePromotion,
  endPromotion,
} from "@/services/promotionApi";
import { popupService } from "@/components/ui/popupService";

export default function PromotionList() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPromotionsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPromotions({
        status: activeTab,
        search: searchQuery,
        page,
        limit: 10,
      });
      setPromotions(res.items || []);
      setTotalPages(res.pages || 1);
      setTotalItems(res.total || 0);
    } catch (err: any) {
      console.error("Failed to load promotions", err);
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, page]);

  useEffect(() => {
    fetchPromotionsData();
  }, [fetchPromotionsData]);

  const handleTabChange = (status: string) => {
    setActiveTab(status);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPromotionsData();
  };

  const handleActivate = async (id: string) => {
    setActionLoadingId(id);
    try {
      await activatePromotion(id);
      await fetchPromotionsData();
    } catch (err: any) {
      await popupService.alert(`Lỗi kích hoạt: ${err.message || "Không thể kích hoạt"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoadingId(id);
    try {
      await pausePromotion(id);
      await fetchPromotionsData();
    } catch (err: any) {
      await popupService.alert(`Lỗi tạm dừng: ${err.message || "Không thể tạm dừng"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoadingId(id);
    try {
      await resumePromotion(id);
      await fetchPromotionsData();
    } catch (err: any) {
      await popupService.alert(`Lỗi tiếp tục: ${err.message || "Không thể tiếp tục"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEnd = async (id: string) => {
    const confirmed = await popupService.confirm("Bạn có chắc chắn muốn kết thúc chương trình khuyến mãi này?");
    if (!confirmed) return;
    setActionLoadingId(id);
    try {
      await endPromotion(id);
      await fetchPromotionsData();
    } catch (err: any) {
      await popupService.alert(`Lỗi kết thúc: ${err.message || "Không thể kết thúc"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await popupService.confirm(`Bạn có chắc chắn muốn xóa khuyến mãi "${name}"?`);
    if (!confirmed) return;
    setActionLoadingId(id);
    try {
      await deletePromotion(id);
      await fetchPromotionsData();
    } catch (err: any) {
      await popupService.alert(`Lỗi xóa: ${err.message || "Không thể xóa khuyến mãi"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDiscount = (type: string, value: number, maxDiscount?: number | null) => {
    if (type === "PERCENTAGE") {
      const maxStr = maxDiscount ? ` (tối đa ${new Intl.NumberFormat("vi-VN").format(maxDiscount)}đ)` : "";
      return `-${value}%${maxStr}`;
    }
    if (type === "FIXED_AMOUNT") {
      return `-${new Intl.NumberFormat("vi-VN").format(value)}đ`;
    }
    if (type === "FIXED_PRICE") {
      return `${new Intl.NumberFormat("vi-VN").format(value)}đ (Giá cố định)`;
    }
    return `${value}`;
  };

  const formatScope = (promo: Promotion) => {
    if (!promo.scopes || promo.scopes.length === 0) {
      return "Tất cả sản phẩm";
    }
    const mainScope = promo.scopes.find((s) => !s.is_exclusion);
    if (mainScope) {
      if (mainScope.scope_type === "ALL") return "Tất cả sản phẩm";
      if (mainScope.scope_type === "CATEGORY") return "Theo danh mục";
      if (mainScope.scope_type === "PRODUCT") return "Theo sản phẩm";
      if (mainScope.scope_type === "VARIANT") return "Theo biến thể";
      return mainScope.scope_type;
    }
    const exclusionScopes = promo.scopes.filter((s) => s.is_exclusion);
    if (exclusionScopes.length > 0) {
      const types = Array.from(
        new Set(
          exclusionScopes.map((s) => {
            if (s.scope_type === "CATEGORY") return "danh mục";
            if (s.scope_type === "PRODUCT") return "sản phẩm";
            if (s.scope_type === "VARIANT") return "biến thể";
            return s.scope_type;
          })
        )
      ).join(", ");
      return `Ngoại trừ: ${types}`;
    }
    return "Tất cả sản phẩm";
  };

  const formatDateRange = (startsAt?: string | null, endsAt?: string | null) => {
    if (!startsAt && !endsAt) return "Vô thời hạn";
    const start = startsAt ? new Date(startsAt).toLocaleDateString("vi-VN") : "...";
    const end = endsAt ? new Date(endsAt).toLocaleDateString("vi-VN") : "Vô thời hạn";
    return `${start} - ${end}`;
  };

  const renderStatusBadge = (status: PromotionStatus) => {
    const config: Record<PromotionStatus, { bg: string; text: string; label: string; icon: any }> = {
      DRAFT: { bg: "bg-gray-100 border-gray-200", text: "text-gray-700", label: "Bản nháp", icon: Clock },
      SCHEDULED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Lên lịch", icon: Clock },
      ACTIVE: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Đang chạy", icon: CheckCircle },
      PAUSED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Tạm dừng", icon: AlertCircle },
      ENDED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Kết thúc", icon: StopCircle },
    };
    const cfg = config[status] || { bg: "bg-gray-100 border-gray-200", text: "text-gray-700", label: status, icon: Clock };
    const Icon = cfg.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </span>
    );
  };

  const tabs = [
    { key: "ALL", label: "Tất cả" },
    { key: "DRAFT", label: "Bản nháp" },
    { key: "SCHEDULED", label: "Lên lịch" },
    { key: "ACTIVE", label: "Hoạt động" },
    { key: "PAUSED", label: "Tạm dừng" },
    { key: "ENDED", label: "Kết thúc" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
            <Tag className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Quản lý Khuyến mãi</h1>
            <p className="text-xs text-gray-500 mt-0.5">Tạo, quản lý và theo dõi các chương trình ưu đãi sản phẩm PMI</p>
          </div>
        </div>
        <Link
          href="/promotions/create"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-xs rounded-xl shadow-sm transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo khuyến mãi mới</span>
        </Link>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Status Tabs */}
        <div className="border-b border-gray-200 px-6 pt-4 flex flex-wrap gap-2 bg-gray-50/50">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                  isActive
                    ? "bg-white text-brand-primary border-brand-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-900 border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên khuyến mãi..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
            />
          </form>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => fetchPromotionsData()}
              className="p-2 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              title="Tải lại"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[300px] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full border-2 border-brand-primary/30 border-t-brand-primary animate-spin mb-2" />
              <span className="text-xs font-semibold text-gray-500">Đang tải khuyến mãi...</span>
            </div>
          )}

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4">Mã KM</th>
                <th className="px-6 py-4">Tên chương trình</th>
                <th className="px-6 py-4">Mức giảm</th>
                <th className="px-6 py-4">Phạm vi áp dụng</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Chưa có chương trình khuyến mãi nào.
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => {
                  const isLoading = actionLoadingId === promo.id;
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">
                        {promo.code}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-semibold">
                        <Link href={`/promotions/${promo.id}`} className="hover:text-brand-primary transition-colors">
                          {promo.name}
                        </Link>
                        {promo.intent && (
                          <span className="block text-[10px] text-gray-400 font-normal truncate max-w-xs" title={promo.intent}>
                            Prompt: {promo.intent}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {formatDiscount(promo.discount_type, promo.discount_value, promo.max_discount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatScope(promo)}
                      </td>
                      <td className="px-6 py-4">
                        {renderStatusBadge(promo.status)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {formatDateRange(promo.starts_at, promo.ends_at)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail */}
                          <Link
                            href={`/promotions/${promo.id}`}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-brand-primary hover:bg-gray-100 transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Edit */}
                          <Link
                            href={`/promotions/edit/${promo.id}`}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-gray-100 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          {/* Lifecycle Actions */}
                          {(promo.status === "DRAFT" || promo.status === "SCHEDULED") && (
                            <button
                              disabled={isLoading}
                              onClick={() => handleActivate(promo.id)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Kích hoạt"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {promo.status === "ACTIVE" && (
                            <button
                              disabled={isLoading}
                              onClick={() => handlePause(promo.id)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Tạm dừng"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {promo.status === "PAUSED" && (
                            <button
                              disabled={isLoading}
                              onClick={() => handleResume(promo.id)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Tiếp tục"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {(promo.status === "ACTIVE" || promo.status === "PAUSED") && (
                            <button
                              disabled={isLoading}
                              onClick={() => handleEnd(promo.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Kết thúc"
                            >
                              <StopCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            disabled={isLoading}
                            onClick={() => handleDelete(promo.id, promo.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-gray-100 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {promotions.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>
              Hiển thị <span className="font-semibold text-gray-900">{promotions.length}</span> trên{" "}
              <span className="font-semibold text-gray-900">{totalItems}</span> khuyến mãi
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Trước
              </button>
              <span className="font-medium text-gray-700">
                Trang {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
