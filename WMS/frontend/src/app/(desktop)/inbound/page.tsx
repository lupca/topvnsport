"use client";

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
  warehouse_id: number;
  supplier_name: string;
  status: string; // pending, receiving, COMPLETED
  note: string | null;
  created_by: string | null;
  expected_date: string | null;
  received_date: string | null;
  created_at: string;
  items: InboundItem[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create Shipment Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inboundNumber, setInboundNumber] = useState("");
  const [selectedWhId, setSelectedWhId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [itemsInput, setItemsInput] = useState<{ sku_code: string; product_name: string; expected_qty: number; isManual?: boolean }[]>([
    { sku_code: "", product_name: "", expected_qty: 1, isManual: false }
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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shipRes, whRes, locRes, mapRes] = await Promise.all([
        fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments`),
        fetch(`${APP_SETTINGS.api.baseUrl}/warehouses`),
        fetch(`${APP_SETTINGS.api.baseUrl}/locations`),
        fetch(`${APP_SETTINGS.api.baseUrl}/barcode-mappings`)
      ]);

      if (!shipRes.ok || !whRes.ok || !locRes.ok || !mapRes.ok) {
        throw new Error("Không thể đồng bộ dữ liệu từ backend.");
      }

      const shipData = await shipRes.json();
      const whData = await whRes.json();
      const locData = await locRes.json();
      const mapData = await mapRes.json();

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
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải dữ liệu nhập kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShipment = async (shipment: InboundShipment) => {
    try {
      setLoading(true);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments/${shipment.id}`);
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
    setItemsInput((current) => [...current, { sku_code: "", product_name: "", expected_qty: 1, isManual: false }]);
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
      note: note || null,
      created_by: "Admin",
      expected_date: expectedDate ? new Date(expectedDate).toISOString() : null,
      items: filteredItems.map(item => ({
        sku_code: item.sku_code,
        product_name: item.product_name || item.sku_code,
        expected_qty: item.expected_qty,
        received_qty: 0,
        location_id: null,
        status: "pending"
      }))
    };

    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound-shipments`, {
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
      setNote("");
      setExpectedDate("");
      setItemsInput([{ sku_code: "", product_name: "", expected_qty: 1, isManual: false }]);
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
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/receive-scan`, {
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
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/put-away`, {
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
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inbound/${selectedShipment.id}/complete`, {
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 text-gray-900">
      <audio ref={successAudioRef} preload="auto" src="data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAAAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8AAP8=" />
      <audio ref={errorAudioRef} preload="auto" src="data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAAAAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////AAAA////" />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-indigo-500" />
            <span>Nhập Kho (Inbound Shipments)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
              Danh sách Đơn Nhập ({shipments.length})
            </h3>
            {loading && shipments.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-8">Chưa có lô hàng nhập kho nào.</div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto pr-1">
                {shipments.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectShipment(s)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${
                      selectedShipment?.id === s.id
                        ? "bg-indigo-950/30 border border-indigo-900/50 shadow-sm"
                        : "hover:bg-slate-850/50 border border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{s.inbound_number}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Nhà cung cấp: {s.supplier_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        s.status === "COMPLETED" ? "bg-emerald-950/50 text-emerald-405 text-emerald-400 border border-emerald-900/50" :
                        s.status === "receiving" ? "bg-amber-950/50 text-amber-400 border border-amber-900/50 animate-pulse" :
                        "bg-blue-950/50 text-blue-400 border border-blue-900/50"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 border-t pt-2 border-slate-800">
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
            <div className="absolute inset-y-0 right-0 w-full max-w-6xl bg-white border-l border-gray-200 rounded-l-2xl p-6 shadow-2xl overflow-y-auto space-y-6">
              <div className="flex justify-between items-start border-b pb-4 border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-extrabold text-gray-900">{selectedShipment.inbound_number}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Trạng thái: <span className="font-bold uppercase text-gray-900">{selectedShipment.status}</span> • Kho: {getWarehouseName(selectedShipment.warehouse_id)}
                  </p>
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
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                    aria-label="Đóng drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Danh sách sản phẩm trong đơn</span>
                </h4>
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-450 text-slate-400 font-bold border-b border-slate-800">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Tên sản phẩm</th>
                        <th className="p-3 text-right">Dự kiến</th>
                        <th className="p-3 text-right">Đã nhận</th>
                        <th className="p-3">Vị trí cất</th>
                        <th className="p-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShipment.items.map((item) => (
                        <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="p-3 font-bold text-slate-200">{item.sku_code}</td>
                          <td className="p-3 text-slate-350 text-slate-300 font-semibold">{item.product_name}</td>
                          <td className="p-3 text-right font-extrabold text-slate-300">{item.expected_qty}</td>
                          <td className="p-3 text-right font-extrabold text-indigo-400">{item.received_qty}</td>
                          <td className="p-3">
                            <span className="bg-slate-850 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-850">
                              {getLocationCode(item.location_id)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              item.status === "put_away" ? "bg-emerald-950/50 text-emerald-400" :
                              item.status === "received" ? "bg-indigo-950/50 text-indigo-400" :
                              "bg-slate-850 text-slate-400"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-slate-800">
                  {/* Scanner Simulator */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Scan className="w-4 h-4 text-indigo-400" />
                      <span>Giả lập máy quét nhận hàng (Receive Scan)</span>
                    </h4>
                    <form onSubmit={handleScanReceive} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400 block">Quét Barcode sản phẩm *</label>
                        <div className="relative">
                          <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            ref={scanInputRef}
                            type="text"
                            data-testid="barcode-manual-input"
                            placeholder="Nhập mã barcode (VD: BAR-SKU-SPORTS-BLUE-M)"
                            value={scanBarcode}
                            onChange={(e) => setScanBarcode(e.target.value)}
                            className="w-full pl-10 pr-3 py-3 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-lg font-semibold"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400 block">Số lượng quét nhận</label>
                        <input
                          type="number"
                          value={scanQty}
                          onChange={(e) => setScanQty(parseInt(e.target.value))}
                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
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
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>Cất hàng vào vị trí (Put-away)</span>
                    </h4>
                    <form onSubmit={handlePutAway} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400 block">Chọn SKU đã nhận *</label>
                        <select
                          value={putAwaySku}
                          onChange={(e) => setPutAwaySku(e.target.value)}
                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
                          required
                        >
                          <option value="" className="bg-slate-900">-- Chọn sản phẩm --</option>
                          {selectedShipment.items
                            .filter(item => item.received_qty > 0)
                            .map(item => (
                              <option key={item.id} value={item.sku_code} className="bg-slate-900">
                                {item.sku_code} (Đã nhận: {item.received_qty})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-400 block">Chọn Ô kệ cất hàng *</label>
                        <select
                          value={putAwayLocId}
                          onChange={(e) => setPutAwayLocId(e.target.value)}
                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
                          required
                        >
                          <option value="" className="bg-slate-900">-- Chọn vị trí ô kệ --</option>
                          {getFilteredLocations().map(loc => (
                            <option key={loc.id} value={loc.id.toString()} className="bg-slate-900">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-xl border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-100">Tạo Mới Đơn Nhập Kho</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Số Đơn Nhập (Inbound Number) *</label>
                  <input
                    type="text"
                    value={inboundNumber}
                    onChange={(e) => setInboundNumber(e.target.value.toUpperCase())}
                    placeholder="VD: INB-2026-001"
                    className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Chọn Kho Hàng Nhận *</label>
                  <select
                    value={selectedWhId}
                    onChange={(e) => setSelectedWhId(e.target.value)}
                    className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                    required
                  >
                    <option value="" className="bg-slate-900">Chọn Kho</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id.toString()} className="bg-slate-900">
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Nhà Cung Cấp (Supplier) *</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="VD: Tổng kho phân phối Unilever"
                    className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Ngày dự kiến giao hàng</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Ghi chú</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thông tin ghi chú thêm..."
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                  rows={2}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2 border-t pt-4 border-slate-800">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Chi tiết mặt hàng</h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 text-[10px] font-bold bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg"
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
                            {idx === 0 && <label className="font-semibold text-slate-300">Chọn sản phẩm (SKU) *</label>}
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
                              className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
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
                              {idx === 0 && <label className="font-semibold text-slate-400">Tên Sản phẩm</label>}
                              <input
                                type="text"
                                value={row.product_name}
                                disabled
                                className="w-full p-2.5 border border-slate-800 rounded-lg bg-slate-900 text-slate-400 font-semibold"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex gap-2">
                          <div className="flex-1 space-y-1">
                            {idx === 0 && (
                              <div className="flex justify-between items-center">
                                <label className="font-semibold text-slate-300">Mã SKU *</label>
                                <button
                                  type="button"
                                  onClick={() => handleItemInputChange(idx, "isManual", false)}
                                  className="text-[9px] text-indigo-400 hover:underline"
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
                              className="w-full p-2 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100 font-bold"
                              required
                            />
                          </div>
                          <div className="flex-[1.5] space-y-1">
                            {idx === 0 && <label className="font-semibold text-slate-300">Tên Sản phẩm *</label>}
                            <input
                              type="text"
                              value={row.product_name}
                              onChange={(e) => handleItemInputChange(idx, "product_name", e.target.value)}
                              placeholder="VD: Áo thun nam size M"
                              className="w-full p-2 border border-slate-800 rounded-lg focus:outline-none bg-slate-950 text-slate-100"
                              required
                            />
                          </div>
                        </div>
                      )}
                      <div className="w-24 space-y-1">
                        {idx === 0 && <label className="font-semibold text-slate-300 block text-right">SL dự kiến *</label>}
                        <input
                          type="number"
                          value={row.expected_qty}
                          onChange={(e) => handleItemInputChange(idx, "expected_qty", parseInt(e.target.value))}
                          className="w-full p-2 border border-slate-800 rounded-lg focus:outline-none text-right bg-slate-950 text-slate-100"
                          min="1"
                          required
                        />
                      </div>
                      {itemsInput.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-2 border border-rose-900/50 hover:bg-rose-950 text-rose-400 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 border-slate-800 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-lg hover:bg-slate-800 bg-transparent"
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
