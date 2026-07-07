"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { Download, ArrowRight, Calendar, User, Search, RefreshCw } from "lucide-react";

interface InboundShipment {
  id: number;
  inbound_number: string;
  supplier_name: string;
  status: string;
  expected_date?: string;
}

export default function ReceiveSelect() {
  const router = useRouter();
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: InboundShipment[] = await wmsFetch("/inbound-shipments");
      // Filter out completed ones to keep scanner list clean
      const active = data.filter((s) => s.status.toLowerCase() !== "completed");
      setShipments(active);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch inbound shipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      router.push(`/m/receive/${manualId.trim()}`);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-gray-200 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-emerald-500 font-sans">RECEIVE</h1>
          <p className="text-xs text-gray-500">Select inbound shipment to receive</p>
        </div>
        <button
          onClick={loadShipments}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Manual Input form */}
      <form onSubmit={handleManualSubmit} className="bg-surface border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 tracking-wider">ENTER SHIPMENT ID MANUALLY</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Shipment ID (e.g. 1)"
            className="flex-1 bg-surface-hover border border-gray-300 rounded px-3 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 text-lg"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-3 rounded text-sm transition-colors"
          >
            GO
          </button>
        </div>
      </form>

      {/* Shipments List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-gray-500 tracking-wider">ACTIVE INBOUND SHIPMENTS</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-red-500 bg-red-950/20 border border-red-900/40 rounded-lg">
            {error}
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-surface border border-gray-200 rounded-lg">
            No active shipments found
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shipments.map((shipment) => (
              <button
                key={shipment.id}
                onClick={() => router.push(`/m/receive/${shipment.id}`)}
                className="flex items-center justify-between p-4 bg-surface border border-gray-200 hover:border-emerald-500/50 rounded-lg text-left transition-all duration-100 active:bg-surface"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded mt-0.5">
                    <Download className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-base">{shipment.inbound_number}</div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> Supplier: {shipment.supplier_name}
                      </span>
                      {shipment.expected_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Expected: {shipment.expected_date.split("T")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-primary/15 border border-brand-primary/35 text-brand-primary px-2 py-0.5 rounded uppercase font-semibold">
                    {shipment.status}
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
