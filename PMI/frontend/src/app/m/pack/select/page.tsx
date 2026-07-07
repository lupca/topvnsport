"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { Package, ArrowRight, ClipboardList, RefreshCw } from "lucide-react";

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_id: number;
  oms_order_number: string;
  status: string;
}

export default function PackSelect() {
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
      // Pack flow displays orders in PICKED or PACKING status
      const active = data.filter((o) => o.status === "PICKED" || o.status === "PACKING");
      setOrders(active);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch picked orders");
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
      router.push(`/m/pack/${manualId.trim()}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-gray-200 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-brand-primary font-sans">PACK ORDER</h1>
          <p className="text-xs text-gray-500">Select picked order to start packing</p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Manual Input form */}
      <form onSubmit={handleManualSubmit} className="bg-surface border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 tracking-wider">ENTER ORDER ID OR NUMBER MANUALLY</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Order ID / Number (e.g. 1)"
            className="flex-1 bg-surface-hover border border-gray-300 rounded px-3 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-lg"
          />
          <button
            type="submit"
            className="bg-brand-primary hover:bg-brand-secondary active:bg-indigo-800 text-white font-bold px-4 py-3 rounded text-sm transition-colors"
          >
            GO
          </button>
        </div>
      </form>

      {/* Orders List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-gray-500 tracking-wider">READY FOR PACKING</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-500 bg-red-950/20 border border-red-900/40 rounded-lg">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-surface border border-gray-200 rounded-lg">
            No picked orders ready for packing
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/m/pack/${order.fulfillment_number}`)}
                className="flex items-center justify-between p-4 bg-surface border border-gray-200 hover:border-indigo-500/50 rounded-lg text-left transition-all duration-100 active:bg-surface"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-brand-primary/10 rounded mt-0.5">
                    <ClipboardList className="h-5 w-5 text-brand-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-base">{order.fulfillment_number}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      OMS Order: #{order.oms_order_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-primary/15 border border-indigo-500/35 text-brand-primary px-2 py-0.5 rounded uppercase font-semibold">
                    {order.status}
                  </span>
                  <ArrowRight className="h-5 w-5 text-gray-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
