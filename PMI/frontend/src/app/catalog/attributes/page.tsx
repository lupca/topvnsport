"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/ui/DataTable";
import { Sliders, X, Check, AlertCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService, showConfirm } from "@/components/ui/popupService";
import { fetchWithAuth, apiClient } from "@/utils/apiClient";

interface Attribute {
  id: number;
  code: string;
  name: string;
  type: string;
  is_required: boolean;
  is_unique: boolean;
  is_locale_based: boolean;
  is_channel_based: boolean;
  created_at: string;
}

export default function AttributesPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<Attribute | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isLocaleBased, setIsLocaleBased] = useState(false);
  const [isChannelBased, setIsChannelBased] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAttributes = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth("/attributes");
      setAttributes(data);
    } catch (err) {
      console.error("Failed to fetch attributes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  const handleOpenAdd = () => {
    setEditingAttr(null);
    setCode("");
    setName("");
    setType("text");
    setIsRequired(false);
    setIsUnique(false);
    setIsLocaleBased(false);
    setIsChannelBased(false);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleOpenEdit = (attr: Attribute) => {
    setEditingAttr(attr);
    setCode(attr.code);
    setName(attr.name);
    setType(attr.type);
    setIsRequired(attr.is_required);
    setIsUnique(attr.is_unique);
    setIsLocaleBased(attr.is_locale_based);
    setIsChannelBased(attr.is_channel_based);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleDelete = async (attr: Attribute) => {
    if (!(await showConfirm(`Bạn có chắc chắn muốn xóa thuộc tính "${attr.name}" (${attr.code}) không?`))) {
      return;
    }
    try {
      await apiClient.delete(`/attributes/${attr.id}`);
      fetchAttributes();
    } catch (err: any) {
      console.error(err);
      void popupService.alert(err.message || "Không thể xóa thuộc tính này.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Mã và Tên thuộc tính.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    
    const payload = {
      code: code.trim(),
      name: name.trim(),
      type,
      is_required: isRequired,
      is_unique: isUnique,
      is_locale_based: isLocaleBased,
      is_channel_based: isChannelBased,
    };

    try {
      const path = editingAttr 
        ? `/attributes/${editingAttr.id}`
        : "/attributes";
      const method = editingAttr ? "PUT" : "POST";

      if (method === "PUT") {
        await apiClient.put(path, payload);
      } else {
        await apiClient.post(path, payload);
      }
      setIsOpen(false);
      fetchAttributes();
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi lưu thuộc tính.");
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side search and pagination
  const filteredAttributes = attributes.filter(
    (attr) =>
      attr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attr.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attr.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredAttributes.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedData = filteredAttributes.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  const columns = [
    {
      key: "code",
      label: "Mã Code",
      render: (item: Attribute) => (
        <span className="font-mono text-xs text-brand-primary bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
          {item.code}
        </span>
      ),
    },
    {
      key: "name",
      label: "Tên thuộc tính",
      render: (item: Attribute) => (
        <span className="font-semibold text-gray-900">{item.name}</span>
      ),
    },
    {
      key: "type",
      label: "Kiểu dữ liệu",
      render: (item: Attribute) => {
        const typeLabels: Record<string, string> = {
          text: "Văn bản ngắn (Text)",
          textarea: "Văn bản dài (Textarea)",
          select: "Lựa chọn (Select)",
          decimal: "Số thập phân (Decimal)",
          boolean: "Đúng/Sai (Boolean)",
        };
        return <span className="text-gray-600">{typeLabels[item.type] || item.type}</span>;
      },
    },
    {
      key: "is_required",
      label: "Bắt buộc",
      render: (item: Attribute) =>
        item.is_required ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-brand-primary text-amber-700 border border-brand-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            <Check className="w-3 h-3" /> Bắt buộc
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "is_unique",
      label: "Duy nhất",
      render: (item: Attribute) =>
        item.is_unique ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            <Check className="w-3 h-3" /> Duy nhất
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: "is_locale_based",
      label: "Dịch theo Locale",
      render: (item: Attribute) =>
        item.is_locale_based ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Có
          </span>
        ) : (
          <span className="text-gray-500">Không</span>
        ),
    },
    {
      key: "is_channel_based",
      label: "Theo Channel",
      render: (item: Attribute) =>
        item.is_channel_based ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Có
          </span>
        ) : (
          <span className="text-gray-500">Không</span>
        ),
    },
    {
      key: "created_at",
      label: "Ngày tạo",
      render: (item: Attribute) => (
        <span className="text-gray-500 font-medium">
          {item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN") : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="pim-page text-gray-700">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-brand-primary" />
            <span>Catalog</span>
            <span>/</span>
            <span className="text-brand-primary">Thuộc tính (Attributes)</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Thuộc tính sản phẩm</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Quản lý các thuộc tính động của sản phẩm (ví dụ: Tên, SKU, Kích thước, Màu sắc) để xây dựng hệ thống PIM đồng nhất.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable<Attribute>
        title="Danh sách thuộc tính"
        description="Toàn bộ các thuộc tính dùng để mô tả thông tin sản phẩm và phân loại biến thể."
        data={paginatedData}
        columns={columns}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onAddClick={handleOpenAdd}
        addLabel="Tạo Thuộc Tính"
        onEditClick={handleOpenEdit}
        onDeleteClick={handleDelete}
        pagination={{
          currentPage,
          totalPages,
          limit,
          totalItems,
          onPageChange: (p) => setCurrentPage(p),
          onLimitChange: (l) => {
            setLimit(l);
            setCurrentPage(1);
          },
        }}
      />

      {/* Modal Popup */}
      {isOpen && (
        <div className="pim-modal-backdrop z-50">
          <div className="w-full max-w-xl bg-surface border border-gray-200 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 tracking-wide">
                {editingAttr ? "Chỉnh Sửa Thuộc Tính" : "Tạo Thuộc Tính Mới"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="btn-icon p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Mã Code <span className="text-brand-primary">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: color, screen_size"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      disabled={editingAttr !== null}
                      className="pim-input disabled:opacity-50 disabled:bg-gray-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Tên thuộc tính <span className="text-brand-primary">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Màu Sắc, Kích Thước Màn Hình"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pim-input"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Kiểu dữ liệu
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="pim-input"
                  >
                    <option value="text">Văn bản ngắn (Text)</option>
                    <option value="textarea">Văn bản dài (Textarea)</option>
                    <option value="select">Lựa chọn (Select)</option>
                    <option value="decimal">Số thập phân (Decimal)</option>
                    <option value="boolean">Đúng/Sai (Boolean)</option>
                  </select>
                </div>

                {/* Configuration Checkboxes */}
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-200 pb-2">
                    Thiết lập Ràng buộc & Phạm vi
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        onChange={(e) => setIsRequired(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-brand-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          Bắt buộc (Required)
                        </span>
                        <p className="text-[10px] text-gray-500">Bắt buộc nhập dữ liệu này</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={isUnique}
                        onChange={(e) => setIsUnique(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-brand-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          Duy nhất (Unique)
                        </span>
                        <p className="text-[10px] text-gray-500">Không trùng lặp giữa các sp</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={isLocaleBased}
                        onChange={(e) => setIsLocaleBased(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-brand-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          Dịch theo ngôn ngữ
                        </span>
                        <p className="text-[10px] text-gray-500">Dữ liệu dịch theo locale</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={isChannelBased}
                        onChange={(e) => setIsChannelBased(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-200 bg-gray-50 text-brand-secondary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          Theo kênh bán hàng
                        </span>
                        <p className="text-[10px] text-gray-500">Giá trị khác nhau ở mỗi kênh</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary disabled:opacity-50 text-gray-900 text-xs font-semibold px-4 py-2 rounded-lg active:scale-95 shadow-md shadow-sm hover:shadow-sm transition-all duration-200"
                >
                  {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
