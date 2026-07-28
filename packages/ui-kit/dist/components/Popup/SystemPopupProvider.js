"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from "react";
import { popupService } from "./popupService";
export default function SystemPopupProvider({ children }) {
    const [request, setRequest] = useState(null);
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
        if (typeof window === "undefined")
            return;
        const originalAlert = window.alert;
        const originalPrompt = window.prompt;
        window.alert = (message) => {
            void popupService.alert(String(message ?? ""));
        };
        window.prompt = (message, defaultValue) => {
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
    return (_jsxs(_Fragment, { children: [children, request && (_jsx("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-gray-50/70 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-gray-300 bg-surface p-5 shadow-2xl", children: [_jsx("h3", { className: "text-sm font-bold uppercase tracking-wider text-indigo-600", children: request.kind === "confirm" ? "Xac nhan" : request.kind === "prompt" ? "Nhap thong tin" : "Thông báo" }), _jsx("p", { className: "mt-3 whitespace-pre-wrap text-sm text-gray-900", children: request.message }), request.kind === "prompt" && (_jsx("input", { autoFocus: true, value: promptValue, onChange: (event) => setPromptValue(event.target.value), className: "mt-4 w-full rounded-xl border border-gray-300 bg-surface-hover px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none" })), _jsxs("div", { className: "mt-5 flex items-center justify-end gap-2", children: [request.kind !== "alert" && (_jsx("button", { type: "button", onClick: handleCancel, className: "rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100", children: "H\u1EE7y" })), _jsx("button", { type: "button", onClick: handleConfirm, className: "rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-secondary", children: "\u0110\u1ED3ng \u00FD" })] })] }) }))] }));
}
