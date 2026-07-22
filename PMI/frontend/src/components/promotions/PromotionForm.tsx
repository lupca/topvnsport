"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Tag,
  Percent,
  Calendar,
  Layers,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  Info,
} from "lucide-react";
import {
  Promotion,
  DiscountType,
  ScopeType,
  PromotionScope,
  PreviewResponse,
} from "@/types/promotion";
import {
  createPromotion,
  updatePromotion,
  parsePromotionIntent,
  previewPromotion,
} from "@/services/promotionApi";
import PromotionPreviewModal from "./PromotionPreviewModal";
import { popupService } from "@/components/ui/popupService";

interface PromotionFormProps {
  initialData?: Promotion;
  isEdit?: boolean;
}

export default function PromotionForm({ initialData, isEdit = false }: PromotionFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);

  // Form Fields
  const [name, setName] = useState<string>(initialData?.name || "");
  const [code, setCode] = useState<string>(initialData?.code || "");
  const [description, setDescription] = useState<string>(initialData?.description || "");
  const [intent, setIntent] = useState<string>(initialData?.intent || "");
  const [aiReasoning, setAiReasoning] = useState<string>(initialData?.ai_reasoning || "");
  
  const [discountType, setDiscountType] = useState<DiscountType>(initialData?.discount_type || "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<number>(initialData?.discount_value ?? 10);
  const [maxDiscount, setMaxDiscount] = useState<number | undefined>(initialData?.max_discount ?? undefined);
  const [priority, setPriority] = useState<number>(initialData?.priority ?? 0);

  const [scopes, setScopes] = useState<PromotionScope[]>(
    initialData?.scopes || [{ scope_type: "ALL", target_id: null, is_exclusion: false }]
  );

  const formatISOToLocalInput = (iso?: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const pad = (n: number) => (n < 10 ? `0${n}` : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  };

  const [startsAt, setStartsAt] = useState<string>(formatISOToLocalInput(initialData?.starts_at));
  const [endsAt, setEndsAt] = useState<string>(formatISOToLocalInput(initialData?.ends_at));

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [parsingIntent, setParsingIntent] = useState<boolean>(false);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // New Scope Input State
  const [newScopeType, setNewScopeType] = useState<ScopeType>("CATEGORY");
  const [newTargetId, setNewTargetId] = useState<string>("");
  const [newIsExclusion, setNewIsExclusion] = useState<boolean>(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setDescription(initialData.description || "");
      setIntent(initialData.intent || "");
      setAiReasoning(initialData.ai_reasoning || "");
      setDiscountType(initialData.discount_type || "PERCENTAGE");
      setDiscountValue(initialData.discount_value ?? 10);
      setMaxDiscount(initialData.max_discount ?? undefined);
      setPriority(initialData.priority ?? 0);
      setScopes(initialData.scopes || [{ scope_type: "ALL", target_id: null, is_exclusion: false }]);
      setStartsAt(formatISOToLocalInput(initialData.starts_at));
      setEndsAt(formatISOToLocalInput(initialData.ends_at));
    }
  }, [initialData]);

  // AI Intent Parsing
  const handleParseIntent = async () => {
    if (!intent.trim()) {
      setErrors({ ...errors, intent: "Vui lòng nhập mô tả bằng văn bản tự nhiên để phân tích" });
      return;
    }
    setErrors({});
    setParsingIntent(true);
    setParseSuccessMsg(null);

    try {
      const res = await parsePromotionIntent({ prompt: intent });
      if (res.name) setName(res.name);
      if (res.code) setCode(res.code);
      if (res.description) setDescription(res.description);
      if (res.discount_type) setDiscountType(res.discount_type);
      if (res.discount_value !== undefined) setDiscountValue(res.discount_value);
      if (res.max_discount !== undefined && res.max_discount !== null) setMaxDiscount(res.max_discount);
      if (res.priority !== undefined) setPriority(res.priority);
      if (res.scopes && res.scopes.length > 0) setScopes(res.scopes);
      if (res.starts_at) setStartsAt(formatISOToLocalInput(res.starts_at));
      if (res.ends_at) setEndsAt(formatISOToLocalInput(res.ends_at));
      if (res.ai_reasoning) setAiReasoning(res.ai_reasoning);

      setParseSuccessMsg("Đã phân tích thông tin khuyến mãi từ AI thành công!");
    } catch (err: any) {
      console.error("Parse intent error", err);
      setErrors({ ...errors, intent: `Không thể phân tích prompt: ${err.message || "Lỗi server"}` });
    } finally {
      setParsingIntent(false);
    }
  };

  // Step Validation
  const validateStep = (currentStep: number): boolean => {
    const newErr: Record<string, string> = {};
    if (currentStep === 1) {
      if (!name.trim()) newErr.name = "Tên khuyến mãi không được để trống";
      if (!code.trim()) newErr.code = "Mã khuyến mãi không được để trống";
    }
    if (currentStep === 2) {
      if (discountValue < 0 || isNaN(discountValue)) {
        newErr.discountValue = "Giá trị giảm phải là số >= 0";
      }
      if (discountType === "PERCENTAGE" && discountValue > 100) {
        newErr.discountValue = "Phần trăm giảm giá không được vượt quá 100%";
      }
      if (
        discountType === "PERCENTAGE" &&
        maxDiscount !== undefined &&
        maxDiscount !== null &&
        !isNaN(maxDiscount) &&
        maxDiscount <= 0
      ) {
        newErr.maxDiscount = "Mức giảm tối đa phải là số > 0";
      }
    }
    if (currentStep === 4) {
      if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
        newErr.endsAt = "Thời gian kết thúc phải lớn hơn thời gian bắt đầu";
      }
    }
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
    }
  };

  const handlePrevStep = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  // Scope Management
  const handleAddScope = () => {
    if (newScopeType !== "ALL" && !newTargetId.trim()) {
      setErrors({ scope: "Vui lòng nhập Mã đối tượng (Target ID)" });
      return;
    }
    setErrors({});

    // If adding ALL (inclusion), replace existing ALL inclusions
    if (newScopeType === "ALL" && !newIsExclusion) {
      const existingExclusions = scopes.filter((s) => s.is_exclusion);
      setScopes([{ scope_type: "ALL", target_id: null, is_exclusion: false }, ...existingExclusions]);
    } else {
      // Remove default ALL if adding targeted inclusions
      let updated = scopes.filter((s) => !(s.scope_type === "ALL" && !s.is_exclusion));
      updated.push({
        scope_type: newScopeType,
        target_id: newScopeType === "ALL" ? null : newTargetId.trim(),
        is_exclusion: newIsExclusion,
      });
      if (updated.length === 0) {
        updated = [{ scope_type: "ALL", target_id: null, is_exclusion: false }];
      }
      setScopes(updated);
    }

    setNewTargetId("");
  };

  const handleRemoveScope = (index: number) => {
    const updated = scopes.filter((_, idx) => idx !== index);
    if (updated.length === 0) {
      setScopes([{ scope_type: "ALL", target_id: null, is_exclusion: false }]);
    } else {
      setScopes(updated);
    }
  };

  // Live Preview Modal Trigger
  const handleOpenPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const payload = {
        discount_type: discountType,
        discount_value: Number(discountValue),
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        scopes,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };
      const res = await previewPromotion(payload);
      setPreviewData(res);
    } catch (err: any) {
      console.error("Preview error", err);
      setPreviewError(err.message || "Không thể lấy thông tin xem trước");
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1)) {
      setStep(1);
      return;
    }
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    if (!validateStep(3)) {
      setStep(3);
      return;
    }
    if (!validateStep(4)) {
      setStep(4);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<Promotion> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        intent: intent.trim() || null,
        ai_reasoning: aiReasoning.trim() || null,
        discount_type: discountType,
        discount_value: Number(discountValue),
        max_discount: maxDiscount ? Number(maxDiscount) : null,
        priority: Number(priority),
        scopes,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };

      if (isEdit && initialData?.id) {
        await updatePromotion(initialData.id, payload);
      } else {
        await createPromotion(payload);
      }

      router.push("/promotions");
    } catch (err: any) {
      console.error("Form submit error", err);
      await popupService.alert(`Lỗi lưu khuyến mãi: ${err.message || "Không thể lưu dữ liệu"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = [
    { num: 1, name: "Thông tin cơ bản", icon: Tag },
    { num: 2, name: "Cấu hình giảm giá", icon: Percent },
    { num: 3, name: "Phạm vi & Loại trừ", icon: Layers },
    { num: 4, name: "Lịch & Xem trước", icon: Calendar },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/promotions"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {isEdit ? `Chỉnh sửa khuyến mãi: ${initialData?.code || ""}` : "Tạo chương trình Khuyến mãi mới"}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? "Cập nhật cấu hình và phạm vi ưu đãi" : "Quy trình 4 bước thiết lập chương trình ưu đãi sản phẩm PMI"}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stepLabels.map((s) => {
            const Icon = s.icon;
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < step || validateStep(step)) {
                    setStep(s.num);
                  }
                }}
                className={`p-3 rounded-xl flex items-center gap-3 transition-all border text-left ${
                  isCurrent
                    ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-bold shadow-sm"
                    : isDone
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-700 font-semibold"
                    : "bg-gray-50 border-gray-200 text-gray-400 font-medium hover:bg-gray-100"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent
                      ? "bg-brand-primary text-white"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider block font-bold">Bước {s.num}</span>
                  <span className="text-xs truncate block">{s.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* STEP 1: Basic Information */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-base font-bold text-gray-900">Bước 1: Thông tin cơ bản & Ý tưởng AI</h2>
              <p className="text-xs text-gray-500">Nhập tên chương trình hoặc sử dụng AI để tự động điền các thông số</p>
            </div>

            {/* AI Prompt Intent Input */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-pink-50/40 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Yêu cầu bằng văn bản tự nhiên (AI Intent Prompt)
                </label>
                <span className="text-[10px] font-semibold text-indigo-600 bg-white/80 px-2 py-0.5 rounded-full border border-indigo-100">
                  Tự động phân tích
                </span>
              </div>
              <textarea
                rows={2}
                placeholder="Ví dụ: Giảm 20% tối đa 100.000đ cho tất cả giày thể thao nam từ ngày 01/08 đến 15/08"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="w-full p-3 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] text-gray-500">
                  Nhập mô tả ưu đãi mong muốn và bấm nút phân tích để AI điền các thông tin form cho bạn.
                </p>
                <button
                  type="button"
                  disabled={parsingIntent}
                  onClick={handleParseIntent}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all shrink-0"
                >
                  {parsingIntent ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Phân tích bằng AI</span>
                    </>
                  )}
                </button>
              </div>

              {parseSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{parseSuccessMsg}</span>
                </div>
              )}
              {errors.intent && (
                <p className="text-xs text-rose-600 font-medium">{errors.intent}</p>
              )}
            </div>

            {/* Standard Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Tên chương trình khuyến mãi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Giảm giá Chào Hè 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2.5 text-xs border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.name ? "border-rose-400 focus:ring-rose-200" : "border-gray-300 focus:ring-brand-primary/20 focus:border-brand-primary"
                  }`}
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Mã khuyến mãi (Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: SUMMER2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={`w-full p-2.5 text-xs font-mono font-bold uppercase border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.code ? "border-rose-400 focus:ring-rose-200" : "border-gray-300 focus:ring-brand-primary/20 focus:border-brand-primary"
                  }`}
                />
                {errors.code && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.code}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Mô tả chương trình</label>
              <textarea
                rows={3}
                placeholder="Mô tả chi tiết thể lệ và nội dung chương trình khuyến mãi"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>

            {aiReasoning && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 space-y-1">
                <span className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" />
                  Ghi chú lập luận từ AI:
                </span>
                <p className="italic">{aiReasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Discount Configuration */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-base font-bold text-gray-900">Bước 2: Cấu hình loại và mức giảm giá</h2>
              <p className="text-xs text-gray-500">Lựa chọn hình thức giảm phần trăm, số tiền cố định hoặc đặt giá cố định</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { type: "PERCENTAGE", label: "Phần trăm (%)", desc: "Giảm theo tỷ lệ % trên giá gốc" },
                { type: "FIXED_AMOUNT", label: "Số tiền cố định (đ)", desc: "Giảm số tiền cụ thể trực tiếp" },
                { type: "FIXED_PRICE", label: "Giá bán cố định (đ)", desc: "Quy định mức giá mới cố định" },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setDiscountType(opt.type as DiscountType)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    discountType === opt.type
                      ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-bold shadow-sm"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[11px] text-gray-500 mt-1 block font-normal">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Giá trị giảm <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 text-xs font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    {discountType === "PERCENTAGE" ? "%" : "đ"}
                  </span>
                </div>
                {errors.discountValue && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.discountValue}</p>}
              </div>

              {discountType === "PERCENTAGE" && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Giảm tối đa (Cap limit)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="Không giới hạn"
                      value={maxDiscount ?? ""}
                      onChange={(e) => setMaxDiscount(e.target.value ? parseFloat(e.target.value) : undefined)}
                      className={`w-full p-2.5 text-xs border rounded-xl focus:outline-none focus:ring-2 ${
                        errors.maxDiscount ? "border-rose-400 focus:ring-rose-200" : "border-gray-300 focus:ring-brand-primary/20 focus:border-brand-primary"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">đ</span>
                  </div>
                  {errors.maxDiscount && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.maxDiscount}</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Độ ưu tiên (Priority)
                </label>
                <input
                  type="number"
                  min="0"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Chương trình có độ ưu tiên cao hơn sẽ áp dụng trước</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Scope & Exclusion Rules */}
        {step === 3 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-base font-bold text-gray-900">Bước 3: Phạm vi áp dụng & Quy tắc loại trừ</h2>
              <p className="text-xs text-gray-500">Áp dụng cho toàn bộ cửa hàng, từng danh mục, sản phẩm hoặc danh sách loại trừ</p>
            </div>

            {/* Scope Builder */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
              <span className="text-xs font-bold text-gray-800 block">Thêm quy tắc phạm vi mới:</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Loại đối tượng</label>
                  <select
                    value={newScopeType}
                    onChange={(e) => setNewScopeType(e.target.value as ScopeType)}
                    className="w-full p-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary"
                  >
                    <option value="ALL">Tất cả sản phẩm</option>
                    <option value="CATEGORY">Danh mục (Category)</option>
                    <option value="PRODUCT">Sản phẩm (Product)</option>
                    <option value="VARIANT">Biến thể (Variant)</option>
                  </select>
                </div>

                {newScopeType !== "ALL" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mã ID đối tượng</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: CAT-01 hoặc PROD-102"
                      value={newTargetId}
                      onChange={(e) => setNewTargetId(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tác dụng quy tắc</label>
                  <select
                    value={newIsExclusion ? "true" : "false"}
                    onChange={(e) => setNewIsExclusion(e.target.value === "true")}
                    className="w-full p-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-brand-primary"
                  >
                    <option value="false">Bao gồm (Áp dụng KM)</option>
                    <option value="true">Loại trừ (Không áp dụng KM)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddScope}
                    className="w-full py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm quy tắc</span>
                  </button>
                </div>
              </div>
              {errors.scope && <p className="text-xs text-rose-600 font-medium">{errors.scope}</p>}
            </div>

            {/* Scope List */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                Danh sách quy tắc phạm vi đã chọn ({scopes.length})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Loại đối tượng</th>
                      <th className="px-4 py-3">Mã Target ID</th>
                      <th className="px-4 py-3">Tác dụng</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {scopes.map((s, idx) => (
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
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveScope(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-gray-100 rounded transition-colors"
                            title="Xóa quy tắc"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Schedule & Preview */}
        {step === 4 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-base font-bold text-gray-900">Bước 4: Thời gian hiệu lực & Xem trước tác động</h2>
              <p className="text-xs text-gray-500">Thiết lập thời gian bắt đầu/kết thúc và chạy mô phỏng tính giá khuyến mãi</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Thời gian bắt đầu (Starts At)
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Bỏ trống nếu muốn áp dụng ngay khi kích hoạt</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Thời gian kết thúc (Ends At)
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className={`w-full p-2.5 text-xs border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.endsAt ? "border-rose-400 focus:ring-rose-200" : "border-gray-300 focus:ring-brand-primary/20 focus:border-brand-primary"
                  }`}
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Bỏ trống nếu chương trình không giới hạn thời gian</span>
                {errors.endsAt && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.endsAt}</p>}
              </div>
            </div>

            {/* Live Preview Button Banner */}
            <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Mô phỏng tính giá & tác động</h4>
                  <p className="text-[11px] text-indigo-700">Chạy thử tính toán mức giảm giá và số sản phẩm bị ảnh hưởng trước khi lưu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>Xem trước tác động</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Footer Action Controls */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={handlePrevStep}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isEdit ? "Cập nhật khuyến mãi" : "Lưu khuyến mãi"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Live Preview Modal */}
      <PromotionPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewData={previewData}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}
