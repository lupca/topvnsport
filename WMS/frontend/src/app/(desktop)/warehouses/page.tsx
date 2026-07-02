"use client";

import React, { useState, useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";
import {
  Home,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Loader2,
  AlertCircle,
  X
} from "lucide-react";
import { showConfirm } from "@/components/ui/popupService";

interface Warehouse {
  id: number;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  type: string | null; // STORAGE, RECEIVING, PACKING, SHIPPING
  is_active: boolean;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [loadingWh, setLoadingWh] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warehouse Modal States
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [whCode, setWhCode] = useState("");
  const [whName, setWhName] = useState("");
  const [whAddress, setWhAddress] = useState("");
  const [whActive, setWhActive] = useState(true);

  // Location Modal States
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [locCode, setLocCode] = useState("");
  const [locZone, setLocZone] = useState("");
  const [locType, setLocType] = useState("STORAGE");
  const [locActive, setLocActive] = useState(true);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoadingWh(true);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/warehouses`);
      if (!res.ok) throw new Error("Không thể tải danh sách kho.");
      const data = await res.json();
      setWarehouses(data);
      if (data.length > 0 && !selectedWarehouse) {
        handleSelectWarehouse(data[0]);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải kho hàng.");
    } finally {
      setLoadingWh(false);
    }
  };

  const handleSelectWarehouse = async (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    try {
      setLoadingLoc(true);
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/warehouses/${wh.id}/locations`);
      if (!res.ok) throw new Error("Không thể tải vị trí của kho.");
      const data = await res.json();
      setLocations(data);
    } catch (err: any) {
      alert(err.message || "Lỗi khi tải vị trí ô kệ.");
    } finally {
      setLoadingLoc(false);
    }
  };

  // Warehouse Submit
  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whCode || !whName) {
      alert("Mã kho và tên kho là bắt buộc!");
      return;
    }

    const payload = {
      code: whCode,
      name: whName,
      address: whAddress || null,
      is_active: whActive
    };

    try {
      const url = editingWh
        ? `${APP_SETTINGS.api.baseUrl}/warehouses/${editingWh.id}`
        : `${APP_SETTINGS.api.baseUrl}/warehouses`;
      const method = editingWh ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Có lỗi xảy ra khi lưu kho hàng.");
      }

      setIsWhModalOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Warehouse
  const handleWhDelete = async (id: number) => {
    if (!(await showConfirm("Bạn có chắc chắn muốn xóa kho này?"))) return;
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/warehouses/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Không thể xóa kho. Vui lòng kiểm tra lại liên kết dữ liệu.");
      if (selectedWarehouse?.id === id) {
        setSelectedWarehouse(null);
        setLocations([]);
      }
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Location Submit
  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    if (!locCode) {
      alert("Mã vị trí là bắt buộc!");
      return;
    }

    const payload = {
      warehouse_id: selectedWarehouse.id,
      location_code: locCode,
      zone: locZone || null,
      aisle: null,
      rack: null,
      shelf: null,
      type: locType,
      is_active: locActive
    };

    try {
      const url = editingLoc
        ? `${APP_SETTINGS.api.baseUrl}/locations/${editingLoc.id}`
        : `${APP_SETTINGS.api.baseUrl}/locations`;
      const method = editingLoc ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Có lỗi xảy ra khi lưu vị trí.");
      }

      setIsLocModalOpen(false);
      handleSelectWarehouse(selectedWarehouse);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Location
  const handleLocDelete = async (id: number) => {
    if (!(await showConfirm("Bạn có chắc chắn muốn xóa vị trí này?"))) return;
    try {
      const res = await fetch(`${APP_SETTINGS.api.baseUrl}/locations/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Không thể xóa vị trí.");
      }
      if (selectedWarehouse) {
        handleSelectWarehouse(selectedWarehouse);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openWhModal = (wh: Warehouse | null = null) => {
    setEditingWh(wh);
    if (wh) {
      setWhCode(wh.code);
      setWhName(wh.name);
      setWhAddress(wh.address || "");
      setWhActive(wh.is_active);
    } else {
      setWhCode("");
      setWhName("");
      setWhAddress("");
      setWhActive(true);
    }
    setIsWhModalOpen(true);
  };

  const openLocModal = (loc: Location | null = null) => {
    setEditingLoc(loc);
    if (loc) {
      setLocCode(loc.location_code);
      setLocZone(loc.zone || "");
      setLocType(loc.type || "STORAGE");
      setLocActive(loc.is_active);
    } else {
      setLocCode("");
      setLocZone("");
      setLocType("STORAGE");
      setLocActive(true);
    }
    setIsLocModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <Home className="w-5 h-5 text-indigo-500" />
            <span>Kho hàng & Vị trí</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý danh sách kho và các ô kệ lưu trữ chi tiết (STORAGE, RECEIVING, PACKING, SHIPPING)
          </p>
        </div>
        <button
          onClick={() => openWhModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Kho Hàng</span>
        </button>
      </div>

      {/* Main Grid split: Warehouses List (Left) & Locations List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Warehouse List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
              Danh sách Kho ({warehouses.length})
            </h3>
            {loadingWh ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : warehouses.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-8">Chưa có kho hàng nào.</div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto">
                {warehouses.map((wh) => (
                  <div
                    key={wh.id}
                    onClick={() => handleSelectWarehouse(wh)}
                    className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
                      selectedWarehouse?.id === wh.id
                        ? "bg-indigo-950/30 border border-indigo-900/50"
                        : "hover:bg-slate-850/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${wh.is_active ? "bg-emerald-950/30 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                        <Home className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{wh.name}</h4>
                        <p className="text-[10px] text-slate-400">Mã: {wh.code} • Created: {new Date(wh.created_at).toLocaleDateString()}</p>
                        {wh.address && <p className="text-[9px] text-slate-400 mt-0.5">{wh.address}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhModal(wh);
                        }}
                        className="p-1 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhDelete(wh.id);
                        }}
                        className="p-1 hover:bg-slate-850 text-slate-400 hover:text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Locations Detail Drill-down */}
        <div className="lg:col-span-7 space-y-4">
          {selectedWarehouse ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
                    <MapPin className="w-4.5 h-4.5 text-indigo-400" />
                    <span>Vị trí thuộc: {selectedWarehouse.name}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Quản lý sơ đồ ô kệ lưu trữ chi tiết</p>
                </div>
                <button
                  onClick={() => openLocModal()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Vị trí</span>
                </button>
              </div>

              {loadingLoc ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : locations.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                  <p className="text-xs text-slate-400">Kho hàng này chưa được định hình vị trí.</p>
                  <button
                    onClick={() => openLocModal()}
                    className="mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    Tạo vị trí đầu tiên ngay
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="py-2">Mã Vị trí</th>
                        <th className="py-2">Khu vực (Zone)</th>
                        <th className="py-2">Loại Vị trí</th>
                        <th className="py-2">Trạng thái</th>
                        <th className="py-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((loc) => (
                        <tr key={loc.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 font-semibold text-slate-200">{loc.location_code}</td>
                          <td className="py-3 text-slate-300">{loc.zone || "-"}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              loc.type === "STORAGE" ? "bg-blue-950/50 text-blue-400" :
                              loc.type === "RECEIVING" ? "bg-amber-950/50 text-amber-400" :
                              loc.type === "PACKING" ? "bg-violet-950/50 text-violet-400" :
                              "bg-emerald-950/50 text-emerald-400"
                            }`}>
                              {loc.type}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${loc.is_active ? "text-emerald-400" : "text-slate-400"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${loc.is_active ? "bg-emerald-500" : "bg-slate-700"}`}></span>
                              {loc.is_active ? "Hoạt động" : "Tạm khóa"}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1.5">
                            <button
                              onClick={() => openLocModal(loc)}
                              className="p-1 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 rounded inline-block"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLocDelete(loc.id)}
                              className="p-1 hover:bg-slate-850 text-slate-400 hover:text-rose-400 rounded inline-block"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900 text-slate-400 text-xs text-center py-20">
              Vui lòng chọn hoặc thêm kho hàng để xem danh sách vị trí chi tiết.
            </div>
          )}
        </div>
      </div>

      {/* --- Warehouse Create/Edit Modal --- */}
      {isWhModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-100">
                {editingWh ? "Cập nhật Kho Hàng" : "Thêm Kho Hàng Mới"}
              </h3>
              <button onClick={() => setIsWhModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleWhSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Mã Kho (Code) *</label>
                <input
                  type="text"
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                  disabled={!!editingWh}
                  placeholder="VD: WH-HCM, WH-HN"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-800 disabled:text-slate-400 bg-slate-950 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Tên Kho *</label>
                <input
                  type="text"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="VD: Kho HCM Quận 9"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Địa chỉ</label>
                <input
                  type="text"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  placeholder="Đường, Phường, Quận, Thành phố..."
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="whActive"
                  checked={whActive}
                  onChange={(e) => setWhActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 bg-slate-950"
                />
                <label htmlFor="whActive" className="font-semibold text-slate-300 cursor-pointer">Hoạt động</label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4 border-slate-800 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsWhModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-lg hover:bg-slate-800 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {editingWh ? "Lưu thay đổi" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Location Create/Edit Modal --- */}
      {isLocModalOpen && selectedWarehouse && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-100">
                {editingLoc ? "Cập nhật Vị trí" : `Thêm Vị trí cho ${selectedWarehouse.name}`}
              </h3>
              <button onClick={() => setIsLocModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLocSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Mã Vị trí / Ô kệ (Location Code) *</label>
                <input
                  type="text"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                  placeholder="VD: HCM-ZONEA-ROW1-SHELF2"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Khu vực (Zone)</label>
                <input
                  type="text"
                  value={locZone}
                  onChange={(e) => setLocZone(e.target.value)}
                  placeholder="VD: ZONE-A, ZONE-B"
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Loại Vị trí (Location Type)</label>
                <select
                  value={locType}
                  onChange={(e) => setLocType(e.target.value)}
                  className="w-full p-2.5 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-950 text-slate-100"
                >
                  <option value="STORAGE">STORAGE (Lưu kho tiêu chuẩn)</option>
                  <option value="RECEIVING">RECEIVING (Khu vực nhận hàng)</option>
                  <option value="PACKING">PACKING (Khu vực đóng gói)</option>
                  <option value="SHIPPING">SHIPPING (Khu vực xuất hàng)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="locActive"
                  checked={locActive}
                  onChange={(e) => setLocActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-800 rounded focus:ring-indigo-500 bg-slate-950"
                />
                <label htmlFor="locActive" className="font-semibold text-slate-300 cursor-pointer">Hoạt động</label>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4 border-slate-800 bg-transparent">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 font-bold rounded-lg hover:bg-slate-800 bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {editingLoc ? "Lưu thay đổi" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
