"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RoleForm from "@/components/roles/RoleForm";
import Button from "@/components/ui/Button";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
}

export default function EditRolePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const roleId = params.id;

  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      setIsLoading(true);
      try {
        const roleData = await apiClient.get(`/roles/${roleId}`);
        setRole(roleData);
      } catch (err: any) {
        toast(err.message || "Không thể tải thông tin vai trò", "error");
        router.push("/roles");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const handleSubmit = async (data: any) => {
    await apiClient.put(`/roles/${roleId}`, data);
    toast("Cập nhật thông tin vai trò thành công!", "success");
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
            <h1 className="text-xl font-bold text-gray-900">Chỉnh sửa vai trò</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Cập nhật tên hiển thị, mô tả và cấu hình các quyền hạn đi kèm.
            </p>
          </div>
        </div>

        {/* Form Container */}
        {isLoading || !role ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="text-xs text-gray-400 font-bold">Đang tải thông tin vai trò...</span>
          </div>
        ) : (
          <RoleForm
            isEdit={true}
            initialValues={{
              code: role.code,
              name: role.name,
              description: role.description || "",
              permissions: role.permissions || [],
            }}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
