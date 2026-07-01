"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, MapPin, Tag } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface InboundItem {
  id: number;
  sku_code: string;
  product_name: string;
  expected_qty: number;
  received_qty: number;
  location_id: number | null;
  status: string;
}

interface InboundShipment {
  id: number;
  inbound_number: string;
  supplier_name: string;
  status: string;
  items: InboundItem[];
}

interface Location {
  id: number;
  location_code: string;
}

export default function ReceiveDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<InboundShipment | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab control
  const [activeTab, setActiveTab] = useState<"scan" | "putaway">("scan");

  // Put-away state
  const [putAwaySku, setPutAwaySku] = useState("");
  const [putAwayLocId, setPutAwayLocId] = useState("");
  const [putAwayMessage, setPutAwayMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [shipRes, locRes] = await Promise.all([
        fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments/${id}`),
        fetch(`${APP_SETTINGS.api.baseUrl}/locations`)
      ]);
      if (!shipRes.ok) throw new Error("Failed to load shipment details");
      const shipData = await shipRes.json();
      const locData = await locRes.json();
      setShipment(shipData);
      setLocations(locData);
      
      // Auto-set first item for put-away dropdown
      if (shipData.items && shipData.items.length > 0) {
        setPutAwaySku(shipData.items[0].sku_code);
      }
      if (locData && locData.length > 0) {
        setPutAwayLocId(String(locData[0].id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (barcode: string) => {
    if (!shipment) return;
    try {
      setScanMessage(null);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${shipment.id}/receive-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          quantity: 1,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét nhận hàng thất bại.");
      }

      const data = await res.json();
      setScanMessage({
        text: `Đã nhận thành công: SKU ${data.sku_code} (${data.received_qty}/${data.expected_qty})`,
        type: "success",
      });

      // Reload shipment details
      const refreshRes = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments/${id}`);
      if (refreshRes.ok) {
        setShipment(await refreshRes.json());
      }
    } catch (err: any) {
      setScanMessage({
        text: err.message || "Lỗi quét nhận hàng.",
        type: "error",
      });
    }
  };

  const handlePutAwaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment || !putAwaySku || !putAwayLocId) return;

    try {
      setPutAwayMessage(null);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${shipment.id}/put-away`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_code: putAwaySku,
          location_id: parseInt(putAwayLocId),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Cất hàng vào vị trí thất bại.");
      }

      const targetLoc = locations.find((l) => String(l.id) === putAwayLocId);
      setPutAwayMessage({
        text: `Đã cất SKU ${putAwaySku} vào vị trí ${targetLoc?.location_code || putAwayLocId}!`,
        type: "success",
      });

      // Reload shipment details
      const refreshRes = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments/${id}`);
      if (refreshRes.ok) {
        setShipment(await refreshRes.json());
      }
    } catch (err: any) {
      setPutAwayMessage({
        text: err.message || "Lỗi cất hàng.",
        type: "error",
      });
    }
  };

  const handleCompleteInbound = async () => {
    if (!shipment) return;
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${shipment.id}/complete`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể hoàn tất nhập kho. Đảm bảo mọi SKU đã gán vị trí.");
      }
      alert("Lô hàng đã được nhập kho thành công!");
      router.push("/m/receive");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLocationCode = (locId: number | null) => {
    if (!locId) return "Chưa cất hàng";
    const loc = locations.find((l) => l.id === locId);
    return loc ? loc.location_code : `Loc ID: ${locId}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-24 text-rose-400 text-xs">
        Không tìm thấy thông tin lô hàng nhập.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/m/receive" className="p-1 hover:bg-slate-900 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xs font-bold text-slate-400">CHI TIẾT NHẬP KHO</h1>
          <h2 className="text-sm font-extrabold text-slate-200">{shipment.inbound_number}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab("scan")}
          className={`py-2 rounded-lg transition-all ${
            activeTab === "scan" ? "bg-indigo-650 bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          1. Quét Nhận Hàng
        </button>
        <button
          onClick={() => setActiveTab("putaway")}
          className={`py-2 rounded-lg transition-all ${
            activeTab === "putaway" ? "bg-indigo-650 bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          2. Cất Hàng (Put-away)
        </button>
      </div>

      {/* Tab: Scan Receive */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          {/* Target List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
              Sản phẩm dự kiến nhận
            </h3>
            <div className="space-y-2">
              {shipment.items.map((item) => {
                const finished = item.received_qty >= item.expected_qty;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs flex flex-col gap-1 ${
                      finished
                        ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                        : "bg-slate-950 border-slate-850 text-slate-200"
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>{item.sku_code}</span>
                      <span>
                        {item.received_qty} / {item.expected_qty}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold">{item.product_name}</div>
                    <div className="flex items-center justify-between text-[9px] mt-1 text-slate-500 font-semibold">
                      <span>Vị trí cất: {getLocationCode(item.location_id)}</span>
                      <span className="uppercase tracking-wide font-extrabold text-[8px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400">
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scan Info Messages */}
          {scanMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                scanMessage.type === "success"
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/50"
                  : "bg-rose-950/50 text-rose-400 border-rose-900/50"
              }`}
            >
              {scanMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{scanMessage.text}</span>
            </div>
          )}

          {/* Scanner */}
          <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Quét Barcode sản phẩm nhận (EAN-13)..." scanType="product" />
        </div>
      )}

      {/* Tab: Put Away */}
      {activeTab === "putaway" && (
        <div className="space-y-4">
          <form onSubmit={handlePutAwaySubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
              Gán vị trí cất hàng (Put-away)
            </h3>

            {/* Select SKU */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400">SẢN PHẨM (SKU)</label>
              <select
                value={putAwaySku}
                onChange={(e) => setPutAwaySku(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {shipment.items.map((item) => (
                  <option key={item.id} value={item.sku_code}>
                    {item.sku_code} ({item.received_qty} đã nhận)
                  </option>
                ))}
              </select>
            </div>

            {/* Select Location */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400">VỊ TRÍ CẤT HÀNG (LOCATION)</label>
              <select
                value={putAwayLocId}
                onChange={(e) => setPutAwayLocId(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.location_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              Cất Vào Vị Trí
            </button>
          </form>

          {/* Putaway Messages */}
          {putAwayMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                putAwayMessage.type === "success"
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/50"
                  : "bg-rose-950/50 text-rose-400 border-rose-900/50"
              }`}
            >
              {putAwayMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{putAwayMessage.text}</span>
            </div>
          )}

          {/* Current location mappings info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <h4 className="font-bold text-slate-400 border-b border-slate-850 pb-2 mb-2">Vị trí hiện tại đã gán</h4>
            {shipment.items.map((item) => (
              <div key={item.id} className="flex justify-between py-1 border-b border-slate-850/50 text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" /> {item.sku_code}
                </span>
                <span className="flex items-center gap-1 font-bold text-indigo-400">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {getLocationCode(item.location_id)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Complete Action */}
      <div className="pt-2">
        <button
          onClick={handleCompleteInbound}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
        >
          Hoàn tất nhập kho lô hàng
        </button>
      </div>
    </div>
  );
}
