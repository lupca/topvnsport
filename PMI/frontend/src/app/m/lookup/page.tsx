"use client";

import React, { useState } from "react";
import ScannerComponent from "@/components/ScannerComponent";
import { wmsFetch, WMS_API_URL } from "@/config/wmsApi";
import { Search, MapPin, Box, AlertCircle, RefreshCw } from "lucide-react";
import { normalizeImageUrl } from "@/utils/imageUrl";

interface BarcodeMapping {
  id: number;
  barcode: string;
  sku_code: string;
  product_name: string;
  variant_name?: string;
  image_url?: string;
}

interface InventoryItem {
  id: number;
  sku_code: string;
  product_name: string;
  location_id: number;
  qty_on_hand: number;
  qty_reserved: number;
}

interface Location {
  id: number;
  warehouse_id: number;
  location_code: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  type: string;
}

export default function MobileLookup() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeMapping, setBarcodeMapping] = useState<BarcodeMapping | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Record<number, Location>>({});

  const handleScan = async (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setLoading(true);
    setError(null);
    setBarcodeMapping(null);
    setInventory([]);

    try {
      // 1. Lookup barcode mapping
      const mappingResponse = await fetch(`${WMS_API_URL}/barcode-mappings/lookup/${scannedBarcode}`);
      if (!mappingResponse.ok) {
        throw new Error(mappingResponse.status === 404 ? "Barcode mapping not found" : "Error looking up barcode");
      }
      const mappingData: BarcodeMapping = await mappingResponse.json();
      setBarcodeMapping(mappingData);

      // 2. Load all locations to build a map
      const locResponse = await fetch(`${WMS_API_URL}/locations`);
      if (locResponse.ok) {
        const locData: Location[] = await locResponse.json();
        const locMap: Record<number, Location> = {};
        locData.forEach((l) => {
          locMap[l.id] = l;
        });
        setLocations(locMap);
      }

      // 3. Lookup SKU inventory
      const invResponse = await fetch(`${WMS_API_URL}/inventory`);
      if (invResponse.ok) {
        const invData: InventoryItem[] = await invResponse.json();
        const skuInventory = invData.filter((item) => item.sku_code === mappingData.sku_code);
        setInventory(skuInventory);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setBarcode("");
    setError(null);
    setBarcodeMapping(null);
    setInventory([]);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-amber-500">LOOKUP</h1>
          <p className="text-xs text-slate-400">Inventory & Barcode Lookup</p>
        </div>
        {barcodeMapping && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-amber-500 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            CLEAR
          </button>
        )}
      </div>

      {/* Main scanning panel */}
      {!barcodeMapping && !loading && (
        <ScannerComponent onScanSuccess={handleScan} placeholder="Scan barcode or type barcode code..." />
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-3"></div>
          <span className="text-sm text-slate-400">Searching barcode database...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-sm">Lookup Failed</h3>
            <p className="text-xs mt-0.5">{error}</p>
            <button
              onClick={handleReset}
              className="mt-2 text-xs font-bold text-amber-500 hover:underline block"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Lookup Results */}
      {barcodeMapping && (
        <div className="flex flex-col gap-4">
          {/* SKU / Variant Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex gap-4">
            {barcodeMapping.image_url && (
              <img
                src={normalizeImageUrl(barcodeMapping.image_url) || barcodeMapping.image_url}
                alt={barcodeMapping.product_name}
                className="w-16 h-16 rounded object-cover border border-slate-700 bg-slate-950 shrink-0"
              />
            )}
            <div className="flex-1">
              <span className="text-xs font-bold tracking-wider text-amber-500">
                {barcodeMapping.sku_code}
              </span>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5 leading-tight">
                {barcodeMapping.product_name}
              </h2>
              {barcodeMapping.variant_name && (
                <p className="text-sm text-slate-400 mt-1">{barcodeMapping.variant_name}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-slate-850 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                  Barcode: {barcodeMapping.barcode}
                </span>
              </div>
            </div>
          </div>

          {/* Location details */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-bold text-slate-350 tracking-wider mb-3">CURRENT LOCATIONS</h3>
            {inventory.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No active inventory found for this item
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {inventory.map((inv) => {
                  const loc = locations[inv.location_id];
                  const locCode = loc ? loc.location_code : `ID #${inv.location_id}`;
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded">
                          <MapPin className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-100">{locCode}</div>
                          {loc && (
                            <div className="text-xs text-slate-500">
                              Zone {loc.zone || "-"} · Aisle {loc.aisle || "-"} · Rack {loc.rack || "-"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-100 text-lg">{inv.qty_on_hand}</div>
                        <div className="text-xs text-slate-500">
                          {inv.qty_reserved > 0 ? `${inv.qty_reserved} reserved` : "0 reserved"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
