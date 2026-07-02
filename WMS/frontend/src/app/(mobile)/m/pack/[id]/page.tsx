"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, CheckCircle, PackageOpen, AlertCircle, Truck } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";

const MobileScanner = dynamic(() => import("@/components/MobileScanner"), { ssr: false });

interface PickListItem {
  id: number;
  sku_code: string;
  product_name: string;
  quantity: number;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_number: string;
  status: string;
  pick_list_items: PickListItem[];
}

export default function PackDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [carrierName, setCarrierName] = useState("Giao Hàng Nhanh");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [packMessage, setPackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${id}`);
      if (!res.ok) throw new Error("Failed to load order");
      const data = await res.json();
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (barcode: string) => {
    if (!order) return;
    try {
      setPackMessage(null);
      // 1. Scan tracking number
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}/scan-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_number: barcode,
          carrier_name: carrierName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét đóng gói thất bại.");
      }

      setTrackingNumber(barcode);

      // 2. Automatically complete pack
      const completeRes = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}/complete-pack`, {
        method: "POST",
      });
      if (!completeRes.ok) throw new Error("Failed to complete packing");

      setPackMessage({
        text: `Đóng gói thành công! Mã vận đơn: ${barcode} (${carrierName})`,
        type: "success",
      });

      // Refresh order state
      await fetchOrder();
    } catch (err: any) {
      setPackMessage({
        text: err.message || "Lỗi đóng gói.",
        type: "error",
      });
    }
  };

  const handleShipOrder = async () => {
    if (!order) return;
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}/ship`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể bàn giao vận chuyển.");
      }
      void popupService.alert("Đơn hàng đã được xuất kho thành công!");
      router.push("/m/pack");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
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
        Không tìm thấy thông tin đơn đóng gói.
      </div>
    );
  }

  const isPacked = ["PACKED", "SHIPPED"].includes(order.status.toUpperCase());
  const isShipped = order.status.toUpperCase() === "SHIPPED";

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/m/pack" className="p-1 hover:bg-slate-900 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xs font-bold text-slate-400">CHI TIẾT ĐÓNG GÓI</h1>
          <h2 className="text-sm font-extrabold text-slate-200">{order.fulfillment_number}</h2>
        </div>
      </div>

      {/* Carrier Selection if not packed */}
      {!isPacked && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-bold text-slate-400">HÃNG VẬN CHUYỂN</label>
          <select
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="Giao Hàng Nhanh">Giao Hàng Nhanh (GHN)</option>
            <option value="Giao Hàng Tiết Kiệm">Giao Hàng Tiết Kiệm (GHTK)</option>
            <option value="Viettel Post">Viettel Post</option>
          </select>
        </div>
      )}

      {/* Packed item counts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
        <div className="font-bold text-slate-400 border-b border-slate-850 pb-2 mb-2">CHI TIẾT SẢN PHẨM</div>
        {order.pick_list_items.map((item) => (
          <div key={item.id} className="flex justify-between py-1 border-b border-slate-850/50 text-slate-300">
            <span>{item.sku_code}</span>
            <span className="font-bold">x{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      {packMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            packMessage.type === "success"
              ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/50"
              : "bg-rose-950/50 text-rose-400 border-rose-900/50"
          }`}
        >
          {packMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{packMessage.text}</span>
        </div>
      )}

      {/* Scanner or Complete Actions */}
      {!isPacked ? (
        <MobileScanner onScanSuccess={handleScanSuccess} placeholder="Quét mã vận đơn (Tracking Code 128/QR)..." scanType="shipping" />
      ) : isShipped ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <Truck className="w-10 h-10 text-indigo-400 mx-auto" />
          <div className="text-xs font-bold text-slate-200">Đã bàn giao vận chuyển</div>
          <p className="text-[10px] text-slate-400">Đơn hàng này đã hoàn tất xuất kho.</p>
        </div>
      ) : (
        <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-2xl p-6 text-center space-y-4">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-xs font-bold text-emerald-400">Đã đóng gói xong!</div>
          <button
            onClick={handleShipOrder}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Truck className="w-4 h-4" /> Xác nhận xuất kho (Ship)
          </button>
        </div>
      )}
    </div>
  );
}
