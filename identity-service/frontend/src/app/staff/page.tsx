"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StaffTable from "@/components/staff/StaffTable";
import Button from "@/components/ui/Button";
import { apiClient } from "@/utils/apiClient";
import { useToast } from "@/components/ui/Toast";

interface Staff {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role_id: number;
  role_code: string;
  role_name: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface Role {
  id: number;
  name: string;
  code: string;
}

export default function StaffPage() {
  const { toast } = useToast();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [staffData, rolesData] = await Promise.all([
        apiClient.get("/staff/"),
        apiClient.get("/roles/"),
      ]);
      setStaffs(Array.isArray(staffData) ? staffData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (err: any) {
      toast(err.message || "Không thể tải danh sách nhân sự hoặc vai trò", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    await apiClient.put(`/staff/${id}`, { is_active: !currentStatus });
    // Refresh local state or re-fetch
    setStaffs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !currentStatus } : s))
    );
  };

  const handleDelete = async (id: number) => {
    await apiClient.delete(`/staff/${id}`);
    setStaffs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetPassword = async (id: number, newPassword: string) => {
    await apiClient.post(`/staff/${id}/reset-password`, { new_password: newPassword });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h1 className="text-xl font-bold text-gray-900">Danh sách nhân sự</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Quản lý tài khoản đăng nhập của nhân viên và cấp phát vai trò truy cập hệ thống.
            </p>
          </div>
          <Link href="/staff/new" passHref>
            <Button
              variant="primary"
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Thêm nhân viên
            </Button>
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="text-xs text-gray-400 font-bold">Đang tải danh sách nhân sự...</span>
          </div>
        ) : (
          <StaffTable
            staffs={staffs}
            roles={roles}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
            onResetPassword={handleResetPassword}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
