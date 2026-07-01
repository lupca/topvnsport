"use client";

import React, { useState, useEffect } from "react";
import { api, Channel } from "@/utils/api";
import { Plus, Search, Edit2, Trash2, X, AlertCircle, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const channelSchema = z.object({
  code: z.string().min(1, "Mã kênh là bắt buộc").transform(val => val.toUpperCase()),
  name: z.string().min(1, "Tên kênh là bắt buộc"),
  is_active: z.boolean().default(true),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
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
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Form hook
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      code: "",
      name: "",
      is_active: true,
    },
  });

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
  }, [page, searchQuery]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const url = `/channels?page=${page}&limit=${limit}` + (searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "");
      const res = await api.get<any>(url);
      setChannels(res.items || []);
      setTotalPages(res.pages || 1);
      setTotalItems(res.total || 0);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Không thể tải danh sách kênh bán hàng.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    reset({ code: "", name: "", is_active: true });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (channel: Channel) => {
    setSelectedChannel(channel);
    reset({
      code: channel.code,
      name: channel.name,
      is_active: channel.is_active,
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreateChannelSubmit = async (data: ChannelFormValues) => {
    try {
      setFormError(null);
      await api.post<Channel>("/channels", data);
      setIsCreateOpen(false);
      setPage(1);
      fetchChannels();
    } catch (err: any) {
      setFormError(err.message || "Tạo kênh thất bại.");
    }
  };

  const handleUpdateChannelSubmit = async (data: ChannelFormValues) => {
    if (!selectedChannel) return;
    try {
      setFormError(null);
      await api.put<Channel>(`/channels/${selectedChannel.id}`, data);
      setIsEditOpen(false);
      setSelectedChannel(null);
      fetchChannels();
    } catch (err: any) {
      setFormError(err.message || "Cập nhật kênh thất bại.");
    }
  };

  const handleDeleteChannel = async (id: number) => {
    if (confirm("Bạn có chắc chắn muốn xóa kênh bán hàng này?")) {
      try {
        await api.delete(`/channels/${id}`);
        fetchChannels();
      } catch (err: any) {
        alert("Xóa kênh thất bại: " + err.message);
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>Kênh bán hàng (Channels)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý các kênh phân phối đơn hàng tích hợp.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Kênh bán hàng</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên kênh..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-100 transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 font-bold uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Mã kênh (Code)</th>
                <th className="px-6 py-4">Tên kênh (Name)</th>
                <th className="px-6 py-4">Trạng thái hoạt động</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Đang tải danh sách kênh...
                  </td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Không tìm thấy kênh bán hàng nào.
                  </td>
                </tr>
              ) : (
                channels.map((channel) => (
                  <tr key={channel.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">{channel.code}</td>
                    <td className="px-6 py-4 text-slate-200 font-semibold">{channel.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        channel.is_active
                          ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {channel.is_active ? "Hoạt động" : "Ngừng hoạt động"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(channel)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg font-semibold transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-900 text-slate-200 hover:text-rose-400 rounded-lg font-semibold transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
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
          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>
              Hiển thị {channels.length} trên {totalItems} kênh bán hàng
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-100">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h2 className="text-sm font-bold text-slate-200">Thêm Kênh mới</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleCreateChannelSubmit)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950 border border-rose-900 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Mã kênh (Code) *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: SHOPEE, TIKTOK_SHOP"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-[10px] text-rose-400 font-bold">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Tên kênh *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Shopee Mall, TikTok Shop Global"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[10px] text-rose-400 font-bold">{errors.name.message}</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active_create"
                  className="w-4 h-4 text-indigo-600 bg-slate-955 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500 cursor-pointer"
                  {...register("is_active")}
                />
                <label htmlFor="is_active_create" className="text-xs font-semibold text-slate-200 cursor-pointer">
                  Kích hoạt hoạt động kênh này
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-800 transition-colors"
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

      {/* Edit Channel Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-slate-100">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h2 className="text-sm font-bold text-slate-200">Cập nhật Kênh bán hàng</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(handleUpdateChannelSubmit)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950 border border-rose-900 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Mã kênh (Code) *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: SHOPEE"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-[10px] text-rose-400 font-bold">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Tên kênh *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Shopee"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[10px] text-rose-400 font-bold">{errors.name.message}</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active_edit"
                  className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500 cursor-pointer"
                  {...register("is_active")}
                />
                <label htmlFor="is_active_edit" className="text-xs font-semibold text-slate-200 cursor-pointer">
                  Kích hoạt hoạt động kênh này
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-800 transition-colors"
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
