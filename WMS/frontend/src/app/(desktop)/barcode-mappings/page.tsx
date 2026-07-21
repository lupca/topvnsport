"use client";
import { fetchWithAuth } from "@/utils/apiClient";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { APP_SETTINGS } from "@/config/settings";
import {
  Barcode,
  X,
  Image as ImageIcon,
  Scan,
  RefreshCw
} from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { popupService, showConfirm } from "@/components/ui/popupService";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface BarcodeMapping {
  id: number;
  barcode: string;
  barcode_type: string | null;
  sku_code: string;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  created_at: string;
  cost_price: number | null;
  tax_rate: number | null;
}

export default function BarcodeMappingsPage() {
  const [mappings, setMappings] = useState<BarcodeMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(APP_SETTINGS.pagination?.defaultLimit || 10);

  // Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<BarcodeMapping | null>(null);
  const [barcode, setBarcode] = useState("");
  const [barcodeType, setBarcodeType] = useState("EAN-13");
  const [skuCode, setSkuCode] = useState("");
  const [productName, setProductName] = useState("");
  const [variantName, setVariantName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [taxRate, setTaxRate] = useState("");

  const handleScanSuccess = (scannedBarcode: string) => {
    const match = mappings.find((m) => m.barcode === scannedBarcode);
    setIsScanOpen(false);
    if (match) {
      setSearchQuery(scannedBarcode);
      void popupService.alert(`Mã vạch ${scannedBarcode} đã liên kết với SKU: ${match.sku_code} (${match.product_name}). Hệ thống đã lọc danh sách.`);
    } else {
      setBarcode(scannedBarcode);
      setBarcodeType("EAN-13");
      setSkuCode("");
      setProductName("");
      setVariantName("");
      setImageUrl("");
      setCostPrice("");
      setTaxRate("");
      setEditingMapping(null);
      setIsOpen(true);
      void popupService.alert(`Mã vạch ${scannedBarcode} chưa được liên kết. Hãy điền thông tin để tạo liên kết mới!`);
    }
  };

  const handleSync = async () => {
    const confirmed = await showConfirm("Bạn có chắc muốn đồng bộ sản phẩm từ PMI?");
    if (!confirmed) return;
    try {
      setSyncing(true);
      setError(null);
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/products/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Đồng bộ sản phẩm thất bại.");
      const result = await res.json();
      void popupService.alert(result.message || `Đồng bộ thành công!`);
      await fetchMappings();
    } catch (err: any) {
      setError(err.message || "Lỗi đồng bộ sản phẩm.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/barcode-mappings`);
      if (!res.ok) throw new Error("Không thể tải danh sách mã vạch.");
      const data = await res.json();
      setMappings(data);
    } catch (err: any) {
      setError(err.message || "Lỗi tải liên kết mã vạch.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !skuCode || !productName) {
      void popupService.alert("Mã vạch, SKU và Tên sản phẩm là bắt buộc!");
      return;
    }

    const payload = {
      barcode,
      barcode_type: barcodeType || null,
      sku_code: skuCode,
      product_name: productName,
      variant_name: variantName || null,
      image_url: imageUrl || null,
      cost_price: costPrice ? parseFloat(costPrice) : null,
      tax_rate: taxRate ? parseFloat(taxRate) : null
    };

    try {
      const url = editingMapping
        ? `${APP_SETTINGS.api.baseUrl}/barcode-mappings/${editingMapping.id}`
        : `${APP_SETTINGS.api.baseUrl}/barcode-mappings`;
      const method = editingMapping ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể lưu liên kết mã vạch.");
      }

      setIsOpen(false);
      await fetchMappings();
      void popupService.alert("Đã lưu liên kết mã vạch thành công!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm("Bạn có chắc chắn muốn xóa liên kết mã vạch này?"))) return;
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/barcode-mappings/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Không thể xóa liên kết mã vạch.");
      await fetchMappings();
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const openModal = (bm: BarcodeMapping | null = null) => {
    setEditingMapping(bm);
    if (bm) {
      setBarcode(bm.barcode);
      setBarcodeType(bm.barcode_type || "EAN-13");
      setSkuCode(bm.sku_code);
      setProductName(bm.product_name);
      setVariantName(bm.variant_name || "");
      setImageUrl(bm.image_url || "");
      setCostPrice(bm.cost_price !== null && bm.cost_price !== undefined ? bm.cost_price.toString() : "");
      setTaxRate(bm.tax_rate !== null && bm.tax_rate !== undefined ? bm.tax_rate.toString() : "");
    } else {
      setBarcode("");
      setBarcodeType("EAN-13");
      setSkuCode("");
      setProductName("");
      setVariantName("");
      setImageUrl("");
      setCostPrice("");
      setTaxRate("");
    }
    setIsOpen(true);
  };

  const filteredMappings = mappings.filter((bm) => {
    const q = searchQuery.toLowerCase();
    return (
      bm.barcode.toLowerCase().includes(q) ||
      bm.sku_code.toLowerCase().includes(q) ||
      bm.product_name.toLowerCase().includes(q) ||
      (bm.variant_name && bm.variant_name.toLowerCase().includes(q))
    );
  });

  const totalItems = filteredMappings.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedMappings = filteredMappings.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const columns = [
    {
      key: "product_info",
      label: "Sản Phẩm",
      className: "whitespace-normal min-w-[250px] max-w-[400px]",
      render: (bm: BarcodeMapping) => (
        <div className="flex items-center gap-3">
          {bm.image_url ? (
            <img
              src={bm.image_url}
              alt={bm.product_name}
              className="w-12 h-12 object-contain rounded-lg border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 border border-gray-200 shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-gray-800 line-clamp-2" title={bm.product_name}>{bm.product_name}</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{bm.sku_code}</span>
              {bm.variant_name && <span className="text-[11px] text-gray-500 font-medium" title={bm.variant_name}>{bm.variant_name}</span>}
            </div>
          </div>
        </div>
      )
    },
    {
      key: "barcode_info",
      label: "Mã Vạch",
      render: (bm: BarcodeMapping) => (
        <div className="flex flex-col gap-0.5 min-w-[120px]">
          <span className="font-bold text-gray-800 tracking-wider text-[13px]">{bm.barcode}</span>
          <span className="text-[11px] text-gray-500 font-medium bg-gray-100 w-fit px-1.5 py-0.5 rounded">{bm.barcode_type || "N/A"}</span>
        </div>
      )
    },
    {
      key: "financials",
      label: "Tài Chính",
      render: (bm: BarcodeMapping) => (
        <div className="flex flex-col gap-0.5 min-w-[100px]">
          <span className="font-semibold text-emerald-600 text-sm">
            {bm.cost_price !== null && bm.cost_price !== undefined
              ? `${Number(bm.cost_price).toLocaleString("vi-VN")} đ`
              : "-"}
          </span>
          <span className="text-[11px] text-gray-500 font-medium">
            Thuế: {bm.tax_rate !== null && bm.tax_rate !== undefined
              ? `${Number(bm.tax_rate)}%`
              : "-"}
          </span>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-indigo-600" />
            <span>Liên kết Mã vạch (Barcode Mappings)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Định nghĩa liên kết giữa mã vạch quét từ máy quét (EAN-13, Code 128, etc.) với mã SKU của sản phẩm
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Đang đồng bộ..." : "Đồng bộ từ PMI"}</span>
          </button>
          <button
            onClick={() => setIsScanOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            <Scan className="w-4 h-4" />
            <span>Quét Barcode (Camera)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Table */}
      <DataTable<BarcodeMapping>
        title="Danh sách liên kết"
        description="Quản lý danh sách liên kết mã vạch với SKU sản phẩm"
        data={paginatedMappings}
        columns={columns}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddClick={() => openModal()}
        addLabel="Thêm liên kết mã"
        onEditClick={(bm) => openModal(bm)}
        onDeleteClick={(bm) => handleDelete(bm.id)}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          limit,
          totalItems,
          onPageChange: setCurrentPage,
          onLimitChange: (newLimit) => {
            setLimit(newLimit);
            setCurrentPage(1);
          }
        }}
      />

      {/* --- Create/Edit Mapping Modal --- */}
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-gray-200">
              <h3 className="text-sm font-extrabold text-gray-900">
                {editingMapping ? "Cập nhật mã vạch" : "Tạo liên kết mã vạch mới"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Mã Vạch (Barcode) *</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="VD: 8931234567890"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Loại mã vạch (Barcode Type)</label>
                <input
                  type="text"
                  value={barcodeType}
                  onChange={(e) => setBarcodeType(e.target.value)}
                  placeholder="EAN-13, CODE-128, etc."
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Mã SKU của sản phẩm *</label>
                <input
                  type="text"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value)}
                  placeholder="VD: SKU-SPORTS-BLUE-M"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Tên sản phẩm *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="VD: Áo thun thể thao nam thoáng khí"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Tên biến thể (Kích thước, Màu sắc)</label>
                <input
                  type="text"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="VD: Xanh dương / Size M"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Đường dẫn ảnh sản phẩm (URL)</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Giá vốn (VND)</label>
                  <input
                    type="number"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="VD: 50000"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Thuế suất (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="VD: 10"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface text-gray-900"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4 border-gray-200 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg hover:bg-gray-100 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {editingMapping ? "Lưu thay đổi" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Camera Scanner Modal --- */}
      {isScanOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-gray-200">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Scan className="w-5 h-5 text-indigo-600" />
                <span>Quét Barcode Sản Phẩm</span>
              </h3>
              <button onClick={() => setIsScanOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-gray-500 text-xs">
              Sử dụng webcam của bạn hoặc dùng phần Giả lập nhập mã thủ công ở dưới để quét mã vạch (EAN-13).
            </div>
            <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Nhập/quét mã EAN-13 sản phẩm..." scanType="product" />
          </div>
        </div>
      )}
    </div>
  );
}
