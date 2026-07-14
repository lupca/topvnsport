"use client";
import { fetchWithAuth } from "@/utils/apiClient";

import React, { useState, useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";
import {
  ArrowUpRight,
  Loader2,
  AlertCircle,
  X,
  Scan,
  CheckCircle,
  Truck,
  MapPin,
  Barcode,
  PackageCheck,
  Calendar,
  Layers,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { popupService, showConfirm } from "@/components/ui/popupService";
import { convertNumberToVietnameseWords } from "@/utils/numberToWords";

interface PickListItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  quantity: number;
  picked_qty: number;
  status: string;
  selling_price?: number | null;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_id: number;
  oms_order_number: string;
  status: string; // PENDING, PICKING, PICKED, PACKING, PACKED, SHIPPED, CANCELLED
  created_at: string;
  completed_at: string | null;
  pick_list_items: PickListItem[];
  original_document_number: string | null;
  total_amount: number | null;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
}

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan Pick Sim State
  const [pickBarcode, setPickBarcode] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [pickMessage, setPickMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Scan Pack State
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("Giao Hàng Nhanh");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ordRes, locRes] = await Promise.all([
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders`),
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/locations`)
      ]);

      if (!ordRes.ok || !locRes.ok) {
        throw new Error("Không thể đồng bộ dữ liệu từ backend.");
      }

      const ordData = await ordRes.json();
      const locData = await locRes.json();

      setOrders(ordData);
      setLocations(locData);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải dữ liệu xuất kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (order: FulfillmentOrder) => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${order.id}`);
      if (!res.ok) throw new Error("Không thể tải chi tiết đơn hàng.");
      const data = await res.json();
      setSelectedOrder(data);
      setPickMessage(null);
      setPickBarcode("");
      setPickQty(1);
      setTrackingNumber("");
    } catch (err: any) {
      void popupService.alert(err.message || "Lỗi tải chi tiết đơn xuất.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPick = async (orderId: number) => {
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/start-pick`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Không thể bắt đầu nhặt hàng.");
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleSelectOrder(selectedOrder);
      }
      void popupService.alert("Đã bắt đầu nhặt hàng!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleScanPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !pickBarcode) return;

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${selectedOrder.id}/scan-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: pickBarcode,
          quantity: pickQty
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét nhặt hàng thất bại.");
      }

      const data = await res.json();
      setPickMessage({
        text: `Đã nhặt thành công: SKU ${data.sku_code} - ${data.picked_qty}/${data.required_qty}`,
        type: "success"
      });
      setPickBarcode("");
      handleSelectOrder(selectedOrder);
      fetchData();
    } catch (err: any) {
      setPickMessage({
        text: err.message || "Lỗi quét nhặt hàng.",
        type: "error"
      });
    }
  };

  const handleQuickPick = async (skuCode: string) => {
    if (!selectedOrder) return;

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${selectedOrder.id}/scan-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: skuCode,
          quantity: 1
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét nhặt hàng thất bại.");
      }

      const data = await res.json();
      setPickMessage({
        text: `Đã nhặt thành công: SKU ${data.sku_code} - ${data.picked_qty}/${data.required_qty}`,
        type: "success"
      });
      setPickBarcode("");
      handleSelectOrder(selectedOrder);
      fetchData();
    } catch (err: any) {
      setPickMessage({
        text: err.message || "Lỗi quét nhặt hàng.",
        type: "error"
      });
    }
  };

  const handleCompletePick = async (orderId: number) => {
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/complete-pick`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Không thể hoàn tất nhặt hàng.");
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleSelectOrder(selectedOrder);
      }
      void popupService.alert("Đã nhặt xong toàn bộ hàng!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleScanPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !trackingNumber) {
      void popupService.alert("Vui lòng điền mã vận đơn!");
      return;
    }

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${selectedOrder.id}/scan-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_number: trackingNumber,
          carrier_name: carrierName
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét đóng gói thất bại.");
      }

      await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${selectedOrder.id}/complete-pack`, {
        method: "POST"
      });

      handleSelectOrder(selectedOrder);
      fetchData();
      void popupService.alert("Đã ghi nhận thông tin đóng gói!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleCompletePack = async (orderId: number) => {
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/complete-pack`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Không thể hoàn tất đóng gói.");
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleSelectOrder(selectedOrder);
      }
      void popupService.alert("Đã hoàn tất đóng gói đơn hàng!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleShipOrder = async (orderId: number) => {
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/ship`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể bàn giao vận chuyển.");
      }
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleSelectOrder(selectedOrder);
      }
      void popupService.alert("Đơn hàng đã được xuất kho thành công!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!(await showConfirm("Bạn có chắc muốn hủy yêu cầu xuất kho này? Tồn kho dự phòng sẽ được trả lại."))) return;
    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/fulfillment-orders/${orderId}/cancel`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Không thể hủy đơn.");
      fetchData();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
      void popupService.alert("Đã hủy đơn thành công.");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const getLocationCode = (locId: number) => {
    const loc = locations.find(l => l.id === locId);
    return loc ? loc.location_code : `Loc ID: ${locId}`;
  };

  // Split Orders side-by-side
  const pickQueue = orders
    .filter(o => ["PENDING", "PICKING"].includes(o.status.toUpperCase()))
    .sort((a, b) => b.id - a.id);
  const packQueue = orders
    .filter(o => ["PICKED", "PACKING", "PACKED", "SHIPPED"].includes(o.status.toUpperCase()))
    .sort((a, b) => b.id - a.id);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-gray-900">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5 text-indigo-600" />
          <span>Xuất Kho (Fulfillment Orders)</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Xử lý đơn hàng xuất kho theo quy trình nhặt hàng (Picking), đóng gói (Packing) và bàn giao vận chuyển (Shipping)
        </p>
      </div>

      {/* Main Grid: Pick and Pack columns side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Picking Queue (Left column) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Hàng chờ Nhặt (Pick Queue)</span>
              <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-extrabold">{pickQueue.length}</span>
            </h3>
            {loading && orders.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : pickQueue.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">Không có đơn hàng chờ nhặt.</div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {pickQueue.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => handleSelectOrder(o)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${
                      selectedOrder?.id === o.id
                        ? "bg-indigo-50 border-indigo-200 shadow-sm"
                        : "hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-800">{o.fulfillment_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                        o.status.toUpperCase() === "PICKING" ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Đơn hàng OMS: #{o.oms_order_number}</span>
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                    {o.status.toUpperCase() === "PENDING" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartPick(o.id);
                        }}
                        className="w-full mt-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg shadow-sm"
                      >
                        Bắt đầu nhặt hàng
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Packing & Shipping Queue (Right column) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Đóng gói & Xuất hàng (Pack/Ship)</span>
              <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-extrabold">{packQueue.length}</span>
            </h3>
            {loading && orders.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : packQueue.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">Không có đơn hàng chờ đóng gói.</div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {packQueue.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => handleSelectOrder(o)}
                    className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${
                      selectedOrder?.id === o.id
                        ? "bg-indigo-50 border-indigo-200 shadow-sm"
                        : "hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-800">{o.fulfillment_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                        o.status.toUpperCase() === "SHIPPED" ? "bg-gray-100 text-gray-500 border border-gray-200" :
                        o.status.toUpperCase() === "PACKED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Đơn hàng OMS: #{o.oms_order_number}</span>
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Order detail pane (Middle/Right panel) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedOrder ? (
            <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4 space-y-5">
              <div className="flex justify-between items-start border-b pb-3 border-gray-200">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900">{selectedOrder.fulfillment_number}</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Trạng thái: {selectedOrder.status}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2.5 text-[10px] bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-gray-700">
                    <div>
                      <span className="font-bold text-gray-500 block">Chứng từ gốc:</span>
                      <span className="font-semibold text-gray-900">{selectedOrder.original_document_number || "—"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500 block">Tổng tiền xuất:</span>
                      <span className="font-extrabold text-indigo-600">
                        {selectedOrder.total_amount ? selectedOrder.total_amount.toLocaleString("vi-VN") + " ₫" : "0 ₫"}
                      </span>
                    </div>
                  </div>
                  {selectedOrder.total_amount ? (
                    <p className="text-[9px] italic text-gray-500 mt-1 ml-0.5">
                      Bằng chữ: <span className="font-semibold text-gray-700">{convertNumberToVietnameseWords(selectedOrder.total_amount)}</span>
                    </p>
                  ) : null}
                </div>
                {["PENDING", "PICKING"].includes(selectedOrder.status.toUpperCase()) && (
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="p-1 text-[9px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded"
                  >
                    Hủy đơn
                  </button>
                )}
              </div>

              {/* Items Detail */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5 text-gray-500" />
                  <span>Sản phẩm nhặt hàng</span>
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {selectedOrder.pick_list_items.map((item) => (
                    <div key={item.id} className="p-2 bg-surface rounded-lg text-[11px] border border-gray-200 shadow-sm space-y-1 relative">
                      <div className="flex justify-between font-bold text-gray-800 pr-16">
                        <span>{item.sku_code}</span>
                        <span>{item.picked_qty}/{item.quantity}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-semibold pr-16">{item.product_name}</p>
                      
                      <div className="flex justify-between text-[10px] text-gray-700 font-semibold pr-16">
                        <span>Giá xuất: {item.selling_price ? item.selling_price.toLocaleString("vi-VN") + " ₫" : "—"}</span>
                        <span>Thành tiền: {item.selling_price ? (item.quantity * item.selling_price).toLocaleString("vi-VN") + " ₫" : "—"}</span>
                      </div>

                      <div className="flex items-center gap-1 text-[9px] text-indigo-600 font-bold">
                        <MapPin className="w-3 h-3" />
                        <span>Vị trí nhặt: {getLocationCode(item.location_id)}</span>
                      </div>
                      {selectedOrder.status.toUpperCase() === "PICKING" && item.picked_qty < item.quantity && (
                        <button
                          onClick={() => handleQuickPick(item.sku_code)}
                          className="absolute top-2 right-2 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-sm text-[9px] flex items-center gap-1"
                        >
                          <Scan className="w-3 h-3" /> Nhặt 1
                        </button>
                      )}
                      {item.picked_qty >= item.quantity && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[9px] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Đã đủ
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive flow states */}
              {selectedOrder.status.toUpperCase() === "PICKING" && (
                <div className="bg-surface border border-gray-200 p-3 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <Scan className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Xác nhận Nhặt Hàng (Scan / Quick Pick)</span>
                  </h4>
                  <form onSubmit={handleScanPick} className="space-y-2 text-xs">
                    <input
                      type="text"
                      data-testid="barcode-manual-input"
                      placeholder="Quét mã vạch hoặc nhập SKU..."
                      value={pickBarcode}
                      onChange={(e) => setPickBarcode(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                      required
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pickQty}
                        onChange={(e) => setPickQty(parseInt(e.target.value))}
                        className="w-20 p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900 text-right"
                        min="1"
                        required
                      />
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                      >
                        Quét
                      </button>
                    </div>
                  </form>
                  <button
                    onClick={() => handleCompletePick(selectedOrder.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Hoàn tất nhặt hàng
                  </button>
                  {pickMessage && (
                    <div className={`p-2 rounded text-[10px] font-bold ${
                      pickMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                      {pickMessage.text}
                    </div>
                  )}
                </div>
              )}

              {selectedOrder.status.toUpperCase() === "PICKED" && (
                <div className="bg-surface border border-gray-200 p-3 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đóng Gói (Packing & Labeling)</span>
                  </h4>
                  <form onSubmit={handleScanPack} className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500">Mã vận đơn (Tracking Number) *</label>
                      <input
                        type="text"
                        placeholder="Nhập mã vận đơn của hãng vận chuyển"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-500">Hãng vận chuyển</label>
                      <select
                        value={carrierName}
                        onChange={(e) => setCarrierName(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                      >
                        <option value="Giao Hàng Nhanh" className="bg-surface">Giao Hàng Nhanh</option>
                        <option value="Giao Hàng Tiết Kiệm" className="bg-surface">Giao Hàng Tiết Kiệm</option>
                        <option value="Viettel Post" className="bg-surface">Viettel Post</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                    >
                      In Label & Đóng Gói
                    </button>
                  </form>
                </div>
              )}

              {selectedOrder.status.toUpperCase() === "PACKED" && (
                <div className="bg-surface border border-gray-200 p-3 rounded-xl space-y-3 text-center">
                  <div className="flex justify-center text-emerald-600 mb-1">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-800">Sẵn sàng xuất kho</h4>
                  <p className="text-[10px] text-gray-500">Đơn hàng đã được đóng gói và dán mã vận đơn. Vui lòng bàn giao cho đơn vị vận chuyển.</p>
                  <button
                    onClick={() => handleShipOrder(selectedOrder.id)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Xác nhận xuất kho (Ship)
                  </button>
                </div>
              )}

              {selectedOrder.status.toUpperCase() === "SHIPPED" && (
                <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3.5 rounded-xl text-center">
                  <Truck className="w-8 h-8 mx-auto mb-1.5" />
                  <h4 className="text-xs font-bold">Đã Bàn Giao Vận Chuyển</h4>
                  <p className="text-[9px] mt-0.5 font-semibold text-emerald-600">
                    Đơn hàng đã xuất kho hoàn thành chu trình fulfillment!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center px-8 border border-dashed border-gray-200 rounded-2xl bg-surface text-gray-500 text-xs text-center py-24">
              Vui lòng chọn một đơn hàng để xử lý picking / packing / shipping.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
