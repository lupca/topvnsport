"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, CheckCircle, MapPin, AlertCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface PickListItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  quantity: number;
  picked_qty: number;
  status: string;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_number: string;
  status: string;
  pick_list_items: PickListItem[];
}

interface Location {
  id: number;
  location_code: string;
}

export default function PickDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [ordRes, locRes] = await Promise.all([
        fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${id}`),
        fetch(`${APP_SETTINGS.api.baseUrl}/locations`)
      ]);
      if (!ordRes.ok) throw new Error("Failed to load fulfillment order");
      const ordData = await ordRes.json();
      const locData = await locRes.json();
      setOrder(ordData);
      setLocations(locData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (barcode: string) => {
    if (!order) return;
    try {
      setScanMessage(null);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}/scan-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          quantity: 1,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét nhặt hàng thất bại.");
      }

      const data = await res.json();
      setScanMessage({
        text: `Đã nhặt thành công: ${data.sku_code} (${data.picked_qty}/${data.required_qty})`,
        type: "success",
      });
      // Refresh data
      const refreshRes = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${id}`);
      if (refreshRes.ok) {
        setOrder(await refreshRes.json());
      }
    } catch (err: any) {
      setScanMessage({
        text: err.message || "Lỗi quét nhặt hàng.",
        type: "error",
      });
    }
  };

  const handleCompletePick = async () => {
    if (!order) return;
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}/complete-pick`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Không thể hoàn tất nhặt hàng.");
      void popupService.alert("Đã nhặt xong toàn bộ hàng!");
      router.push("/m/pick");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const getLocationCode = (locId: number) => {
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

  if (!order) {
    return (
      <div className="text-center py-24 text-rose-400 text-xs">
        Không tìm thấy thông tin đơn nhặt hàng.
      </div>
    );
  }

  const isAllPicked = order.pick_list_items.every((item) => item.picked_qty >= item.quantity);

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/m/pick" className="p-1 hover:bg-slate-900 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xs font-bold text-slate-400">CHI TIẾT NHẶT HÀNG</h1>
          <h2 className="text-sm font-extrabold text-slate-200">{order.fulfillment_number}</h2>
        </div>
      </div>

      {/* Target Items List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
          Danh sách sản phẩm
        </h3>
        <div className="space-y-2">
          {order.pick_list_items.map((item) => {
            const finished = item.picked_qty >= item.quantity;
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
                    {item.picked_qty} / {item.quantity}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">{item.product_name}</div>
                <div className="flex items-center gap-1 text-[9px] text-indigo-400 font-bold mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Vị trí: {getLocationCode(item.location_id)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scan Messages */}
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

      {/* Dynamic Camera Scanner */}
      {!isAllPicked ? (
        <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Quét mã vạch (EAN-13)..." scanType="product" />
      ) : (
        <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-xs font-bold text-emerald-400">Đã Nhặt Đầy Đủ Sản Phẩm!</div>
          <button
            onClick={handleCompletePick}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
          >
            Hoàn tất nhặt hàng
          </button>
        </div>
      )}
    </div>
  );
}
