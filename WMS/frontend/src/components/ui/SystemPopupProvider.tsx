"use client";

import React, { useEffect, useState } from "react";
import { popupService, PopupRequest } from "@/components/ui/popupService";

interface SystemPopupProviderProps {
  children: React.ReactNode;
}

export default function SystemPopupProvider({ children }: SystemPopupProviderProps) {
  const [request, setRequest] = useState<PopupRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    return popupService.subscribe((nextRequest) => {
      setRequest(nextRequest);
      if (nextRequest?.kind === "prompt") {
        setPromptValue(nextRequest.defaultValue ?? "");
      }
    });
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    const originalPrompt = window.prompt;

    window.alert = (message?: unknown) => {
      void popupService.alert(String(message ?? ""));
    };

    window.prompt = (message?: string, defaultValue?: string) => {
      void popupService.prompt(String(message ?? ""), defaultValue ?? "");
      return null;
    };

    return () => {
      window.alert = originalAlert;
      window.prompt = originalPrompt;
    };
  }, []);

  const handleCancel = () => {
    if (!request) {
      return;
    }

    if (request.kind === "confirm") {
      popupService.resolveCurrent(false);
      return;
    }

    if (request.kind === "prompt") {
      popupService.resolveCurrent(null);
      return;
    }

    popupService.resolveCurrent(undefined);
  };

  const handleConfirm = () => {
    if (!request) {
      return;
    }

    if (request.kind === "confirm") {
      popupService.resolveCurrent(true);
      return;
    }

    if (request.kind === "prompt") {
      popupService.resolveCurrent(promptValue);
      return;
    }

    popupService.resolveCurrent(undefined);
  };

  return (
    <>
      {children}
      {request && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
              {request.kind === "confirm" ? "Xac nhan" : request.kind === "prompt" ? "Nhap thong tin" : "Thông báo"}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{request.message}</p>

            {request.kind === "prompt" && (
              <input
                autoFocus
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              {request.kind !== "alert" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  Hủy
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
