"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScannerComponent from "@/components/ScannerComponent";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { Package, CheckCircle, ArrowLeft, AlertCircle, Truck } from "lucide-react";
import { popupService } from "@/components/ui/popupService";

interface PackListItem {
  id: number;
  sku_code: string;
  product_name: string;
  quantity: number;
  picked_qty: number;
}

interface PackingSession {
  id: number;
  status: string;
  tracking_number: string;
  carrier_name: string;
}

interface FulfillmentOrder {
  id: number;
  fulfillment_number: string;
  oms_order_id: number;
  oms_order_number: string;
  status: string;
  pick_list_items: PackListItem[];
  packing_sessions?: PackingSession[];
}

export default function PackFlow() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("Default Carrier");
  const [isSubmittingPack, setIsSubmittingPack] = useState(false);

  const fetchOrder = async () => {
    try {
      const data: FulfillmentOrder = await wmsFetch(`/fulfillment-orders/${id}`);
      setOrder(data);

      // Pre-populate tracking info if there's already a session
      if (data.packing_sessions && data.packing_sessions.length > 0) {
        const session = data.packing_sessions[0];
        setTrackingNumber(session.tracking_number);
        setCarrierName(session.carrier_name || "Default Carrier");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load pack order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleScanTracking = async (scannedTracking: string) => {
    setTrackingNumber(scannedTracking);
    setError(null);
    setSuccessMessage(null);
    setIsSubmittingPack(true);

    try {
      const response = await fetch(`${WMS_API_URL}/fulfillment-orders/${id}/scan-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_number: scannedTracking,
          carrier_name: carrierName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to scan pack session");
      }
      setSuccessMessage(`Tracking registered: ${scannedTracking}`);
      fetchOrder();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error scanning tracking number");
    } finally {
      setIsSubmittingPack(false);
    }
  };

  const handleCompletePacking = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      // Ensure tracking number is registered first
      if (!trackingNumber) {
        throw new Error("Must register a tracking number before completing pack");
      }
      const response = await fetch(`${WMS_API_URL}/fulfillment-orders/${id}/complete-pack`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to complete packing");
      }
      void popupService.alert("Đóng gói đơn hàng thành công!");
      router.push("/m/pack/select");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error completing packing");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-3"></div>
        <span>Loading packing order...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 flex flex-col gap-4 text-center">
        <div className="text-red-500 font-bold">Packing Order Not Found</div>
        <button onClick={() => router.back()} className="text-brand-primary underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/m/pack/select")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <div className="text-right">
          <h1 className="text-lg font-bold text-brand-primary">{order.fulfillment_number}</h1>
          <p className="text-xs text-gray-500">OMS Order: #{order.oms_order_number}</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-surface border border-gray-200 rounded-lg p-3 flex justify-between items-center">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Status</span>
        <span className="text-xs font-semibold bg-brand-primary/15 border border-indigo-500/35 text-brand-primary px-2 py-0.5 rounded uppercase">
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

      {/* Scanner wrapper for tracking code */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-gray-500 tracking-wider">SCAN TRACKING NUMBER</label>
        <ScannerComponent onScanSuccess={handleScanTracking} placeholder="Scan or enter tracking number..." disabled={isSubmittingPack} />
      </div>

      {/* Carrier Info */}
      <div className="bg-surface border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 tracking-wider flex items-center gap-1">
          <Truck className="h-3.5 w-3.5 text-brand-primary" /> CARRIER DETAILS
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="Carrier Name (e.g. Shopee Express)"
            className="flex-1 bg-surface-hover border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 text-base"
          />
        </div>
        {trackingNumber && (
          <div className="text-xs text-emerald-500 font-semibold bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 rounded">
            Assigned Tracking: {trackingNumber} ({carrierName})
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-gray-500 tracking-wider">PACK ITEMS</h2>
        <div className="flex flex-col gap-2">
          {order.pick_list_items.map((item) => (
            <div key={item.id} className="p-3 bg-surface border border-gray-200 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-gray-500">{item.sku_code}</span>
                <h3 className="font-bold text-gray-700 text-sm mt-0.5 leading-tight">{item.product_name}</h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-gray-500">Qty</span>
                <div className="text-base font-bold text-gray-900">{item.quantity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Button */}
      <button
        onClick={handleCompletePacking}
        disabled={!trackingNumber || isSubmittingPack}
        className="w-full mt-6 py-4 bg-brand-primary hover:bg-brand-secondary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-lg text-center select-none shadow-md shadow-indigo-950/40 text-base"
      >
        COMPLETE PACKING
      </button>
    </div>
  );
}
