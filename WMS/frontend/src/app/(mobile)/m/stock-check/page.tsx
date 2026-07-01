"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, MapPin, Tag, Box, Sliders } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface Location {
  id: number;
  location_code: string;
}

interface BarcodeMapping {
  sku_code: string;
  product_name: string;
  variant_name: string | null;
}

export default function StockCheckPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocId, setSelectedLocId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Scanned Product State
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [skuInfo, setSkuInfo] = useState<BarcodeMapping | null>(null);

  // Form Fields
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  useEffect(() => {
    // Load Locations
    fetch(`${APP_SETTINGS.api.baseUrl}/locations`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocId(String(data[0].id));
        }
      })
      .catch((err) => console.error("Failed to load locations", err));
  }, []);

  const handleScanSuccess = async (barcode: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      setScannedBarcode(barcode);
      setSkuInfo(null);

      // Lookup SKU code of barcode
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/barcode-mappings/lookup/${barcode}`);
      if (!res.ok) {
        throw new Error(`Mã vạch ${barcode} chưa được liên kết với bất kỳ SKU nào.`);
      }
      const data = await res.json();
      setSkuInfo(data);
    } catch (err: any) {
      setError(err.message || "Lỗi quét tra cứu sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuInfo || !selectedLocId || adjustQty === 0) {
      alert("Vui lòng chọn vị trí, quét sản phẩm và nhập số lượng khác 0.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inventory/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_code: skuInfo.sku_code,
          location_id: parseInt(selectedLocId, 10),
          quantity: adjustQty,
          note: adjustNote || `Mobile Stock Check`
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Điều chỉnh tồn kho thất bại.");
      }

      setSuccessMessage(`Đã điều chỉnh thành công: SKU ${skuInfo.sku_code} delta ${adjustQty >= 0 ? `+${adjustQty}` : adjustQty}!`);
      // Reset form
      setScannedBarcode("");
      setSkuInfo(null);
      setAdjustQty(0);
      setAdjustNote("");
    } catch (err: any) {
      setError(err.message || "Lỗi thực hiện điều chỉnh.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/m" className="p-1 hover:bg-slate-900 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xs font-bold text-slate-400 uppercase">Tác vụ Scanner</h1>
          <h2 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4.5 h-4.5 text-indigo-400" /> Kiểm Kho (Stock Check)
          </h2>
        </div>
      </div>

      {/* Success/Error Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-900/50 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-900/50 rounded-xl text-xs font-bold text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleAdjustSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
          Thông tin kiểm kho
        </h3>

        {/* Vị trí ô kệ */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Chọn Vị trí Ô kệ *</label>
          <select
            value={selectedLocId}
            onChange={(e) => setSelectedLocId(e.target.value)}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            required
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.location_code}
              </option>
            ))}
          </select>
        </div>

        {/* Scanned Sku Display */}
        {skuInfo ? (
          <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs space-y-2">
            <div className="font-bold text-slate-200">{skuInfo.product_name}</div>
            {skuInfo.variant_name && <p className="text-[10px] text-slate-400 font-semibold">Variant: {skuInfo.variant_name}</p>}
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold">
              <Tag className="w-3.5 h-3.5" />
              <span>SKU: {skuInfo.sku_code}</span>
            </div>

            {/* Adjust Quantities & Note */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400">SL chênh lệch (Delta) *</label>
                <input
                  type="number"
                  placeholder="Ví dụ: +2, -1"
                  value={adjustQty || ""}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-bold focus:outline-none text-center"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400">Ghi chú kiểm kho</label>
                <input
                  type="text"
                  placeholder="Lý do..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận điều chỉnh"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/50 border border-slate-850 border-dashed rounded-xl text-center text-xs text-slate-500 py-6">
            Hãy quét mã vạch sản phẩm bên dưới để tải thông tin SKU.
          </div>
        )}
      </form>

      {/* Scanner */}
      <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Quét mã vạch sản phẩm kiểm kho..." scanType="product" />
    </div>
  );
}
