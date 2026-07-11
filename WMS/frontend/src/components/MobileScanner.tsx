"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Scan, Keyboard, Image as ImageIcon } from "lucide-react";

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
  const [fileScanError, setFileScanError] = useState<string | null>(null);
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

  const createRotatedBlob = async (file: File, rotation: number) => {
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      const shouldSwapDimensions = rotation === 90 || rotation === 270;
      canvas.width = shouldSwapDimensions ? image.height : image.width;
      canvas.height = shouldSwapDimensions ? image.width : image.height;

      const context = canvas.getContext("2d");
      if (!context) return null;

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -image.width / 2, -image.height / 2);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((result) => resolve(result), file.type || "image/jpeg", 0.95));
      return blob;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const tryScanImageFile = async (file: File) => {
    setFileScanError(null);

    const scanCandidates: Array<{ label: string; file: File | Blob }> = [{ label: "gốc", file }];
    for (const rotation of [90, 180, 270]) {
      const rotated = await createRotatedBlob(file, rotation);
      if (rotated) {
        scanCandidates.push({ label: `${rotation}deg`, file: rotated });
      }
    }

    for (const candidate of scanCandidates) {
      const scanner = new Html5Qrcode("qr-file-reader");
      try {
        const decodedText = await scanner.scanFile(candidate.file as File, true);
        await scanner.clear();
        handleScan(decodedText);
        return;
      } catch (err) {
        try {
          await scanner.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    }

    setFileScanError("Không đọc được mã từ ảnh. Hãy thử chụp thẳng, rõ nét hơn hoặc nhập tay mã EAN-13.");
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
      <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl overflow-hidden p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
            <Scan className="w-4 h-4 text-indigo-600" /> Camera Scanner
          </span>
          <span className="text-[10px] bg-gray-100 text-indigo-600 px-2 py-0.5 rounded font-medium">Ready</span>
        </div>
        <div id="qr-reader" className="w-full bg-surface rounded-xl overflow-hidden border border-gray-200" />
        <div id="qr-file-reader" className="hidden" />
      </div>

      <div className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <ImageIcon className="w-4 h-4 text-indigo-600" />
            <span>Scan from image</span>
          </div>
          <label className="px-3 py-1.5 bg-gray-100 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl cursor-pointer transition-colors">
            Chọn ảnh
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void tryScanImageFile(file);
                }
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {fileScanError && (
          <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {fileScanError}
          </div>
        )}
      </div>

      {/* Manual Input form */}
      <form onSubmit={handleManualSubmit} className="bg-surface border border-gray-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
          <Keyboard className="w-4 h-4 text-indigo-600" />
          <span>Manual Input (Simulation / E2E)</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="barcode-manual-input"
            placeholder={placeholder}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="flex-1 p-3 bg-surface border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
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
