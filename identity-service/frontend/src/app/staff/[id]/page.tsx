"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StaffForm from "@/components/staff/StaffForm";
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

export default function EditStaffPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const staffId = params.id;

  const [staff, setStaff] = useState<Staff | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [staffData, rolesData] = await Promise.all([
          apiClient.get(`/staff/${staffId}`),
          apiClient.get("/roles/"),
        ]);
        setStaff(staffData);
        setRoles(rolesData || []);
      } catch (err: any) {
        toast(err.message || "Không thể tải thông tin nhân sự hoặc danh sách vai trò", "error");
        router.push("/staff");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  const handleSubmit = async (data: any) => {
    await apiClient.put(`/staff/${staffId}`, data);
    toast("Cập nhật thông tin nhân sự thành công!", "success");
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
            <h1 className="text-xl font-bold text-gray-900">Chỉnh sửa thông tin nhân sự</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Cập nhật thông tin cơ bản và quyền hạn của nhân viên.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          {isLoading || !staff ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <span className="text-xs text-gray-400 font-bold">Đang tải thông tin nhân sự...</span>
            </div>
          ) : (
            <StaffForm
              isEdit={true}
              roles={roles}
              initialValues={{
                username: staff.username,
                email: staff.email,
                full_name: staff.full_name || "",
                role_id: staff.role_id,
                is_active: staff.is_active,
              }}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
