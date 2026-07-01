"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Scan, Keyboard } from "lucide-react";

interface MobileScannerProps {
  onScanSuccess: (decodedText: string) => void;
  placeholder?: string;
  scanType?: "product" | "shipping";
}

export default function MobileScanner({
  onScanSuccess,
  placeholder = "Nhập mã vạch thủ công...",
  scanType,
}: MobileScannerProps) {
  const [manualInput, setManualInput] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScanResultRef = useRef<string>("");

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1000Hz frequency
      gain.gain.setValueAtTime(0.2, ctx.currentTime); // volume
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15); // duration 150ms
    } catch (err) {
      console.warn("Failed to play beep sound:", err);
    }
  };

  const vibrate = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(100); // 100ms vibration
      }
    } catch (err) {
      console.warn("Vibration not supported or blocked:", err);
    }
  };

  const parseCode = (text: string): string => {
    let finalCode = text;
    // Tự động bóc tách EAN-13 nếu vô tình quét trúng QR của Li-Ning
    if (text.includes("?E=")) {
      try {
        const urlParams = new URLSearchParams(text.split("?")[1]);
        if (urlParams.has("E")) {
          finalCode = urlParams.get("E") || text; // Trả về đúng mã EAN-13
        }
      } catch (e) {
        console.error("Failed to parse E param from QR URL:", e);
      }
    }
    return finalCode;
  };

  const handleScan = (decodedText: string) => {
    const finalCode = parseCode(decodedText);
    const now = Date.now();
    if (finalCode === lastScanResultRef.current && now - lastScanTimeRef.current < 2000) {
      // Ignore duplicate scan within 2 seconds (debounce)
      return;
    }
    lastScanTimeRef.current = now;
    lastScanResultRef.current = finalCode;

    playBeep();
    vibrate();
    onScanSuccess(finalCode);
  };

  useEffect(() => {
    // Determine formats to support depending on context
    let formatsToSupport: Html5QrcodeSupportedFormats[] | undefined = undefined;
    if (scanType === "product") {
      formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];
    } else if (scanType === "shipping") {
      formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
      ];
    }

    // Dynamic responsive scanning box (qrbox)
    const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
      if (scanType === "shipping") {
        // Wide rectangle for shipping labels (Code 128 / long barcodes)
        const width = Math.floor(viewfinderWidth * 0.85);
        const height = Math.min(Math.floor(viewfinderHeight * 0.6), 150);
        return { width, height };
      } else {
        // Square box for products (EAN-13, QR)
        const size = Math.min(Math.floor(viewfinderWidth * 0.75), Math.floor(viewfinderHeight * 0.75), 250);
        return { width: size, height: size };
      }
    };

    // Only run on client-side
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: qrbox,
        rememberLastUsedCamera: true,
        videoConstraints: {
          facingMode: "environment" // Force rear/back camera
        },
        formatsToSupport: formatsToSupport,
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        handleScan(decodedText);
      },
      (error) => {
        // Silently ignore scanner noise/errors
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => {
          // Ignore clear errors on unmount
        });
      }
    };
  }, [onScanSuccess, scanType]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      const parsedInput = parseCode(manualInput.trim());
      playBeep();
      vibrate();
      onScanSuccess(parsedInput);
      setManualInput("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Scanner Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Scan className="w-4 h-4 text-indigo-400" /> Camera Scanner
          </span>
          <span className="text-[10px] bg-slate-800 text-indigo-400 px-2 py-0.5 rounded font-medium">Ready</span>
        </div>
        <div id="qr-reader" className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-850" />
      </div>

      {/* Manual Input form */}
      <form onSubmit={handleManualSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <Keyboard className="w-4 h-4 text-indigo-400" />
          <span>Manual Input (Simulation / E2E)</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="barcode-manual-input"
            placeholder={placeholder}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            className="px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            Quét
          </button>
        </div>
      </form>
    </div>
  );
}
