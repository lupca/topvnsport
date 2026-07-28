"use client";

import React from "react";
import SepayConfigForm from "@/components/settings/SepayConfigForm";
import { Settings } from "lucide-react";

export default function SepaySettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-gray-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-primary" />
          <span>Cấu hình Thanh toán SePay</span>
        </h2>
        <p className="text-xs text-gray-500">
          Quản lý thông tin kết nối Cổng thanh toán SePay và tích hợp chuyển khoản ngân hàng tự động.
        </p>
      </div>

      <SepayConfigForm />
    </div>
  );
}
