"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Edit, Trash2, Key, Search, ChevronLeft, ChevronRight, Check, X, ShieldAlert } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import StaffStatusBadge from "./StaffStatusBadge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
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

interface StaffTableProps {
  staffs: Staff[];
  roles: Role[];
  onToggleStatus: (id: number, currentStatus: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onResetPassword: (id: number, newPassword: string) => Promise<void>;
}

export default function StaffTable({
  staffs,
  roles,
  onToggleStatus,
  onDelete,
  onResetPassword,
}: StaffTableProps) {
  const { toast } = useToast();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Actions loading state
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);

  // Reset password modal state
  const [resettingStaff, setResettingStaff] = useState<Staff | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, roleFilter, statusFilter, pageSize, currentPage]);

  // Client-side filtering
  const filteredStaffs = staffs.filter((staff) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      staff.username.toLowerCase().includes(searchLower) ||
      staff.email.toLowerCase().includes(searchLower) ||
      (staff.full_name || "").toLowerCase().includes(searchLower);

    const matchesRole = !roleFilter || String(staff.role_id) === String(roleFilter);

    const matchesStatus =
      !statusFilter ||
      (statusFilter === "active" && staff.is_active) ||
      (statusFilter === "inactive" && !staff.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalItems = filteredStaffs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const actualCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  
  const startIndex = (actualCurrentPage - 1) * pageSize;
  const paginatedStaffs = filteredStaffs.slice(startIndex, startIndex + pageSize);

  const handleToggleStatus = async (staff: Staff) => {
    setLoadingActionId(staff.id);
    try {
      await onToggleStatus(staff.id, staff.is_active);
      toast(`Đã ${staff.is_active ? "khóa" : "kích hoạt"} tài khoản thành công`, "success");
    } catch (err: any) {
      toast(err.message || "Không thể thay đổi trạng thái tài khoản", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleDelete = async (staff: Staff) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân viên "${staff.username}"?`)) {
      return;
    }
    setLoadingActionId(staff.id);
    try {
      await onDelete(staff.id);
      toast("Đã xóa nhân viên thành công", "success");
    } catch (err: any) {
      toast(err.message || "Không thể xóa nhân viên", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingStaff) return;

    if (newPassword.length < 8) {
      setResetError("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsResetting(true);
    setResetError("");
    try {
      await onResetPassword(resettingStaff.id, newPassword);
      toast(`Đặt lại mật khẩu cho "${resettingStaff.username}" thành công`, "success");
      setResettingStaff(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setResetError(err.message || "Không thể đặt lại mật khẩu");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="md:col-span-2">
          <Input
            placeholder="Tìm kiếm theo tên đăng nhập, email, họ tên..."
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            placeholder="Tất cả vai trò"
            options={roles.map((r) => ({ label: r.name, value: String(r.id) }))}
          />
        </div>
        <div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Tất cả trạng thái"
            options={[
              { label: "Hoạt động", value: "active" },
              { label: "Tạm khóa", value: "inactive" },
            ]}
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {paginatedStaffs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đăng nhập cuối</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStaffs.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-gray-800">{staff.username}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{staff.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-700 font-medium">{staff.full_name || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wide">
                      {staff.role_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StaffStatusBadge isActive={staff.is_active} />
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-400 text-xs">
                      {staff.last_login_at
                        ? new Date(staff.last_login_at).toLocaleString("vi-VN")
                        : "Chưa từng đăng nhập"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Toggle status action */}
                      <Button
                        variant={staff.is_active ? "outline" : "primary"}
                        size="sm"
                        isLoading={loadingActionId === staff.id}
                        onClick={() => handleToggleStatus(staff)}
                        title={staff.is_active ? "Khóa tài khoản" : "Kích hoạt tài khoản"}
                        className="px-2"
                      >
                        {staff.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>

                      {/* Edit action */}
                      <Link href={`/staff/${staff.id}`} passHref>
                        <Button variant="outline" size="sm" className="px-2" title="Chỉnh sửa">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </Link>

                      {/* Reset password action */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResettingStaff(staff)}
                        title="Đặt lại mật khẩu"
                        className="px-2"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </Button>

                      {/* Delete action */}
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={loadingActionId === staff.id}
                        onClick={() => handleDelete(staff)}
                        title="Xóa nhân sự"
                        className="px-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
            <ShieldAlert className="w-8 h-8" />
            <span className="text-xs font-semibold">Không tìm thấy nhân viên nào phù hợp</span>
          </div>
        )}

        {/* Pagination & Page Size controls */}
        {totalItems > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span>Hiển thị</span>
              <select
                className="border border-gray-200 rounded-lg px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>dòng mỗi trang (Tổng {totalItems} nhân sự)</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={actualCurrentPage === 1}
                onClick={() => setCurrentPage(actualCurrentPage - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold text-gray-700">
                Trang {actualCurrentPage} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={actualCurrentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(actualCurrentPage + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resettingStaff}
        onClose={() => {
          setResettingStaff(null);
          setNewPassword("");
          setConfirmPassword("");
          setResetError("");
        }}
        title={`Đặt lại mật khẩu cho "${resettingStaff?.username}"`}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => {
                setResettingStaff(null);
                setNewPassword("");
                setConfirmPassword("");
                setResetError("");
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              onClick={handleResetPasswordSubmit}
              isLoading={isResetting}
            >
              Cập nhật mật khẩu
            </Button>
          </div>
        }
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {resetError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
              {resetError}
            </div>
          )}
          <Input
            id="modal_new_password"
            type="password"
            label="Mật khẩu mới"
            placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            id="modal_confirm_password"
            type="password"
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}
