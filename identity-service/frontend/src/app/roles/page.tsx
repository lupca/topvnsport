"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldPlus, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RoleTable from "@/components/roles/RoleTable";
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

interface Staff {
  id: number;
  role_id: number;
}

export default function RolesPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesData, staffData] = await Promise.all([
        apiClient.get("/roles/"),
        apiClient.get("/staff/"),
      ]);
      setRoles(rolesData || []);
      setStaffs(staffData || []);
    } catch (err: any) {
      toast(err.message || "Không thể tải danh sách vai trò hoặc nhân sự", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: number) => {
    await apiClient.delete(`/roles/${id}`);
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h1 className="text-xl font-bold text-gray-900">Danh sách vai trò</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Định nghĩa các nhóm vai trò và phân bổ quyền truy cập chi tiết cho từng phân hệ nghiệp vụ.
            </p>
          </div>
          <Link href="/roles/new" passHref>
            <Button
              variant="primary"
              leftIcon={<ShieldPlus className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Thêm vai trò
            </Button>
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="text-xs text-gray-400 font-bold">Đang tải danh sách vai trò...</span>
          </div>
        ) : (
          <RoleTable
            roles={roles}
            staffs={staffs}
            onDelete={handleDelete}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
