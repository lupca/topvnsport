"use client";

import { useEffect } from "react";
import { redirectToLogin } from "@/utils/auth";

export default function LoginPage() {
  useEffect(() => {
    redirectToLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Đang chuyển hướng đến trang đăng nhập...</p>
      </div>
    </div>
  );
}
