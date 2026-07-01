"use client";

import React, { useEffect, useState } from "react";
import DataTable from "@/components/ui/DataTable";
import { FolderTree, X, AlertCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface Category {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  display_name: string;
  created_at: string;
}

const API_BASE = APP_SETTINGS.api.baseUrl;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setCode("");
    setName("");
    setParentId(null);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setCode(cat.code);
    setName(cat.name);
    setParentId(cat.parent_id);
    setErrorMsg("");
    setIsOpen(true);
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${cat.name}" (${cat.code}) cùng tất cả danh mục con của nó không?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/categories/${cat.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCategories();
      } else {
        alert("Không thể xóa danh mục này.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Mã và Tên danh mục.");
      return;
    }

    if (editingCategory && parentId === editingCategory.id) {
      setErrorMsg("Một danh mục không thể làm cha của chính nó.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    
    const payload = {
      code: code.trim(),
      name: name.trim(),
      parent_id: parentId || null,
    };

    try {
      const url = editingCategory 
        ? `${API_BASE}/categories/${editingCategory.id}`
        : `${API_BASE}/categories`;
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsOpen(false);
        fetchCategories();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || "Đã xảy ra lỗi khi lưu danh mục.");
      }
    } catch (err) {
      setErrorMsg("Không thể kết nối đến máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  // Client-side search and pagination
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredCategories.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedData = filteredCategories.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (item: Category) => (
        <span className="font-semibold text-slate-400">{item.id}</span>
      ),
    },
    {
      key: "code",
      label: "Mã Code",
      render: (item: Category) => (
        <span className="font-mono text-xs text-indigo-400 bg-indigo-950/40 border border-indigo-900/60 px-2 py-0.5 rounded">
          {item.code}
        </span>
      ),
    },
    {
      key: "display_name",
      label: "Đường dẫn phân cấp (Display Name)",
      render: (item: Category) => (
        <span className="font-semibold text-white tracking-wide">{item.display_name}</span>
      ),
    },
    {
      key: "created_at",
      label: "Ngày tạo",
      render: (item: Category) => (
        <span className="text-slate-400 font-medium">
          {item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN") : "-"}
        </span>
      ),
    },
  ];

  // Exclude current editing category and its descendants to avoid cycle (simple filter)
  const availableParents = categories.filter(
    (c) => !editingCategory || c.id !== editingCategory.id
  );

  return (
    <div className="p-8 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <FolderTree className="w-4 h-4 text-indigo-500" />
            <span>Catalog</span>
            <span>/</span>
            <span className="text-indigo-400">Danh mục (Categories)</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Danh mục sản phẩm</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Quản lý cây danh mục sản phẩm của hệ thống PIM để phân loại và điều hướng danh mục hàng hóa chính xác.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable<Category>
        title="Danh sách danh mục"
        description="Toàn bộ sơ đồ phân cấp danh mục hàng hóa trong hệ thống."
        data={paginatedData}
        columns={columns}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onAddClick={handleOpenAdd}
        addLabel="Tạo Danh Mục"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="text-base font-bold text-white tracking-wide">
                {editingCategory ? "Chỉnh Sửa Danh Mục" : "Tạo Danh Mục Mới"}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Mã Code <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: fashion, electronics_sub"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    disabled={editingCategory !== null}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-950 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Tên danh mục <span className="text-indigo-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thiết Bị Điện Tử, Phụ Kiện Nam"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Danh mục cha (Parent Category)
                  </label>
                  <select
                    value={parentId || ""}
                    onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">[Không có - Danh mục gốc (Root)]</option>
                    {availableParents.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold active:scale-95 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg active:scale-95 shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200"
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
