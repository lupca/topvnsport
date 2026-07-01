"use client";

import React, { useState, useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";
import {
  Package,
  Sliders,
  Move,
  Search,
  Filter,
  RefreshCw,
  X
} from "lucide-react";
import DataTable from "@/components/ui/DataTable";

interface InventoryItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  updated_at: string;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
  zone: string | null;
  type: string | null;
  is_active: boolean;
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");

  // Adjust Modal States
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustSku, setAdjustSku] = useState("");
  const [adjustLocId, setAdjustLocId] = useState("");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  // Transfer Modal States
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferSku, setTransferSku] = useState("");
  const [transferFromLocId, setTransferFromLocId] = useState("");
  const [transferToLocId, setTransferToLocId] = useState("");
  const [transferQty, setTransferQty] = useState(0);
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [invRes, locRes, whRes] = await Promise.all([
        fetch(`${APP_SETTINGS.api.baseUrl}/inventory`),
        fetch(`${APP_SETTINGS.api.baseUrl}/locations`),
        fetch(`${APP_SETTINGS.api.baseUrl}/warehouses`)
      ]);

      if (!invRes.ok || !locRes.ok || !whRes.ok) {
        throw new Error("Không thể đồng bộ dữ liệu từ backend.");
      }

      const invData = await invRes.json();
      const locData = await locRes.json();
      const whData = await whRes.json();

      setInventory(invData);
      setLocations(locData);
      setWarehouses(whData);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu tồn kho.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustSku || !adjustLocId || adjustQty === 0) {
      alert("Vui lòng nhập đầy đủ SKU, Vị trí và số lượng khác 0.");
      return;
    }

    const payload = {
      sku_code: adjustSku,
      location_id: parseInt(adjustLocId),
      quantity: adjustQty,
      note: adjustNote || null
    };

    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inventory/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể điều chỉnh tồn kho.");
      }

      setIsAdjustOpen(false);
      fetchData();
      alert("Điều chỉnh tồn kho thành công!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSku || !transferFromLocId || !transferToLocId || transferQty <= 0) {
      alert("Vui lòng điền đầy đủ thông tin giao dịch chuyển kho.");
      return;
    }
    if (transferFromLocId === transferToLocId) {
      alert("Vị trí nguồn và vị trí đích không được trùng nhau.");
      return;
    }

    const payload = {
      sku_code: transferSku,
      from_location_id: parseInt(transferFromLocId),
      to_location_id: parseInt(transferToLocId),
      quantity: transferQty,
      note: transferNote || null
    };

    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/inventory/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Lỗi thực hiện chuyển kho.");
      }

      setIsTransferOpen(false);
      fetchData();
      alert("Chuyển vị trí tồn kho thành công!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getLocationCode = (id: number) => {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return `ID: ${id}`;
    const wh = warehouses.find((w) => w.id === loc.warehouse_id);
    return wh ? `[${wh.code}] ${loc.location_code}` : loc.location_code;
  };

  const getWarehouseName = (locationId: number) => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return "-";
    const wh = warehouses.find((w) => w.id === loc.warehouse_id);
    return wh ? wh.name : "-";
  };

  // Filter Inventory
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.sku_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedWarehouseId === "ALL") return matchesSearch;

    const loc = locations.find((l) => l.id === item.location_id);
    const matchesWh = loc?.warehouse_id.toString() === selectedWarehouseId;
    return matchesSearch && matchesWh;
  });

  const openAdjustModal = (item?: InventoryItem) => {
    if (item) {
      setAdjustSku(item.sku_code);
      setAdjustLocId(item.location_id.toString());
    } else {
      setAdjustSku("");
      setAdjustLocId("");
    }
    setAdjustQty(0);
    setAdjustNote("");
    setIsAdjustOpen(true);
  };

  const openTransferModal = (item?: InventoryItem) => {
    if (item) {
      setTransferSku(item.sku_code);
      setTransferFromLocId(item.location_id.toString());
      setTransferQty(item.qty_on_hand - item.qty_reserved);
    } else {
      setTransferSku("");
      setTransferFromLocId("");
      setTransferQty(0);
    }
    setTransferToLocId("");
    setTransferNote("");
    setIsTransferOpen(true);
  };

  const columns = [
    {
      key: "sku_code",
      label: "SKU",
      render: (item: InventoryItem) => (
        <span className="font-bold text-slate-200">{item.sku_code}</span>
      )
    },
    {
      key: "product_name",
      label: "Tên Sản Phẩm",
      render: (item: InventoryItem) => (
        <span className="font-semibold text-slate-300">{item.product_name}</span>
      )
    },
    {
      key: "warehouse",
      label: "Kho Hàng",
      render: (item: InventoryItem) => (
        <span className="text-slate-450 text-slate-400 font-medium">{getWarehouseName(item.location_id)}</span>
      )
    },
    {
      key: "location",
      label: "Vị trí (Location)",
      render: (item: InventoryItem) => (
        <span className="bg-slate-850 text-slate-300 px-2 py-0.5 rounded font-bold border border-slate-850">
          {getLocationCode(item.location_id)}
        </span>
      )
    },
    {
      key: "qty_on_hand",
      label: "Tổng On-Hand",
      render: (item: InventoryItem) => (
        <span className="font-extrabold text-slate-100">{item.qty_on_hand}</span>
      )
    },
    {
      key: "qty_reserved",
      label: "Đã giữ (Reserved)",
      render: (item: InventoryItem) => (
        <span className="font-bold text-slate-400">{item.qty_reserved}</span>
      )
    },
    {
      key: "qty_available",
      label: "Khả Dụng (Available)",
      render: (item: InventoryItem) => {
        const qtyAvailable = item.qty_on_hand - item.qty_reserved;
        return (
          <span className={`px-2 py-0.5 rounded font-bold ${
            qtyAvailable <= 0 ? "bg-rose-955 bg-rose-950/50 text-rose-450 text-rose-400" :
            qtyAvailable < 10 ? "bg-amber-955 bg-amber-950/50 text-amber-400" :
            "bg-emerald-950/50 text-emerald-400"
          }`}>
            {qtyAvailable}
          </span>
        );
      }
    },
    {
      key: "actions",
      label: "Thao tác",
      render: (item: InventoryItem) => (
        <div className="space-x-1">
          <button
            onClick={() => openAdjustModal(item)}
            className="px-2.5 py-1 text-[10px] font-bold border border-slate-800 hover:border-indigo-500 hover:text-indigo-400 text-slate-300 rounded-lg transition-colors"
          >
            Chỉnh
          </button>
          <button
            onClick={() => openTransferModal(item)}
            className="px-2.5 py-1 text-[10px] font-bold border border-slate-800 hover:border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300 rounded-lg transition-colors"
          >
            Chuyển
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            <span>Tồn kho thực tế (Inventory)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý số lượng tồn kho (On Hand, Reserved, Available) và dịch chuyển ô kệ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openAdjustModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            <Sliders className="w-4 h-4" />
            <span>Điều chỉnh tồn kho</span>
          </button>
          <button
            onClick={() => openTransferModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            <Move className="w-4 h-4" />
            <span>Dịch chuyển hàng</span>
          </button>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 border border-slate-800 rounded-2xl shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo SKU, Tên sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none"
            >
              <option value="ALL" className="bg-slate-900">Tất cả kho hàng</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id.toString()} className="bg-slate-900">
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-900/50 rounded-2xl text-xs font-semibold text-rose-400">
          {error}
        </div>
      )}

      {/* Main Table */}
      <DataTable<InventoryItem>
        title="Danh sách tồn kho"
        description="Quản lý chi tiết số lượng sản phẩm tồn kho trên từng ô kệ và vị trí"
        data={filteredInventory}
        columns={columns}
        loading={loading}
      />

      {/* --- Adjust Quantity Modal --- */}
      {isAdjustOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-100">
                Điều chỉnh tồn kho (Adjust Stock)
              </h3>
              <button onClick={() => setIsAdjustOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Mã SKU *</label>
                <input
                  type="text"
                  value={adjustSku}
                  onChange={(e) => setAdjustSku(e.target.value)}
                  placeholder="VD: SKU-SPORTS-BLUE-M"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Vị trí Ô kệ (Location) *</label>
                <select
                  value={adjustLocId}
                  onChange={(e) => setAdjustLocId(e.target.value)}
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                >
                  <option value="" className="bg-slate-900">Chọn Vị trí</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id.toString()} className="bg-slate-900">
                      {getLocationCode(loc.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Số lượng điều chỉnh (Delta) *</label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value))}
                  placeholder="Ví dụ: +5 để nhập thêm, -3 để giảm bớt"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Nhập số dương để Tăng tồn kho; Số âm để Giảm tồn kho.
                </span>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Ghi chú / Lý do điều chỉnh</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="VD: Kiểm kho định kỳ phát hiện thừa/thiếu"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-4 border-slate-800 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-lg hover:bg-slate-800 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Đồng ý điều chỉnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Transfer Stock Modal --- */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-100">
                Dịch chuyển hàng (Transfer Stock)
              </h3>
              <button onClick={() => setIsTransferOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Mã SKU *</label>
                <input
                  type="text"
                  value={transferSku}
                  onChange={(e) => setTransferSku(e.target.value)}
                  placeholder="VD: SKU-SPORTS-BLUE-M"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Từ vị trí nguồn *</label>
                <select
                  value={transferFromLocId}
                  onChange={(e) => setTransferFromLocId(e.target.value)}
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                >
                  <option value="" className="bg-slate-900">Chọn Vị trí Nguồn</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id.toString()} className="bg-slate-900">
                      {getLocationCode(loc.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Đến vị trí đích *</label>
                <select
                  value={transferToLocId}
                  onChange={(e) => setTransferToLocId(e.target.value)}
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                >
                  <option value="" className="bg-slate-900">Chọn Vị trí Đích</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id.toString()} className="bg-slate-900">
                      {getLocationCode(loc.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Số lượng dịch chuyển *</label>
                <input
                  type="number"
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value))}
                  placeholder="Số lượng sản phẩm"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  min="1"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Ghi chú</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Lý do chuyển vị trí..."
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-4 border-slate-800 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-lg hover:bg-slate-800 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Thực hiện chuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
