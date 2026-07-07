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
    <div className="w-full bg-surface border border-gray-200 rounded-lg p-4 mb-4">
      {isScanning ? (
        <div className="relative">
          <div id={elementId} className="w-full max-w-sm mx-auto overflow-hidden rounded bg-black aspect-square"></div>
          <button
            onClick={stopScanner}
            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">Align barcode within frame</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            onClick={startScanner}
            disabled={disabled}
            className="w-full h-24 bg-brand-primary hover:bg-brand-secondary active:bg-brand-secondary text-white font-bold rounded-lg flex flex-col items-center justify-center gap-1 transition-colors select-none shadow-md shadow-amber-950/40 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
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
              className="flex-1 bg-surface-hover border border-gray-300 rounded px-3 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="barcode-manual-input"
            />
            <button
              type="submit"
              disabled={disabled}
              className="bg-gray-100 hover:bg-gray-200 active:bg-surface text-brand-primary border border-gray-300 font-bold px-4 py-3 rounded text-sm transition-colors disabled:bg-surface disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
            >
              SUBMIT
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
