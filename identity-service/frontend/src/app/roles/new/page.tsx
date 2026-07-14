"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RoleForm from "@/components/roles/RoleForm";
import Button from "@/components/ui/Button";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

export default function CreateRolePage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    await apiClient.post("/roles/", data);
    toast("Thêm vai trò mới thành công!", "success");
    router.push("/roles");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Back and title */}
        <div className="flex items-center gap-3 text-left">
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            onClick={() => router.push("/roles")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-bold text-gray-900">Thêm vai trò mới</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Thiết lập mã vai trò, tên hiển thị và định nghĩa các quyền đi kèm.
            </p>
          </div>
        </div>

        {/* Form */}
        <RoleForm onSubmit={handleSubmit} />
      </div>
    </DashboardLayout>
  );
}
