"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScannerComponent from "@/components/ScannerComponent";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { CheckSquare, CheckCircle, ArrowLeft, AlertCircle, MapPin } from "lucide-react";
import { popupService } from "@/components/ui/popupService";

interface PickListItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  quantity: number;
  picked_qty: number;
  status: string;
}

interface Location {
  id: number;
  location_code: string;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_id: number;
  oms_order_number: string;
  status: string;
  pick_list_items: PickListItem[];
}

export default function PickFlow() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [locations, setLocations] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);

  const fetchOrder = async () => {
    try {
      const data: FulfillmentOrder = await wmsFetch(`/fulfillment-orders/${id}`);
      setOrder(data);

      // Load locations
      const locRes = await fetch(`${WMS_API_URL}/locations`);
      if (locRes.ok) {
        const locData: Location[] = await locRes.json();
        const locMap: Record<number, string> = {};
        locData.forEach((l) => {
          locMap[l.id] = l.location_code;
        });
        setLocations(locMap);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load picking order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleStartPicking = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${WMS_API_URL}/fulfillment-orders/${id}/start-pick`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Không thể bắt đầu phiên nhặt hàng");
      }
      setSuccessMessage("Picking started!");
      fetchOrder();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error starting picking");
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmittingScan(true);
    try {
      const response = await fetch(`${WMS_API_URL}/fulfillment-orders/${id}/scan-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to scan picked item");
      }
      setSuccessMessage(`Picked: ${data.product_name} (${data.sku_code})`);
      fetchOrder();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error scanning barcode");
    } finally {
      setIsSubmittingScan(false);
    }
  };

  const handleCompletePicking = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${WMS_API_URL}/fulfillment-orders/${id}/complete-pick`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to complete picking");
      }
      void popupService.alert("Nhặt hàng cho đơn đã hoàn tất!");
      router.push("/m/pick/select");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error completing picking");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
        <span>Loading picking task...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 flex flex-col gap-4 text-center">
        <div className="text-red-500 font-bold">Picking Order Not Found</div>
        <button onClick={() => router.back()} className="text-amber-500 underline">
          Go Back
        </button>
      </div>
    );
  }

  const isPending = order.status === "PENDING";
  const allPicked = order.pick_list_items.every((item) => item.picked_qty >= item.quantity);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/m/pick/select")}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <div className="text-right">
          <h1 className="text-lg font-bold text-blue-500">{order.fulfillment_number}</h1>
          <p className="text-xs text-slate-450">OMS Order: #{order.oms_order_number}</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status</span>
        <span className="text-xs font-semibold bg-blue-500/15 border border-blue-500/35 text-blue-400 px-2 py-0.5 rounded uppercase">
          {order.status}
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-200 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="text-xs font-semibold">{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-250 p-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {isPending ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-slate-350">This pick task has not started yet. Ready to pick items?</p>
          <button
            onClick={handleStartPicking}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-lg select-none shadow-md shadow-blue-950/40"
          >
            START PICKING
          </button>
        </div>
      ) : (
        <>
          {/* Scanner wrapper */}
          <ScannerComponent onScanSuccess={handleBarcodeScan} placeholder="Scan item barcode to pick..." disabled={isSubmittingScan} />

          {/* Items list */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-slate-400 tracking-wider">PICK LIST ITEMS</h2>
            <div className="flex flex-col gap-2">
              {order.pick_list_items.map((item) => {
                const isCompleted = item.picked_qty >= item.quantity;
                const locCode = locations[item.location_id] || `Loc ID ${item.location_id}`;
                return (
                  <div
                    key={item.id}
                    className={`p-3 bg-slate-900 border rounded-lg flex flex-col gap-2 ${
                      isCompleted ? "border-slate-800 opacity-60" : "border-blue-500/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-slate-400">{item.sku_code}</span>
                        <h3 className="font-bold text-slate-200 text-sm mt-0.5 leading-tight">{item.product_name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-400">Pick</span>
                        <div className="text-base font-bold text-slate-100">
                          <span className={isCompleted ? "text-emerald-500" : "text-blue-500"}>
                            {item.picked_qty}
                          </span>
                          {" "}/ {item.quantity}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-850 pt-2 flex items-center justify-between text-xs text-slate-450 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                        Location: <strong className="text-slate-250 text-sm">{locCode}</strong>
                      </span>
                      <span className="uppercase text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete Button */}
          <button
            onClick={handleCompletePicking}
            disabled={!allPicked && order.status !== "PICKED"}
            className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg text-center select-none shadow-md shadow-blue-950/40 text-base"
          >
            COMPLETE PICKING
          </button>
        </>
      )}
    </div>
  );
}
