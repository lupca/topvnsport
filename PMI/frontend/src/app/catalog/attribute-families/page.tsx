"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/ui/DataTable";
import { FolderTree, X, AlertCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService, showConfirm } from "@/components/ui/popupService";

interface Attribute {
  id: number;
  code: string;
  name: string;
}

interface AttributeFamily {
  id: number;
  code: string;
  name: string;
  attributes?: Attribute[];
  created_at: string;
}

const API_BASE = APP_SETTINGS.api.baseUrl;

export default function AttributeFamiliesPage() {
  const [families, setFamilies] = useState<AttributeFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<AttributeFamily | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([]);
  
  const [allAttributes, setAllAttributes] = useState<Attribute[]>([]);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFamilies = async () => {
    setLoading(true);
    try {
      const [resFam, resAttr] = await Promise.all([
        fetch(`${API_BASE}/attribute-families`),
        fetch(`${API_BASE}/attributes`)
      ]);
      
      if (resFam.ok) {
        const data = await resFam.json();
        setFamilies(data);
      }
      if (resAttr.ok) {
        const dataAttr = await resAttr.json();
        setAllAttributes(dataAttr);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const handleOpenAdd = () => {
    setEditingFamily(null);
    setCode("");
    setName("");
    setSelectedAttributeIds([]);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleOpenEdit = (family: AttributeFamily) => {
    setEditingFamily(family);
    setCode(family.code);
    setName(family.name);
    setSelectedAttributeIds(family.attributes?.map(a => a.id) || []);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleDelete = async (family: AttributeFamily) => {
    if (!(await showConfirm(`Bạn có chắc chắn muốn xóa họ thuộc tính "${family.name}" (${family.code}) không?`))) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/attribute-families/${family.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchFamilies();
      } else {
        void popupService.alert("Không thể xóa họ thuộc tính này.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Mã và Tên họ thuộc tính.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    
    const payload = {
      code: code.trim(),
      name: name.trim(),
    };

    try {
      const url = editingFamily 
        ? `${API_BASE}/attribute-families/${editingFamily.id}`
        : `${API_BASE}/attribute-families`;
      const method = editingFamily ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedFamily = await res.json();
        
        // Sync attributes
        const syncRes = await fetch(`${API_BASE}/attribute-families/${savedFamily.id}/attributes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attribute_ids: selectedAttributeIds }),
        });
        
        if (!syncRes.ok) {
           const errData = await syncRes.json();
           console.error("Sync failed", errData);
           setErrorMsg("Đã lưu Họ thuộc tính nhưng lỗi khi đồng bộ Thuộc tính.");
           return;
        }

        setIsOpen(false);
        fetchFamilies();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || "Đã xảy ra lỗi khi lưu họ thuộc tính.");
      }
    } catch (err) {
      setErrorMsg("Không thể kết nối đến máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side search and pagination
  const filteredFamilies = families.filter(
    (fam) =>
      fam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fam.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredFamilies.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedData = filteredFamilies.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (item: AttributeFamily) => (
        <span className="font-semibold text-gray-500">{item.id}</span>
      ),
    },
    {
      key: "code",
      label: "Mã Code",
      render: (item: AttributeFamily) => (
        <span className="font-mono text-xs text-brand-primary bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
          {item.code}
        </span>
      ),
    },
    {
      key: "name",
      label: "Tên họ thuộc tính (Family Name)",
      render: (item: AttributeFamily) => (
        <span className="font-semibold text-gray-900">{item.name}</span>
      ),
    },
    {
      key: "attributes",
      label: "Thuộc tính được gán",
      render: (item: AttributeFamily) => (
        <div className="flex flex-wrap gap-1">
          {item.attributes && item.attributes.length > 0 ? (
            item.attributes.map(attr => (
              <span key={attr.id} className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                {attr.name}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-xs italic">Chưa gán</span>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      label: "Ngày tạo",
      render: (item: AttributeFamily) => (
        <span className="text-gray-500 font-medium">
          {item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN") : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 pim-page text-gray-700">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <FolderTree className="w-4 h-4 text-brand-primary" />
            <span>Catalog</span>
            <span>/</span>
            <span className="text-brand-primary">Họ thuộc tính (Families)</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Họ thuộc tính</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Định nghĩa bộ khung các thuộc tính bắt buộc đi liền với loại sản phẩm cụ thể (ví dụ: Điện thoại cần CPU, RAM; Quần áo cần Kích cỡ, Chất liệu).
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable<AttributeFamily>
        title="Danh sách họ thuộc tính"
        description="Quản lý cấu trúc mẫu thuộc tính dùng chung để áp dụng hàng loạt lên sản phẩm."
        data={paginatedData}
        columns={columns}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onAddClick={handleOpenAdd}
        addLabel="Tạo Họ Thuộc Tính"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-gray-200 rounded-2xl shadow-2xl overflow-hidden duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 tracking-wide">
                {editingFamily ? "Chỉnh Sửa Họ Thuộc Tính" : "Tạo Họ Thuộc Tính"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Mã Code <span className="text-brand-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: default, phones_family"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    disabled={editingFamily !== null}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-primary disabled:opacity-50 disabled:bg-gray-50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Tên họ thuộc tính <span className="text-brand-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Mặc Định, Thiết Bị Số"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-primary transition-colors"
                  />
                </div>

                {/* Attributes Selection */}
                <div className="space-y-2 mt-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Các thuộc tính được gán
                  </label>
                  <div className="border border-gray-200 bg-gray-50 rounded-lg max-h-48 overflow-y-auto p-2">
                    {allAttributes.length === 0 ? (
                      <div className="text-xs text-gray-500 p-2 italic">Chưa có thuộc tính nào trong hệ thống.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {allAttributes.map((attr) => (
                          <label key={attr.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={selectedAttributeIds.includes(attr.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttributeIds([...selectedAttributeIds, attr.id]);
                                } else {
                                  setSelectedAttributeIds(selectedAttributeIds.filter((id) => id !== attr.id));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-brand-primary focus:ring-0"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-700">{attr.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{attr.code}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
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
