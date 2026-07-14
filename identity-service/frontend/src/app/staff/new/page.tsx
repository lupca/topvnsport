"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StaffForm from "@/components/staff/StaffForm";
import Button from "@/components/ui/Button";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

interface Role {
  id: number;
  name: string;
  code: string;
}

export default function CreateStaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      setIsLoading(true);
      try {
        const rolesData = await apiClient.get("/roles/");
        setRoles(rolesData || []);
      } catch (err: any) {
        toast(err.message || "Không thể tải danh sách vai trò", "error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (data: any) => {
    await apiClient.post("/staff/", data);
    toast("Thêm nhân sự mới thành công!", "success");
    router.push("/staff");
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Back and title */}
        <div className="flex items-center gap-3 text-left">
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            onClick={() => router.push("/staff")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-bold text-gray-900">Thêm nhân viên mới</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Tạo tài khoản truy cập hệ thống cho nhân viên mới.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <span className="text-xs text-gray-400 font-bold">Đang tải biểu mẫu...</span>
            </div>
          ) : (
            <StaffForm roles={roles} onSubmit={handleSubmit} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
