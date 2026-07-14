import React from "react";

interface Permission {
  code: string;
  name: string;
  description: string;
}

interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: "PMI (Product Information Management)",
    permissions: [
      { code: "pmi:read", name: "Xem thông tin sản phẩm", description: "Cho phép đọc dữ liệu sản phẩm, danh mục, thương hiệu." },
      { code: "pmi:write", name: "Quản lý sản phẩm", description: "Cho phép tạo mới, sửa đổi, cập nhật thông tin sản phẩm." },
      { code: "pmi:*", name: "Toàn quyền PMI", description: "Quyền quản trị cao nhất trên phân hệ PMI." },
    ],
  },
  {
    category: "OMS (Order Management System)",
    permissions: [
      { code: "oms:read", name: "Xem đơn hàng", description: "Cho phép xem thông tin đơn hàng, trạng thái đơn hàng." },
      { code: "oms:write", name: "Xử lý đơn hàng", description: "Cho phép tạo mới, cập nhật trạng thái đơn hàng, hoàn tiền." },
      { code: "oms:*", name: "Toàn quyền OMS", description: "Quyền quản trị cao nhất trên phân hệ OMS." },
    ],
  },
  {
    category: "WMS (Warehouse Management System)",
    permissions: [
      { code: "wms:read", name: "Xem kho hàng", description: "Cho phép xem lượng tồn kho, phiếu nhập/xuất kho." },
      { code: "wms:write", name: "Quản lý kho hàng", description: "Cho phép nhập kho, xuất kho, điều chuyển hàng hóa." },
      { code: "wms:*", name: "Toàn quyền WMS", description: "Quyền quản trị cao nhất trên phân hệ WMS." },
    ],
  },
  {
    category: "Identity (SSO Identity Service)",
    permissions: [
      { code: "identity:staff", name: "Quản lý nhân sự", description: "Cho phép xem, tạo, sửa, xóa, reset mật khẩu nhân sự." },
      { code: "identity:roles", name: "Quản lý vai trò", description: "Cho phép xem, tạo, sửa, xóa vai trò và phân quyền." },
      { code: "identity:*", name: "Toàn quyền Identity", description: "Quyền quản trị cao nhất trên phân hệ phân quyền và bảo mật." },
    ],
  },
];

interface PermissionSelectorProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export default function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const handleCheckboxChange = (code: string, checked: boolean) => {
    if (disabled) return;
    
    let updated: string[];
    if (checked) {
      updated = [...selectedPermissions, code];
    } else {
      updated = selectedPermissions.filter((p) => p !== code);
    }
    onChange(updated);
  };

  const handleSelectGroupAll = (groupCodes: string[], checkAll: boolean) => {
    if (disabled) return;

    let updated = [...selectedPermissions];
    if (checkAll) {
      // Add all group permissions if not already present
      groupCodes.forEach((code) => {
        if (!updated.includes(code)) {
          updated.push(code);
        }
      });
    } else {
      // Remove all group permissions
      updated = updated.filter((code) => !groupCodes.includes(code));
    }
    onChange(updated);
  };

  return (
    <div className="space-y-6 text-left">
      <label className="block text-xs font-bold text-gray-700 mb-1">
        Phân quyền chi tiết
      </label>
      <p className="text-[11px] text-gray-400 font-medium mb-4">
        Vui lòng chọn các quyền cụ thể cấp cho vai trò này trên từng hệ thống.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PERMISSION_GROUPS.map((group) => {
          const groupCodes = group.permissions.map((p) => p.code);
          const allSelected = groupCodes.every((code) => selectedPermissions.includes(code));
          const someSelected = groupCodes.some((code) => selectedPermissions.includes(code)) && !allSelected;

          return (
            <div
              key={group.category}
              className="border border-gray-200 rounded-2xl bg-surface shadow-sm overflow-hidden flex flex-col"
            >
              {/* Group Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">{group.category}</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-brand-primary">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectGroupAll(groupCodes, e.target.checked)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 text-brand-primary rounded border-gray-300 focus:ring-brand-primary/50"
                  />
                  <span>Chọn tất cả</span>
                </label>
              </div>

              {/* Group Permissions List */}
              <div className="p-4 space-y-4 flex-1">
                {group.permissions.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.code);
                  return (
                    <label
                      key={perm.code}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none
                        ${
                          isChecked
                            ? "bg-brand-primary/5 border-brand-primary/20 text-gray-900"
                            : "bg-transparent border-gray-100 hover:bg-gray-50 text-gray-600"
                        }
                        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxChange(perm.code, e.target.checked)}
                        disabled={disabled}
                        className="mt-0.5 w-4 h-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary/50"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold font-mono text-gray-800">{perm.code}</span>
                        <span className="text-[11px] font-semibold text-gray-700">{perm.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium leading-normal">
                          {perm.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
