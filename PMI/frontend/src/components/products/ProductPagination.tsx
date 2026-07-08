import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductPaginationProps {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalItems: number;
  totalPages: number;
  pageSizeOptions: number[];
}

export default function ProductPagination({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalItems,
  totalPages,
  pageSizeOptions
}: ProductPaginationProps) {
  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-gray-500">
      {/* Rows Per Page Select */}
      <div className="flex items-center gap-2">
        <span>Hiển thị</span>
        <select
          className="px-2 py-1 border border-gray-300 rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-brand-primary"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          {pageSizeOptions.map(opt => (
            <option key={opt} value={opt}>{opt} hàng / trang</option>
          ))}
        </select>
        <span>
          từ {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} - {Math.min(totalItems, currentPage * pageSize)} trên tổng số {totalItems} sản phẩm
        </span>
      </div>

      {/* Page Nav controls */}
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev: number) => Math.max(1, prev - 1))}
          className="p-1.5 rounded-lg border border-gray-300 bg-surface hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-surface transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
          <button
            key={p}
            onClick={() => setCurrentPage(p)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              currentPage === p
                ? "bg-primary-600 text-white font-bold"
                : "border border-gray-300 bg-surface hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev: number) => Math.min(totalPages, prev + 1))}
          className="p-1.5 rounded-lg border border-gray-300 bg-surface hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-surface transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
