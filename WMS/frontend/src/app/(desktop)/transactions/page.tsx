"use client";

import React, { useState, useEffect } from "react";
import { APP_SETTINGS } from "@/config/settings";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  MapPin
} from "lucide-react";
import DataTable from "@/components/ui/DataTable";

interface StockTransaction {
  id: number;
  sku_code: string;
  location_id: number;
  transaction_type: string; // INBOUND, OUTBOUND, ADJUST, TRANSFER, RESERVE, UNRESERVE
  quantity: number;
  note: string | null;
  created_at: string;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [skuFilter, setSkuFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [txRes, locRes, whRes] = await Promise.all([
        fetch(`${APP_SETTINGS.api.baseUrl}/stock-transactions`),
        fetch(`${APP_SETTINGS.api.baseUrl}/locations`),
        fetch(`${APP_SETTINGS.api.baseUrl}/warehouses`)
      ]);

      if (!txRes.ok || !locRes.ok || !whRes.ok) {
        throw new Error("Không thể đồng bộ dữ liệu lịch sử giao dịch.");
      }

      const txData = await txRes.json();
      const locData = await locRes.json();
      const whData = await whRes.json();

      setTransactions(txData);
      setLocations(locData);
      setWarehouses(whData);
    } catch (err: any) {
      setError(err.message || "Lỗi tải lịch sử giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  const getLocationCode = (id: number) => {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return `ID: ${id}`;
    const wh = warehouses.find((w) => w.id === loc.warehouse_id);
    return wh ? `[${wh.code}] ${loc.location_code}` : loc.location_code;
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSku = tx.sku_code.toLowerCase().includes(skuFilter.toLowerCase());
    const matchesType = typeFilter === "ALL" || tx.transaction_type === typeFilter;
    const matchesLocation = locationFilter === "ALL" || tx.location_id.toString() === locationFilter;
    return matchesSku && matchesType && matchesLocation;
  });

  const columns = [
    {
      key: "created_at",
      label: "Thời gian",
      render: (tx: StockTransaction) => (
        <span className="text-slate-450 text-slate-400 font-medium">
          {new Date(tx.created_at).toLocaleString("vi-VN")}
        </span>
      )
    },
    {
      key: "sku_code",
      label: "Mã SKU",
      render: (tx: StockTransaction) => (
        <span className="font-bold text-slate-200">{tx.sku_code}</span>
      )
    },
    {
      key: "transaction_type",
      label: "Loại giao dịch",
      render: (tx: StockTransaction) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          tx.transaction_type === "INBOUND" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" :
          tx.transaction_type === "OUTBOUND" ? "bg-rose-950/50 text-rose-400 border border-rose-900/50" :
          tx.transaction_type === "ADJUST" ? "bg-amber-950/50 text-amber-400 border border-amber-900/50" :
          tx.transaction_type === "TRANSFER" ? "bg-blue-950/50 text-blue-400 border border-blue-900/50" :
          "bg-slate-800 text-slate-300"
        }`}>
          {tx.transaction_type}
        </span>
      )
    },
    {
      key: "quantity",
      label: "Số lượng (Delta)",
      render: (tx: StockTransaction) => (
        <span className={`font-extrabold ${tx.quantity >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {tx.quantity >= 0 ? `+${tx.quantity}` : tx.quantity}
        </span>
      )
    },
    {
      key: "location_id",
      label: "Vị trí (Location)",
      render: (tx: StockTransaction) => (
        <span className="bg-slate-850 text-slate-300 px-2 py-0.5 rounded font-bold border border-slate-800">
          {getLocationCode(tx.location_id)}
        </span>
      )
    },
    {
      key: "note",
      label: "Chi tiết ghi chú / Ref",
      render: (tx: StockTransaction) => (
        <span className="text-slate-450 text-slate-400 font-medium italic">{tx.note || "-"}</span>
      )
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            <span>Nhật ký Giao dịch Kho (Transactions Ledger)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tra cứu toàn bộ lịch sử biến động số lượng tồn kho (Nhập kho, xuất kho, điều chỉnh vật lý, dịch chuyển vị trí)
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors inline-flex items-center gap-1.5 font-bold text-xs text-slate-200"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Toolbar Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 border border-slate-800 rounded-2xl shadow-sm">
        {/* Search SKU */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Lọc theo mã SKU sản phẩm..."
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
          />
        </div>

        {/* Filter Type */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none w-full"
          >
            <option value="ALL" className="bg-slate-900">Tất cả loại giao dịch</option>
            <option value="INBOUND" className="bg-slate-900">INBOUND (Nhập kho)</option>
            <option value="OUTBOUND" className="bg-slate-900">OUTBOUND (Xuất kho)</option>
            <option value="ADJUST" className="bg-slate-900">ADJUST (Điều chỉnh số lượng)</option>
            <option value="TRANSFER" className="bg-slate-900">TRANSFER (Dịch chuyển ô kệ)</option>
            <option value="RESERVE" className="bg-slate-900">RESERVE (Giữ hàng xuất)</option>
            <option value="UNRESERVE" className="bg-slate-900">UNRESERVE (Hủy giữ hàng)</option>
          </select>
        </div>

        {/* Filter Location */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
          <MapPin className="w-4 h-4 text-slate-400" />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none w-full"
          >
            <option value="ALL" className="bg-slate-900">Tất cả vị trí</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id.toString()} className="bg-slate-900">
                {getLocationCode(loc.id)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-900/50 rounded-2xl text-xs font-semibold text-rose-400">
          {error}
        </div>
      )}

      {/* Main Table */}
      <DataTable<StockTransaction>
        title="Giao dịch kho hàng"
        description="Nhật ký chi tiết các giao dịch tăng giảm, dịch chuyển tồn kho thực tế"
        data={filteredTransactions}
        columns={columns}
        loading={loading}
      />
    </div>
  );
}
