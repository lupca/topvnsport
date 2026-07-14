"use client";
import { fetchWithAuth } from "@/utils/apiClient";

import React, { useState, useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";
import {
  ArrowDownLeft,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Scan,
  CheckCircle,
  Truck,
  MapPin,
  Barcode,
  Calendar,
  Layers
} from "lucide-react";
import { popupService, showConfirm } from "@/components/ui/popupService";
import { convertNumberToVietnameseWords } from "@/utils/numberToWords";

interface InboundItem {
  id: number;
  sku_code: string;
  product_name: string;
  expected_qty: number;
  received_qty: number;
  location_id: number | null;
  status: string;
  unit_cost?: number | null;
}

interface InboundShipment {
  id: number;
  inbound_number: string;
  warehouse_id: number;
  supplier_name: string;
  status: string; // pending, receiving, COMPLETED
  note: string | null;
  created_by: string | null;
  expected_date: string | null;
  received_date: string | null;
  created_at: string;
  items: InboundItem[];
  receiver_name: string | null;
  original_document_number: string | null;
  total_amount: number | null;
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
  zone: string | null;
}

export default function InboundPage() {
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<InboundShipment | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [barcodeMappings, setBarcodeMappings] = useState<{ sku_code: string; product_name: string; variant_name: string | null }[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create Shipment Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inboundNumber, setInboundNumber] = useState("");
  const [selectedWhId, setSelectedWhId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [originalDocumentNumber, setOriginalDocumentNumber] = useState("");
  const [note, setNote] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [itemsInput, setItemsInput] = useState<{ sku_code: string; product_name: string; expected_qty: number; unit_cost: number; isManual?: boolean }[]>([
    { sku_code: "", product_name: "", expected_qty: 1, unit_cost: 0, isManual: false }
  ]);

  // Scan Receive Form
  const [scanBarcode, setScanBarcode] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);
  const successAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Put-away Form
  const [putAwaySku, setPutAwaySku] = useState("");
  const [putAwayLocId, setPutAwayLocId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedShipment) {
      scanInputRef.current?.focus();
    }
  }, [selectedShipment]);

  const playScanBeep = (type: "success" | "error") => {
    const player = type === "success" ? successAudioRef.current : errorAudioRef.current;
    if (!player) {
      return;
    }
    player.currentTime = 0;
    void player.play().catch(() => {
      // Ignore autoplay restrictions when browser blocks audio.
    });
  };

  const getSkuStock = (sku: string) => {
    if (!sku) return 0;
    return inventories
      .filter((inv) => inv.sku_code === sku)
      .reduce((sum, inv) => sum + inv.qty_on_hand, 0);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shipRes, whRes, locRes, mapRes, invRes] = await Promise.all([
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound-shipments`),
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/warehouses`),
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/locations`),
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/barcode-mappings`),
        fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inventory`)
      ]);

      if (!shipRes.ok || !whRes.ok || !locRes.ok || !mapRes.ok || !invRes.ok) {
        throw new Error("Không thể đồng bộ dữ liệu từ backend.");
      }

      const shipData = await shipRes.json();
      const whData = await whRes.json();
      const locData = await locRes.json();
      const mapData = await mapRes.json();
      const invData = await invRes.json();

      // Filter unique products from barcode mappings
      const uniqueProducts: any[] = [];
      const seenSkus = new Set();
      for (const m of mapData) {
        if (!seenSkus.has(m.sku_code)) {
          seenSkus.add(m.sku_code);
          uniqueProducts.push({
            sku_code: m.sku_code,
            product_name: m.product_name,
            variant_name: m.variant_name
          });
        }
      }

      setShipments(shipData);
      setWarehouses(whData);
      setLocations(locData);
      setBarcodeMappings(uniqueProducts);
      setInventories(invData);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải dữ liệu nhập kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShipment = async (shipment: InboundShipment) => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound-shipments/${shipment.id}`);
      if (!res.ok) throw new Error("Không thể tải chi tiết lô hàng.");
      const data = await res.json();
      setSelectedShipment(data);
      // Clean scanning message
      setScanMessage(null);
      setScanBarcode("");
      setScanQty(1);
    } catch (err: any) {
      void popupService.alert(err.message || "Lỗi tải chi tiết lô hàng.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemRow = () => {
    setItemsInput((current) => [...current, { sku_code: "", product_name: "", expected_qty: 1, unit_cost: 0, isManual: false }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItemsInput((current) => current.filter((_, i) => i !== idx));
  };

  const handleItemInputChange = (idx: number, field: string, val: any) => {
    setItemsInput((current) => {
      const updated = [...current];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundNumber || !selectedWhId || !supplierName) {
      void popupService.alert("Vui lòng nhập đầy đủ thông tin bắt buộc!");
      return;
    }

    const filteredItems = itemsInput.filter(item => item.sku_code !== "");
    if (filteredItems.length === 0) {
      void popupService.alert("Lô hàng phải có ít nhất một sản phẩm!");
      return;
    }

    const payload = {
      inbound_number: inboundNumber,
      warehouse_id: parseInt(selectedWhId),
      supplier_name: supplierName,
      receiver_name: receiverName || null,
      original_document_number: originalDocumentNumber || null,
      note: note || null,
      created_by: "Admin",
      expected_date: expectedDate ? new Date(expectedDate).toISOString() : null,
      items: filteredItems.map(item => ({
        sku_code: item.sku_code,
        product_name: item.product_name || item.sku_code,
        expected_qty: item.expected_qty,
        received_qty: 0,
        location_id: null,
        status: "pending",
        unit_cost: item.unit_cost || 0
      }))
    };

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound-shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể tạo lô hàng.");
      }

      setIsCreateOpen(false);
      // reset states
      setInboundNumber("");
      setSelectedWhId("");
      setSupplierName("");
      setReceiverName("");
      setOriginalDocumentNumber("");
      setNote("");
      setExpectedDate("");
      setItemsInput([{ sku_code: "", product_name: "", expected_qty: 1, unit_cost: 0, isManual: false }]);
      fetchData();
      void popupService.alert("Tạo lô hàng nhập kho thành công!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleScanReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !scanBarcode) return;

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/receive-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: scanBarcode,
          quantity: scanQty
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Quét nhận hàng thất bại.");
      }

      const data = await res.json();
      setScanMessage({
        text: `Đã nhận thành công: SKU ${data.sku_code} (${data.product_name}) - Qty: ${scanQty}`,
        type: "success"
      });
      playScanBeep("success");
      setScanBarcode("");
      scanInputRef.current?.focus();
      handleSelectShipment(selectedShipment);
    } catch (err: any) {
      setScanMessage({
        text: err.message || "Lỗi khi quét nhận hàng.",
        type: "error"
      });
      playScanBeep("error");
      scanInputRef.current?.focus();
    }
  };

  const handlePutAway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !putAwaySku || !putAwayLocId) {
      void popupService.alert("Vui lòng chọn SKU và Vị trí cất hàng!");
      return;
    }

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/put-away`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_code: putAwaySku,
          location_id: parseInt(putAwayLocId)
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Cất hàng vào vị trí thất bại.");
      }

      setPutAwaySku("");
      setPutAwayLocId("");
      handleSelectShipment(selectedShipment);
      void popupService.alert("Cất hàng vào vị trí thành công!");
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const handleCompleteShipment = async () => {
    if (!selectedShipment) return;
    if (!(await showConfirm("Bạn có chắc chắn muốn hoàn thành lô hàng này? Tồn kho thực tế sẽ được cập nhật."))) return;

    try {
      const res = await fetchWithAuth(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/complete`, {
        method: "PATCH"
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể hoàn thành lô hàng.");
      }

      void popupService.alert("Lô hàng đã hoàn thành và nhập kho thành công!");
      handleSelectShipment(selectedShipment);
      fetchData();
    } catch (err: any) {
      void popupService.alert(err.message);
    }
  };

  const getWarehouseName = (whId: number) => {
    const wh = warehouses.find(w => w.id === whId);
    return wh ? wh.name : `WH ID: ${whId}`;
  };

  const getLocationCode = (locId: number | null) => {
    if (!locId) return "Chưa có";
    const loc = locations.find(l => l.id === locId);
    return loc ? loc.location_code : `Loc: ${locId}`;
  };

  const getFilteredLocations = () => {
    if (!selectedShipment) return [];
    return locations.filter(loc => loc.warehouse_id === selectedShipment.warehouse_id);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-transparent text-gray-900">
      <audio ref={successAudioRef} preload="auto" src="data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8=" />
      <audio ref={errorAudioRef} preload="auto" src="data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////" />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-indigo-600" />
            <span>Nhập Kho (Inbound Shipments)</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý quy trình nhận hàng, quét barcode và cất hàng vào vị trí ô kệ (Put-away)
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Đơn Nhập Kho</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left List */}
        <div className="lg:col-span-12 space-y-4">
          <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-4">
              Danh sách Đơn Nhập ({shipments.length})
            </h3>
            {loading && shipments.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">Chưa có lô hàng nhập kho nào.</div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto pr-1">
                {shipments.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectShipment(s)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${
                      selectedShipment?.id === s.id
                        ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-gray-800">{s.inbound_number}</h4>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Nhà cung cấp: {s.supplier_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        s.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        s.status === "receiving" ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" :
                        "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-500 border-t pt-2 border-gray-200">
                      <span>Kho: {getWarehouseName(s.warehouse_id)}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {s.expected_date ? new Date(s.expected_date).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Details & Scanner Drawer */}
        {selectedShipment && (
          <div className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[1px]">
            <div className="absolute inset-y-0 right-0 w-full max-w-6xl bg-surface border-l border-gray-200 rounded-l-2xl p-6 shadow-2xl overflow-y-auto space-y-6">
              <div className="flex justify-between items-start border-b pb-4 border-gray-200">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-gray-900">{selectedShipment.inbound_number}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Trạng thái: <span className="font-bold uppercase text-gray-900">{selectedShipment.status}</span> • Kho: {getWarehouseName(selectedShipment.warehouse_id)}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200 text-gray-700">
                    <div>
                      <span className="font-bold text-gray-500 block">Nhà cung cấp:</span>
                      <span className="font-semibold text-gray-900">{selectedShipment.supplier_name}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500 block">Người nhận:</span>
                      <span className="font-semibold text-gray-900">{selectedShipment.receiver_name || "—"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500 block">Chứng từ gốc:</span>
                      <span className="font-semibold text-gray-900">{selectedShipment.original_document_number || "—"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500 block">Tổng tiền:</span>
                      <span className="font-extrabold text-indigo-600 text-sm">
                        {selectedShipment.total_amount ? selectedShipment.total_amount.toLocaleString("vi-VN") + " ₫" : "0 ₫"}
                      </span>
                    </div>
                  </div>
                  {selectedShipment.total_amount ? (
                    <p className="text-[10px] italic text-gray-500 mt-1.5 ml-1">
                      Bằng chữ: <span className="font-semibold text-gray-700">{convertNumberToVietnameseWords(selectedShipment.total_amount)}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {selectedShipment.status !== "COMPLETED" && (
                    <button
                      onClick={handleCompleteShipment}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Hoàn thành Nhập</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedShipment(null)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                    aria-label="Đóng drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-500" />
                  <span>Danh sách sản phẩm trong đơn</span>
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface text-gray-500 font-bold border-b border-gray-200">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Tên sản phẩm</th>
                        <th className="p-3 text-right">Giá nhập</th>
                        <th className="p-3 text-right">Dự kiến</th>
                        <th className="p-3 text-right">Đã nhận</th>
                        <th className="p-3 text-right">Thành tiền</th>
                        <th className="p-3">Vị trí cất</th>
                        <th className="p-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShipment.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-bold text-gray-800">{item.sku_code}</td>
                          <td className="p-3 text-gray-700 font-semibold">{item.product_name}</td>
                          <td className="p-3 text-right font-semibold text-gray-700">
                            {item.unit_cost ? item.unit_cost.toLocaleString("vi-VN") + " ₫" : "—"}
                          </td>
                          <td className="p-3 text-right font-extrabold text-gray-700">{item.expected_qty}</td>
                          <td className="p-3 text-right font-extrabold text-indigo-600">{item.received_qty}</td>
                          <td className="p-3 text-right font-bold text-gray-800">
                            {item.unit_cost ? (item.expected_qty * item.unit_cost).toLocaleString("vi-VN") + " ₫" : "—"}
                          </td>
                          <td className="p-3">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-gray-200">
                              {getLocationCode(item.location_id)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              item.status === "put_away" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              item.status === "received" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedShipment.status !== "COMPLETED" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-gray-200">
                  {/* Scanner Simulator */}
                  <div className="bg-surface border border-gray-200 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Scan className="w-4 h-4 text-indigo-600" />
                      <span>Giả lập máy quét nhận hàng (Receive Scan)</span>
                    </h4>
                    <form onSubmit={handleScanReceive} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-500 block">Quét Barcode sản phẩm *</label>
                        <div className="relative">
                          <Barcode className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                          <input
                            ref={scanInputRef}
                            type="text"
                            data-testid="barcode-manual-input"
                            placeholder="Nhập mã barcode (VD: BAR-SKU-SPORTS-BLUE-M)"
                            value={scanBarcode}
                            onChange={(e) => setScanBarcode(e.target.value)}
                            className="w-full pl-10 pr-3 py-3 bg-surface border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-lg font-semibold"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-500 block">Số lượng quét nhận</label>
                        <input
                          type="number"
                          value={scanQty}
                          onChange={(e) => setScanQty(parseInt(e.target.value))}
                          className="w-full p-2 bg-surface border border-gray-200 shadow-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                          min="1"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                      >
                        Ghi nhận quét
                      </button>

                      {scanMessage && (
                        <div className={`p-4 rounded-lg text-sm font-extrabold ${
                          scanMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-300" : "bg-rose-50 text-rose-700 border-2 border-rose-300"
                        }`}>
                          {scanMessage.text}
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Putaway Action */}
                  <div className="bg-surface border border-gray-200 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Cất hàng vào vị trí (Put-away)</span>
                    </h4>
                    <form onSubmit={handlePutAway} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-500 block">Chọn SKU đã nhận *</label>
                        <select
                          value={putAwaySku}
                          onChange={(e) => setPutAwaySku(e.target.value)}
                          className="w-full p-2 bg-surface border border-gray-200 shadow-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                          required
                        >
                          <option value="" className="bg-surface">-- Chọn sản phẩm --</option>
                          {selectedShipment.items
                            .filter(item => item.received_qty > 0)
                            .map(item => (
                              <option key={item.id} value={item.sku_code} className="bg-surface">
                                {item.sku_code} (Đã nhận: {item.received_qty})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-gray-500 block">Chọn Ô kệ cất hàng *</label>
                        <select
                          value={putAwayLocId}
                          onChange={(e) => setPutAwayLocId(e.target.value)}
                          className="w-full p-2 bg-surface border border-gray-200 shadow-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900"
                          required
                        >
                          <option value="" className="bg-surface">-- Chọn vị trí ô kệ --</option>
                          {getFilteredLocations().map(loc => (
                            <option key={loc.id} value={loc.id.toString()} className="bg-surface">
                              {loc.location_code} ({loc.zone || "No Zone"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                      >
                        Xác nhận cất hàng
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Inbound Shipment Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto text-gray-900">
            <div className="flex justify-between items-center border-b pb-3 border-gray-200">
              <h3 className="text-sm font-extrabold text-gray-900">Tạo Mới Đơn Nhập Kho</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Số Đơn Nhập (Inbound Number) *</label>
                  <input
                    type="text"
                    value={inboundNumber}
                    onChange={(e) => setInboundNumber(e.target.value.toUpperCase())}
                    placeholder="VD: INB-2026-001"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Chọn Kho Hàng Nhận *</label>
                  <select
                    value={selectedWhId}
                    onChange={(e) => setSelectedWhId(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                    required
                  >
                    <option value="" className="bg-surface">Chọn Kho</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id.toString()} className="bg-surface">
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Nhà Cung Cấp (Supplier) *</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="VD: Tổng kho phân phối Unilever"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Người nhận (Receiver)</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A (Thủ kho)"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Số chứng từ gốc kèm theo</label>
                  <input
                    type="text"
                    value={originalDocumentNumber}
                    onChange={(e) => setOriginalDocumentNumber(e.target.value)}
                    placeholder="VD: HĐ-2026-1002"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Ngày dự kiến giao hàng</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thông tin ghi chú thêm..."
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                  rows={2}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2 border-t pt-4 border-gray-200">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Chi tiết mặt hàng</h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 rounded-lg"
                  >
                    Thêm dòng
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {itemsInput.map((row, idx) => (
                    <div key={idx} className="flex gap-2.5 items-end">
                      {!row.isManual ? (
                        <div className="flex-1 flex gap-2">
                          <div className="flex-1 space-y-1">
                            {idx === 0 && <label className="font-semibold text-gray-700">Chọn sản phẩm (SKU) *</label>}
                            <select
                              value={row.sku_code}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "MANUAL") {
                                  handleItemInputChange(idx, "isManual", true);
                                  handleItemInputChange(idx, "sku_code", "");
                                  handleItemInputChange(idx, "product_name", "");
                                } else {
                                  const match = barcodeMappings.find(m => m.sku_code === val);
                                  handleItemInputChange(idx, "sku_code", val);
                                  handleItemInputChange(idx, "product_name", match ? match.product_name + (match.variant_name ? ` (${match.variant_name})` : "") : "");
                                }
                              }}
                              className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                              required
                            >
                              <option value="">-- Chọn sản phẩm --</option>
                              {barcodeMappings.map((m, mIdx) => (
                                <option key={mIdx} value={m.sku_code}>
                                  [{m.sku_code}] {m.product_name} {m.variant_name ? `(${m.variant_name})` : ""}
                                </option>
                              ))}
                              <option value="MANUAL">➕ -- Nhập tay SKU mới... --</option>
                            </select>
                          </div>
                          {row.sku_code && (
                            <div className="flex-[1.5] space-y-1">
                              {idx === 0 && <label className="font-semibold text-gray-500">Tên Sản phẩm (Tồn hiện tại: {getSkuStock(row.sku_code)})</label>}
                              <input
                                type="text"
                                value={row.product_name}
                                disabled
                                className="w-full p-2.5 border border-gray-200 rounded-lg bg-surface text-gray-500 font-semibold"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex gap-2">
                          <div className="flex-1 space-y-1">
                            {idx === 0 && (
                              <div className="flex justify-between items-center">
                                <label className="font-semibold text-gray-700">Mã SKU *</label>
                                <button
                                  type="button"
                                  onClick={() => handleItemInputChange(idx, "isManual", false)}
                                  className="text-[9px] text-indigo-600 hover:underline"
                                  tabIndex={-1}
                                >
                                  Chọn sẵn
                                </button>
                              </div>
                            )}
                            <input
                              type="text"
                              value={row.sku_code}
                              onChange={(e) => handleItemInputChange(idx, "sku_code", e.target.value)}
                              placeholder="VD: SKU-SPORTS-BLUE-M"
                              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900 font-bold"
                              required
                            />
                          </div>
                          <div className="flex-[1.5] space-y-1">
                            {idx === 0 && <label className="font-semibold text-gray-700">Tên Sản phẩm * (Tồn hiện tại: {getSkuStock(row.sku_code)})</label>}
                            <input
                              type="text"
                              value={row.product_name}
                              onChange={(e) => handleItemInputChange(idx, "product_name", e.target.value)}
                              placeholder="VD: Áo thun nam size M"
                              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none bg-surface text-gray-900"
                              required
                            />
                          </div>
                        </div>
                      )}
                      <div className="w-32 space-y-1">
                        {idx === 0 && <label className="font-semibold text-gray-700 block text-right">Đơn giá nhập (VND) *</label>}
                        <input
                          type="number"
                          value={row.unit_cost}
                          onChange={(e) => handleItemInputChange(idx, "unit_cost", parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none text-right bg-surface text-gray-900"
                          min="0"
                          required
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        {idx === 0 && <label className="font-semibold text-gray-700 block text-right">SL dự kiến *</label>}
                        <input
                          type="number"
                          value={row.expected_qty}
                          onChange={(e) => handleItemInputChange(idx, "expected_qty", parseInt(e.target.value) || 1)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none text-right bg-surface text-gray-900"
                          min="1"
                          required
                        />
                      </div>
                      {itemsInput.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 border-gray-200 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-lg hover:bg-gray-100 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Tạo lô hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
