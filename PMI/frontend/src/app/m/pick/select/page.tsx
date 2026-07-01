"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { CheckSquare, ArrowRight, ClipboardList, RefreshCw } from "lucide-react";

interface PickOrderItem {
  id: number;
  sku_code: string;
  product_name: string;
  quantity: number;
  picked_qty: number;
  status: string;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_id: number;
  oms_order_number: string;
  status: string;
  pick_list_items?: PickOrderItem[];
}

export default function PickSelect() {
  const router = useRouter();
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: FulfillmentOrder[] = await wmsFetch("/fulfillment-orders");
      // Pick flow shows orders in PENDING or PICKING status
      const active = data.filter((o) => o.status === "PENDING" || o.status === "PICKING");
      setOrders(active);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch fulfillment orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      router.push(`/m/pick/${manualId.trim()}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-blue-500 font-sans">PICK ORDER</h1>
          <p className="text-xs text-slate-400">Select order to start picking</p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Manual Input form */}
      <form onSubmit={handleManualSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
        <label className="text-xs font-bold text-slate-400 tracking-wider">ENTER ORDER ID OR NUMBER MANUALLY</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Order ID / Number (e.g. 1)"
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-lg"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-4 py-3 rounded text-sm transition-colors"
          >
            GO
          </button>
        </div>
      </form>

      {/* Orders List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-slate-400 tracking-wider">PENDING PICK TASKS</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-500 bg-red-950/20 border border-red-900/40 rounded-lg">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-lg">
            No pending pick tasks found
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/m/pick/${order.fulfillment_number}`)}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-lg text-left transition-all duration-100 active:bg-slate-850"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded mt-0.5">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-100 text-base">{order.fulfillment_number}</div>
                    <div className="text-xs text-slate-450 mt-1">
                      OMS Order: #{order.oms_order_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-500/15 border border-blue-500/35 text-blue-400 px-2 py-0.5 rounded uppercase font-semibold">
                    {order.status}
                  </span>
                  <ArrowRight className="h-5 w-5 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
