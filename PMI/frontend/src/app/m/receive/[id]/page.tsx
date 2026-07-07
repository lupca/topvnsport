"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScannerComponent from "@/components/ScannerComponent";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { Download, CheckCircle, ArrowLeft, AlertCircle, MapPin, Layers } from "lucide-react";
import { popupService } from "@/components/ui/popupService";

interface InboundItem {
  id: number;
  sku_code: string;
  product_name: string;
  expected_qty: number;
  received_qty: number;
  location_id?: number;
  status: string;
}

interface InboundShipment {
  id: number;
  inbound_number: string;
  supplier_name: string;
  status: string;
  items: InboundItem[];
}

export default function ReceiveFlow() {
  const { id } = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<InboundShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [putAwaySku, setPutAwaySku] = useState<string | null>(null);
  const [putAwayLocCode, setPutAwayLocCode] = useState("");
  const [isSubmittingPutAway, setIsSubmittingPutAway] = useState(false);
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);

  const fetchShipment = async () => {
    try {
      const data: InboundShipment = await wmsFetch(`/inbound-shipments/${id}`);
      setShipment(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load shipment details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipment();
  }, [id]);

  const handleBarcodeScan = async (barcode: string) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmittingScan(true);
    try {
      const response = await fetch(`${WMS_API_URL}/inbound/${id}/receive-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to scan receive item");
      }
      setSuccessMessage(`Received: ${data.product_name} (${data.sku_code})`);
      fetchShipment();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error scanning barcode");
    } finally {
      setIsSubmittingScan(false);
    }
  };

  const handlePutAwaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!putAwaySku || !putAwayLocCode.trim()) return;

    setError(null);
    setSuccessMessage(null);
    setIsSubmittingPutAway(true);

    try {
      const response = await fetch(`${WMS_API_URL}/inbound/${id}/put-away`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_code: putAwaySku,
          location_code: putAwayLocCode.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to put away item");
      }
      setSuccessMessage(`Assigned location ${data.location_code} to SKU ${putAwaySku}`);
      setPutAwaySku(null);
      setPutAwayLocCode("");
      fetchShipment();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error assigning location");
    } finally {
      setIsSubmittingPutAway(false);
    }
  };

  const handleCompleteShipment = async () => {
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${WMS_API_URL}/inbound/${id}/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to complete shipment");
      }
      void popupService.alert("Hoàn tất lô hàng thành công!");
      router.push("/m/receive/select");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error completing shipment");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-3"></div>
        <span>Loading shipment...</span>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-4 flex flex-col gap-4 text-center">
        <div className="text-red-500 font-bold">Shipment Not Found</div>
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
          onClick={() => router.push("/m/receive/select")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <div className="text-right">
          <h1 className="text-lg font-bold text-emerald-500">{shipment.inbound_number}</h1>
          <p className="text-xs text-gray-500">{shipment.supplier_name}</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-surface border border-gray-200 rounded-lg p-3 flex justify-between items-center">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Status</span>
        <span className="text-xs font-semibold bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 px-2 py-0.5 rounded uppercase">
          {shipment.status}
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

      {/* Scanner wrapper */}
      <ScannerComponent onScanSuccess={handleBarcodeScan} placeholder="Scan item barcode to receive..." disabled={isSubmittingScan} />

      {/* Put Away Location Assignment Modal/Section */}
      {putAwaySku && (
        <div className="bg-surface border border-brand-primary/50 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-brand-primary tracking-wider">ASSIGN LOCATION FOR {putAwaySku}</h3>
            <button onClick={() => setPutAwaySku(null)} className="text-xs text-gray-500 hover:text-gray-700">
              CANCEL
            </button>
          </div>
          <form onSubmit={handlePutAwaySubmit} className="flex gap-2">
            <input
              type="text"
              value={putAwayLocCode}
              onChange={(e) => setPutAwayLocCode(e.target.value)}
              placeholder="Enter Location Code (e.g. LOC-01)"
              className="flex-1 bg-surface-hover border border-gray-300 rounded px-3 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-primary text-lg"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmittingPutAway}
              className="bg-brand-primary hover:bg-brand-secondary text-white font-bold px-4 py-3 rounded text-sm disabled:opacity-50"
            >
              SAVE
            </button>
          </form>
        </div>
      )}

      {/* Item List */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-gray-500 tracking-wider">EXPECTED ITEMS</h2>
        <div className="flex flex-col gap-2">
          {shipment.items.map((item) => {
            const isCompleted = item.received_qty >= item.expected_qty;
            const hasLocation = item.location_id !== null && item.location_id !== undefined;

            return (
              <div
                key={item.id}
                className={`p-3 bg-surface border rounded-lg flex flex-col gap-2 ${
                  isCompleted ? "border-gray-200" : "border-brand-primary/30"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-500">{item.sku_code}</span>
                    <h3 className="font-bold text-gray-700 text-sm mt-0.5 leading-tight">{item.product_name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-500">Qty</span>
                    <div className="text-base font-bold text-gray-900">
                      <span className={isCompleted ? "text-emerald-500" : "text-brand-primary"}>
                        {item.received_qty}
                      </span>
                      {" "}/ {item.expected_qty}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5 text-gray-500" />
                    <span>Loc: {hasLocation ? `ID #${item.location_id}` : "Not Assigned"}</span>
                  </div>
                  <button
                    onClick={() => {
                      setPutAwaySku(item.sku_code);
                      setPutAwayLocCode("");
                    }}
                    className={`text-xs px-2.5 py-1 rounded font-bold border transition-colors ${
                      hasLocation
                        ? "bg-surface-hover border-gray-200 text-gray-500 hover:bg-gray-100"
                        : "bg-brand-primary/10 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/20"
                    }`}
                  >
                    {hasLocation ? "CHANGE LOC" : "ASSIGN LOC"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Button */}
      <button
        onClick={handleCompleteShipment}
        className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-center select-none shadow-md shadow-emerald-950/40 text-base"
      >
        COMPLETE SHIPMENT
      </button>
    </div>
  );
}
