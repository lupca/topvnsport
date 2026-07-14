"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/utils/apiClient";
import { APP_SETTINGS } from "@/config/settings";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Package, ShoppingCart, Warehouse } from "lucide-react";
import { getSafeRedirectUrl } from "@/utils/redirect";

// Validation schema using Zod
const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

type LoginInput = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const redirectUrl = searchParams.get("redirect") || "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // 1. Call login endpoint
      const response = await apiClient.post("/auth/login", data);
      
      // 2. Save tokens in localStorage
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      
      // 3. Set access_token cookie for Nginx auth_request forwarding
      const maxAge = response.expires_in || 3600; // default 1 hour
      document.cookie = `access_token=${response.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      
      // 4. Fetch personal info to store username and role
      const userProfile = await apiClient.get("/auth/me");
      localStorage.setItem("user_username", userProfile.username);
      localStorage.setItem("user_role", userProfile.role_code);
      
      toast("Đăng nhập thành công!", "success");

      // 5. Handle redirection
      if (redirectUrl) {
        const decodedUrl = decodeURIComponent(redirectUrl);
        const safeUrl = getSafeRedirectUrl(decodedUrl);
        window.location.href = safeUrl;
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
      setErrorMsg(msg);
      toast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const pmiUrl = process.env.NEXT_PUBLIC_PMI_URL || "http://localhost:13100";
  const omsUrl = process.env.NEXT_PUBLIC_OMS_URL || "http://localhost:13101";
  const wmsUrl = process.env.NEXT_PUBLIC_WMS_URL || "http://localhost:13102";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand-primary flex items-center justify-center shadow-sm font-bold text-white text-xl tracking-wider mb-3">
            {APP_SETTINGS.appShortName}
          </div>
          <h2 className="text-xl font-bold text-brand-accent uppercase tracking-wide">
            {APP_SETTINGS.appName}
          </h2>
          <p className="mt-1 text-xs text-brand-primary font-semibold uppercase tracking-widest">
            {APP_SETTINGS.appSubtitle}
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl p-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            id="username"
            type="text"
            label="Tên đăng nhập"
            placeholder="Nhập tên đăng nhập hoặc email"
            required
            error={errors.username?.message}
            {...register("username")}
          />

          <Input
            id="password"
            type="password"
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          <Button
            type="submit"
            className="w-full mt-2"
            isLoading={isLoading}
            variant="primary"
          >
            ĐĂNG NHẬP
          </Button>
        </form>

        {/* Quick Links to Systems */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Truy cập nhanh các hệ thống
          </p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={pmiUrl}
              className="flex flex-col items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-brand-primary hover:bg-gray-50 transition text-gray-600 hover:text-brand-primary"
            >
              <Package className="w-5 h-5 mb-1 text-gray-400 group-hover:text-brand-primary" />
              <span className="text-[10px] font-bold">PMI</span>
            </a>
            <a
              href={omsUrl}
              className="flex flex-col items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-brand-primary hover:bg-gray-50 transition text-gray-600 hover:text-brand-primary"
            >
              <ShoppingCart className="w-5 h-5 mb-1 text-gray-400 group-hover:text-brand-primary" />
              <span className="text-[10px] font-bold">OMS</span>
            </a>
            <a
              href={wmsUrl}
              className="flex flex-col items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-brand-primary hover:bg-gray-50 transition text-gray-600 hover:text-brand-primary"
            >
              <Warehouse className="w-5 h-5 mb-1 text-gray-400 group-hover:text-brand-primary" />
              <span className="text-[10px] font-bold">WMS</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
