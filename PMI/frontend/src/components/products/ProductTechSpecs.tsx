import React from "react";

export interface Attribute {
  id: number;
  code: string;
  name: string;
  type: string;
  is_required: boolean;
}

interface ProductTechSpecsProps {
  watchFamilyId: number;
  familyAttributes: Attribute[];
  attributeValues: Record<number, string>;
  setAttributeValues: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

export default function ProductTechSpecs({
  watchFamilyId,
  familyAttributes,
  attributeValues,
  setAttributeValues
}: ProductTechSpecsProps) {
  return (
    <div className="pim-card space-y-6">
      <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Thuộc tính kỹ thuật</h2>

      {!watchFamilyId || Number(watchFamilyId) <= 0 ? (
        <p className="text-sm text-gray-500">Chọn Attribute Family để tải danh sách thông số kỹ thuật phù hợp.</p>
      ) : familyAttributes.length === 0 ? (
        <p className="text-sm text-gray-500">Family hiện tại chưa có thuộc tính nào được gán.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {familyAttributes.map(attr => (
            <div key={attr.id} className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {attr.name}{attr.is_required ? " *" : ""}
              </label>
              <input
                type={attr.type === "decimal" || attr.type === "number" || attr.type === "float" ? "number" : "text"}
                step={attr.type === "decimal" || attr.type === "number" || attr.type === "float" ? "any" : undefined}
                placeholder={`Nhập ${attr.name.toLowerCase()}`}
                value={attributeValues[attr.id] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setAttributeValues(prev => ({ ...prev, [attr.id]: value }));
                }}
                className="pim-input"
              />
              <p className="text-[11px] text-gray-500">Code: {attr.code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
