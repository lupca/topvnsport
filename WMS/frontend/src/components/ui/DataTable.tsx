"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Edit, Trash2, Copy } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
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
  showRowNumber?: boolean;
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
  showRowNumber = true,
}: DataTableProps<T>) {
  const getRowNumber = (idx: number) => {
    if (!pagination) return idx + 1;
    return (pagination.currentPage - 1) * pagination.limit + idx + 1;
  };

  const defaultLimit = APP_SETTINGS.pagination?.defaultLimit || 10;
  const paginationOptions = APP_SETTINGS.pagination?.options || [10, 20, 50];
  const sortedOptions = [defaultLimit, ...paginationOptions.filter(x => x !== defaultLimit)].sort((a, b) => a - b);
  return (
    <div className="bg-surface border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-wide">{title}</h2>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          {onSearchChange !== undefined && (
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pim-input pl-9 py-2 text-xs"
              />
            </div>
          )}

          {/* Add New Button */}
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="btn-primary text-xs rounded-lg px-4 py-2"
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
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <span className="text-xs text-brand-primary font-medium tracking-wide">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {showRowNumber !== false && (
                <th className="px-4 py-4 font-semibold select-none w-12 text-center">STT</th>
              )}
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
          <tbody className="divide-y divide-gray-100 text-xs">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEditClick || onDeleteClick || onCopyClick ? 1 : 0) + (showRowNumber !== false ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500 font-medium"
                >
                  Không tìm thấy kết quả nào.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={item.id || idx}
                  className="hover:bg-gray-50 text-gray-700 transition-colors duration-150"
                >
                  {showRowNumber !== false && (
                    <td className="px-4 py-4 text-gray-500 text-center whitespace-nowrap">{getRowNumber(idx)}</td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 font-medium ${col.className !== undefined ? col.className : "whitespace-nowrap"}`}>
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
                            className="btn-icon p-1.5"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        {onEditClick && (
                          <button
                            onClick={() => onEditClick(item)}
                            title="Chỉnh sửa"
                            className="btn-icon p-1.5 hover:text-emerald-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteClick && (
                          <button
                            onClick={() => onDeleteClick(item)}
                            title="Xóa"
                            className="btn-icon p-1.5 hover:text-rose-600"
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
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 text-xs">
          <div className="flex items-center gap-4 text-gray-500 font-medium">
            <span>
              Hiển thị <span className="text-gray-900 font-semibold">{data.length}</span> trên{" "}
              <span className="text-gray-900 font-semibold">{pagination.totalItems}</span> mục
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Số dòng:</span>
              <select
                value={pagination.limit}
                onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:border-brand-primary transition-colors"
              >
                {sortedOptions.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Trang trước"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-40 text-gray-600 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-gray-500 font-medium">
              Trang <span className="text-gray-900 font-semibold">{pagination.currentPage}</span> /{" "}
              <span className="text-gray-900 font-semibold">{pagination.totalPages}</span>
            </span>
            <button
              aria-label="Trang sau"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-40 text-gray-600 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
