import React, { useState, useEffect } from "react";
import { Plus, Trash, Loader2, Save, AlertCircle } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";
import { fetchWithAuth, apiClient } from "@/utils/apiClient";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface PimAttribute {
  id: number;
  name: string;
  code: string;
}

interface CategoryMapping {
  channel_category_code: string;
  channel_category_name: string;
}

interface AttributeMapping {
  id?: number;
  pim_attribute_id: number;
  channel_category_code: string | null;
  channel_attribute_code: string;
  channel_attribute_name: string;
}

interface AttributeMappingTabProps {
  channel: { id: number; code: string; name: string };
}

export default function AttributeMappingTab({ channel }: AttributeMappingTabProps) {
  const [pimAttributes, setPimAttributes] = useState<PimAttribute[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [mappings, setMappings] = useState<AttributeMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Fetch PIM attributes, category mappings, and current attribute mappings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [attrs, catMaps, attrMaps] = await Promise.all([
          fetchWithAuth("/attributes"),
          fetchWithAuth(`/api/channels/${channel.id}/category-mappings`),
          fetchWithAuth(`/api/channels/${channel.id}/attribute-mappings`)
        ]);

        setPimAttributes(attrs);
        setCategoryMappings(catMaps);
        setMappings(attrMaps);
      } catch (err: any) {
        void popupService.alert(`Lỗi: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [channel]);

  // 2. Add new empty mapping row
  const handleAddRow = () => {
    if (pimAttributes.length === 0) return;
    setMappings(prev => [
      ...prev,
      {
        pim_attribute_id: pimAttributes[0].id,
        channel_category_code: null, // Global
        channel_attribute_code: "",
        channel_attribute_name: ""
      }
    ]);
  };

  // 3. Remove mapping row
  const handleRemoveRow = (index: number) => {
    setMappings(prev => prev.filter((_, idx) => idx !== index));
  };

  // 4. Update specific cell in row
  const handleCellChange = (index: number, field: keyof AttributeMapping, value: any) => {
    setMappings(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  // 5. Submit bulk mapping
  const handleSaveMappings = async () => {
    // Basic validation
    const invalidRow = mappings.find(
      m => !m.channel_attribute_code.trim() || !m.channel_attribute_name.trim()
    );
    if (invalidRow) {
      void popupService.alert("Vui lòng điền đầy đủ Mã cột sàn và Tên cột sàn cho tất cả các dòng!");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post(`/api/channels/${channel.id}/attribute-mappings`, mappings);
      void popupService.alert("Lưu cấu hình ánh xạ thuộc tính thành công!");
    } catch (err: any) {
      void popupService.alert(`Lỗi lưu trữ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full" />
        Đang tải ánh xạ thuộc tính...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="bg-surface border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-400 shrink-0" />
          <span>Nếu để trống mục &quot;Áp dụng cho danh mục&quot;, thuộc tính này sẽ được xem là Global và áp dụng cho mọi sản phẩm thuộc kênh này.</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-3.5 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-600 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Thuộc Tính</span>
          </button>
          
          <button
            onClick={handleSaveMappings}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 btn-primary text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Lưu Ánh Xạ</span>
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-surface border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold w-1/4">Thuộc tính PIM (Core)</th>
                <th className="px-6 py-4 font-semibold w-1/4">Cột sàn yêu cầu (Excel/CSV ID)</th>
                <th className="px-6 py-4 font-semibold w-1/4">Tên hiển thị thuộc tính sàn</th>
                <th className="px-6 py-4 font-semibold w-1/4">Áp dụng cho danh mục sàn</th>
                <th className="px-6 py-4 font-semibold text-right w-20">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-medium">
                    Chưa có cấu hình ánh xạ thuộc tính nào. Nhấp &quot;Thêm Thuộc Tính&quot; để bắt đầu.
                  </td>
                </tr>
              ) : (
                mappings.map((m, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                    {/* 1. Select PIM Attribute */}
                    <td className="px-6 py-2">
                      <select
                        className="bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 w-full text-xs text-gray-600 focus:outline-none focus:border-brand-primary"
                        value={m.pim_attribute_id}
                        onChange={(e) => handleCellChange(index, "pim_attribute_id", Number(e.target.value))}
                      >
                        {pimAttributes.map(attr => (
                          <option key={attr.id} value={attr.id}>{attr.name} ({attr.code})</option>
                        ))}
                      </select>
                    </td>

                    {/* 2. Channel Attribute Code */}
                    <td className="px-6 py-2">
                      <input 
                        type="text" 
                        placeholder="e.g. ps_brand"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:border-brand-primary"
                        value={m.channel_attribute_code}
                        onChange={(e) => handleCellChange(index, "channel_attribute_code", e.target.value)}
                      />
                    </td>

                    {/* 3. Channel Attribute Name */}
                    <td className="px-6 py-2">
                      <input 
                        type="text" 
                        placeholder="e.g. Thương hiệu"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:border-brand-primary"
                        value={m.channel_attribute_name}
                        onChange={(e) => handleCellChange(index, "channel_attribute_name", e.target.value)}
                      />
                    </td>

                    {/* 4. Select Target Category Mapping */}
                    <td className="px-6 py-2">
                      <select
                        className="bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 w-full text-xs text-gray-600 focus:outline-none focus:border-brand-primary"
                        value={m.channel_category_code || ""}
                        onChange={(e) => handleCellChange(index, "channel_category_code", e.target.value || null)}
                      >
                        <option value="">-- Áp dụng Global --</option>
                        {categoryMappings.map(cat => (
                          <option key={cat.channel_category_code} value={cat.channel_category_code}>
                            {cat.channel_category_name} ({cat.channel_category_code})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 5. Delete Row */}
                    <td className="px-6 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-all cursor-pointer"
                        title="Xóa dòng"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
