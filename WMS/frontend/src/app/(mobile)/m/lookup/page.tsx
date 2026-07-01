"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search, Loader2, CheckCircle, AlertCircle, MapPin, Tag, Box, Archive, X } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface BarcodeMapping {
  barcode: string;
  sku_code: string;
  product_name: string;
  variant_name: string;
  image_url?: string;
}

interface InventoryItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  qty_on_hand: number;
  qty_reserved: number;
}

interface Location {
  id: number;
  location_code: string;
}

export default function LookupPage() {
  const [loading, setLoading] = useState(false);
  const [skuInfo, setSkuInfo] = useState<BarcodeMapping | null>(null);
  const [stocks, setStocks] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Quick mapping modal states
  const [unmappedBarcode, setUnmappedBarcode] = useState("");
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingSku, setMappingSku] = useState("");
  const [mappingProductName, setMappingProductName] = useState("");
  const [mappingVariantName, setMappingVariantName] = useState("");

  useEffect(() => {
    // Pre-load locations to map them easily
    fetch(`${APP_SETTINGS.api.baseUrl}/locations`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLocations(data))
      .catch((err) => console.error("Failed to load locations", err));
  }, []);

  const handleScanSuccess = async (barcode: string) => {
    try {
      setLoading(true);
      setError(null);
      setSkuInfo(null);
      setStocks([]);

      // 1. Lookup barcode
      const lookupRes = await fetch(`${APP_SETTINGS.api.baseUrl}/barcode-mappings/lookup/${barcode}`);
      if (!lookupRes.ok) {
        if (lookupRes.status === 404) {
          setUnmappedBarcode(barcode);
          setIsMappingModalOpen(true);
          throw new Error(`Mã vạch ${barcode} chưa được liên kết với SKU nào.`);
        }
        throw new Error(`Không tìm thấy thông tin sản phẩm cho mã vạch: ${barcode}`);
      }
      const mappingData: BarcodeMapping = await lookupRes.json();
      setSkuInfo(mappingData);

      // 2. Lookup inventory for this SKU
      const invRes = await fetch(`${APP_SETTINGS.api.baseUrl}/inventory`);
      if (invRes.ok) {
        const allInv: InventoryItem[] = await invRes.json();
        const skuInv = allInv.filter((item) => item.sku_code === mappingData.sku_code);
        setStocks(skuInv);
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi truy vấn mã vạch.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unmappedBarcode || !mappingSku || !mappingProductName) {
      alert("Vui lòng nhập đầy đủ thông tin bắt buộc!");
      return;
    }
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/barcode-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: unmappedBarcode,
          sku_code: mappingSku,
          product_name: mappingProductName,
          variant_name: mappingVariantName || null,
          barcode_type: "EAN-13"
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể tạo liên kết.");
      }
      setIsMappingModalOpen(false);
      // Reset inputs
      setMappingSku("");
      setMappingProductName("");
      setMappingVariantName("");
      alert("Đã liên kết mã vạch thành công!");
      // Automatically query again to show the newly linked product!
      handleScanSuccess(unmappedBarcode);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLocationCode = (locId: number) => {
    const loc = locations.find((l) => l.id === locId);
    return loc ? loc.location_code : `Loc ID: ${locId}`;
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
          <Search className="w-5 h-5 text-indigo-400" /> Tra cứu (Lookup)
        </h1>
        <p className="text-[10px] text-slate-400">Quét mã vạch sản phẩm để tra cứu vị trí & số lượng tồn kho</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-900/50 rounded-xl text-xs font-bold text-rose-450 text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      )}

      {/* SKU Details Display */}
      {skuInfo && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex gap-3 items-start">
            {skuInfo.image_url ? (
              <img
                src={skuInfo.image_url}
                alt={skuInfo.product_name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-800 bg-slate-950"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500">
                <Box className="w-6 h-6" />
              </div>
            )}
            <div className="space-y-1 text-xs">
              <h3 className="font-extrabold text-slate-200">{skuInfo.product_name}</h3>
              <p className="text-slate-400 font-semibold text-[10px]">Variant: {skuInfo.variant_name}</p>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold mt-1">
                <Tag className="w-3.5 h-3.5" />
                <span>SKU: {skuInfo.sku_code}</span>
              </div>
            </div>
          </div>

          {/* Stock Locations */}
          <div className="border-t border-slate-850 pt-3 space-y-2">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" /> Vị trí tồn kho (Stock Levels)
            </h4>

            {stocks.length === 0 ? (
              <div className="text-[11px] text-slate-500 py-2">
                Không tìm thấy tồn kho vật lý tại bất kỳ vị trí nào.
              </div>
            ) : (
              <div className="space-y-2">
                {stocks.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-300">
                      <MapPin className="w-4 h-4 text-indigo-400" />
                      <span>{getLocationCode(item.location_id)}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-200">
                        {item.qty_on_hand} khả dụng
                      </div>
                      {item.qty_reserved > 0 && (
                        <div className="text-[9px] text-amber-500 font-semibold">
                          ({item.qty_reserved} đã giữ chỗ)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Camera Scanner */}
      <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Quét mã vạch sản phẩm (EAN-13)..." scanType="product" />

      {/* Quick Mapping Modal */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-xs font-extrabold text-slate-250 text-slate-200 uppercase tracking-wider">Liên kết nhanh SKU</h3>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMapping} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-400 block uppercase tracking-wider text-[9px]">Mã Vạch Scanned</label>
                <input
                  type="text"
                  value={unmappedBarcode}
                  disabled
                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 font-mono disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase tracking-wider text-[9px]">Mã SKU *</label>
                <input
                  type="text"
                  placeholder="VD: SKU-SPORTS-BLUE-M"
                  value={mappingSku}
                  onChange={(e) => setMappingSku(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase tracking-wider text-[9px]">Tên sản phẩm *</label>
                <input
                  type="text"
                  placeholder="VD: Áo thun nam"
                  value={mappingProductName}
                  onChange={(e) => setMappingProductName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase tracking-wider text-[9px]">Biến thể (Không bắt buộc)</label>
                <input
                  type="text"
                  placeholder="VD: Xanh dương / M"
                  value={mappingVariantName}
                  onChange={(e) => setMappingVariantName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3.5 border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMappingModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-xl hover:bg-slate-850"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Xác nhận liên kết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
