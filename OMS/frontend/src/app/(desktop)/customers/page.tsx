"use client";

import React, { useState, useEffect } from "react";
import { api, Customer } from "@/utils/api";
import { Plus, Search, Edit2, Trash2, X, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { popupService, showConfirm } from "@/components/ui/popupService";

const customerSchema = z.object({
  name: z.string().min(1, "Tên khách hàng là bắt buộc"),
  phone: z.string().min(1, "Số điện thoại là bắt buộc").regex(/^\d+$/, "Số điện thoại chỉ được chứa số"),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  address: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form hook
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [page, searchQuery]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = `/customers?page=${page}&limit=${limit}` + (searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "");
      const res = await api.get<any>(url);
      setCustomers(res.items || []);
      setTotalPages(res.pages || 1);
      setTotalItems(res.total || 0);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Không thể tải danh sách khách hàng.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    reset({ name: "", phone: "", email: "", address: "" });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreateCustomerSubmit = async (data: CustomerFormValues) => {
    try {
      setFormError(null);
      await api.post<Customer>("/customers", {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined
      });
      setIsCreateOpen(false);
      setPage(1);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || "Tạo khách hàng thất bại.");
    }
  };

  const handleUpdateCustomerSubmit = async (data: CustomerFormValues) => {
    if (!selectedCustomer) return;
    try {
      setFormError(null);
      await api.put<Customer>(`/customers/${selectedCustomer.id}`, {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined
      });
      setIsEditOpen(false);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || "Cập nhật khách hàng thất bại.");
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (await showConfirm("Bạn có chắc chắn muốn xóa khách hàng này?")) {
      try {
        await api.delete(`/customers/${id}`);
        fetchCustomers();
      } catch (err: any) {
        void popupService.alert("Xóa khách hàng thất bại: " + err.message);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-gray-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Quản lý Khách hàng</h2>
          <p className="text-xs text-gray-500 mt-1">
            Danh sách khách hàng trên toàn hệ thống OMS.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Khách hàng</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, số điện thoại, email..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold uppercase text-gray-500">
              <tr>
                <th className="px-6 py-4">Tên khách hàng</th>
                <th className="px-6 py-4">Số điện thoại</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Địa chỉ</th>
                <th className="px-6 py-4">Ngày tạo</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Đang tải danh sách khách hàng...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Không tìm thấy khách hàng nào.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4 font-mono text-gray-800">{customer.phone}</td>
                    <td className="px-6 py-4 text-gray-600">{customer.email || "-"}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{customer.address || "-"}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(customer)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg font-semibold transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-gray-700 hover:text-rose-600 rounded-lg font-semibold transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                        <span>Xóa</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && totalItems > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>
              Hiển thị {customers.length} trên {totalItems} khách hàng
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-gray-800">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 text-gray-800">
          <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Thêm Khách hàng mới</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateCustomerSubmit)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Tên Khách hàng <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Số điện thoại <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập số điện thoại"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="Nhập địa chỉ email (tùy chọn)"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Địa chỉ</label>
                <textarea
                  placeholder="Nhập địa chỉ giao hàng (tùy chọn)"
                  rows={3}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900"
                  {...register("address")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 text-gray-800">
          <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">Cập nhật Khách hàng</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleUpdateCustomerSubmit)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Tên Khách hàng <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Số điện thoại <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập số điện thoại"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="Nhập địa chỉ email (tùy chọn)"
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-[10px] text-rose-600 font-bold">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Địa chỉ</label>
                <textarea
                  placeholder="Nhập địa chỉ giao hàng (tùy chọn)"
                  rows={3}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900"
                  {...register("address")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
