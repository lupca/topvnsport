"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Edit, Trash2, Shield, Search, Users, ShieldAlert } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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

interface RoleTableProps {
  roles: Role[];
  staffs: Staff[];
  onDelete: (id: number) => Promise<void>;
}

export default function RoleTable({ roles, staffs, onDelete }: RoleTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Client-side search
  const filteredRoles = roles.filter((role) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      role.name.toLowerCase().includes(searchLower) ||
      role.code.toLowerCase().includes(searchLower) ||
      (role.description || "").toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = async (role: Role) => {
    // Check if there are active staff members using this role
    const staffCount = staffs.filter((s) => s.role_id === role.id).length;
    if (staffCount > 0) {
      toast(
        `Không thể xóa vai trò này vì đang có ${staffCount} nhân sự sử dụng. Vui lòng chuyển vai trò của họ trước.`,
        "warning"
      );
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${role.name}" (${role.code})?`)) {
      return;
    }

    setLoadingId(role.id);
    try {
      await onDelete(role.id);
      toast("Đã xóa vai trò thành công", "success");
    } catch (err: any) {
      toast(err.message || "Không thể xóa vai trò", "error");
    } finally {
      setLoadingId(null);
    }
  };

  const getStaffCount = (roleId: number) => {
    return staffs.filter((s) => s.role_id === roleId).length;
  };

  return (
    <div className="space-y-4">
      {/* Search Toolbar */}
      <div className="flex bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="w-full max-w-md">
          <Input
            placeholder="Tìm kiếm theo tên vai trò, mã vai trò, mô tả..."
            leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredRoles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vai trò</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Nhân sự sở hữu</TableHead>
                <TableHead>Danh sách quyền ({roles.length > 0 ? "chi tiết" : ""})</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => {
                const count = getStaffCount(role.id);
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-800">{role.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider">
                          {role.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-xs block max-w-xs truncate" title={role.description || ""}>
                        {role.description || "Không có mô tả"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-gray-700 font-semibold">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>{count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md py-1">
                        {role.permissions && role.permissions.length > 0 ? (
                          role.permissions.map((perm) => (
                            <span
                              key={perm}
                              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 font-mono text-[9px] rounded font-semibold border border-gray-200"
                            >
                              {perm}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-[10px] italic">Không có quyền nào</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit action */}
                        <Link href={`/roles/${role.id}`} passHref>
                          <Button variant="outline" size="sm" className="px-2" title="Chỉnh sửa">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </Link>

                        {/* Delete action */}
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={loadingId === role.id}
                          onClick={() => handleDelete(role)}
                          title="Xóa vai trò"
                          className="px-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
            <ShieldAlert className="w-8 h-8" />
            <span className="text-xs font-semibold">Không tìm thấy vai trò nào phù hợp</span>
          </div>
        )}
      </div>
    </div>
  );
}
