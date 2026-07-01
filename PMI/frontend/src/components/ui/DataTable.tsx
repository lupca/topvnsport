"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Edit, Trash2, Copy } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  limit: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

interface DataTableProps<T> {
  title: string;
  description?: string;
  data: T[];
  columns: Column<T>[];
  pagination?: PaginationProps;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddClick?: () => void;
  addLabel?: string;
  onEditClick?: (item: T) => void;
  onDeleteClick?: (item: T) => void;
  onCopyClick?: (item: T) => void;
  loading?: boolean;
}

export default function DataTable<T extends { id: any }>({
  title,
  description,
  data,
  columns,
  pagination,
  searchQuery,
  onSearchChange,
  onAddClick,
  addLabel = "Thêm mới",
  onEditClick,
  onDeleteClick,
  onCopyClick,
  loading = false,
}: DataTableProps<T>) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          {onSearchChange !== undefined && (
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all duration-200"
              />
            </div>
          )}

          {/* Add New Button */}
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>{addLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[200px] relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <span className="text-xs text-indigo-400 font-medium tracking-wide">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/20 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-4 font-semibold select-none">
                  {col.label}
                </th>
              ))}
              {(onEditClick || onDeleteClick || onCopyClick) && (
                <th className="px-6 py-4 font-semibold text-right select-none">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEditClick || onDeleteClick || onCopyClick ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-500 font-medium"
                >
                  Không tìm thấy kết quả nào.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className="hover:bg-slate-800/40 text-slate-300 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 font-medium whitespace-nowrap">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                  {(onEditClick || onDeleteClick || onCopyClick) && (
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onCopyClick && (
                          <button
                            onClick={() => onCopyClick(item)}
                            title="Sao chép"
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-400 active:scale-90 transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        {onEditClick && (
                          <button
                            onClick={() => onEditClick(item)}
                            title="Chỉnh sửa"
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-emerald-400 active:scale-90 transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteClick && (
                          <button
                            onClick={() => onDeleteClick(item)}
                            title="Xóa"
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 active:scale-90 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && data.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/20 text-xs">
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>
              Hiển thị <span className="text-white font-semibold">{data.length}</span> trên{" "}
              <span className="text-white font-semibold">{pagination.totalItems}</span> mục
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Số dòng:</span>
              <select
                value={pagination.limit}
                onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {[APP_SETTINGS.pagination.defaultLimit, ...APP_SETTINGS.pagination.options.filter(x => x !== APP_SETTINGS.pagination.defaultLimit)].sort((a,b)=>a-b).map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-400 font-medium">
              Trang <span className="text-white font-semibold">{pagination.currentPage}</span> /{" "}
              <span className="text-white font-semibold">{pagination.totalPages}</span>
            </span>
            <button
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
