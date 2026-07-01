"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";

interface ScannerComponentProps {
  onScanSuccess: (decodedText: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ScannerComponent({ onScanSuccess, placeholder = "Scan barcode...", disabled = false }: ScannerComponentProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = "html5-qr-reader";

  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err) => console.error("Error stopping scanner:", err));
      }
    };
  }, []);

  const startScanner = async () => {
    if (disabled) return;
    try {
      setIsScanning(true);
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          if (!disabledRef.current) {
            onScanSuccess(decodedText);
            stopScanner();
          }
        },
        (errorMessage) => {
          // Silent scan error to prevent console spam
        }
      );
    } catch (error) {
      console.error("Failed to start scanner:", error);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (manualInput.trim()) {
      onScanSuccess(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
      {isScanning ? (
        <div className="relative">
          <div id={elementId} className="w-full max-w-sm mx-auto overflow-hidden rounded bg-black aspect-square"></div>
          <button
            onClick={stopScanner}
            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <p className="text-center text-xs text-slate-400 mt-2">Align barcode within frame</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            onClick={startScanner}
            disabled={disabled}
            className="w-full h-24 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg flex flex-col items-center justify-center gap-1 transition-colors select-none shadow-md shadow-amber-950/40 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Camera className="h-8 w-8 text-amber-100" />
            <span className="text-sm font-bold tracking-wider">TAP TO SCAN BARCODE</span>
          </button>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="barcode-manual-input"
            />
            <button
              type="submit"
              disabled={disabled}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-500 border border-slate-700 font-bold px-4 py-3 rounded text-sm transition-colors disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-850 disabled:cursor-not-allowed"
            >
              SUBMIT
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
