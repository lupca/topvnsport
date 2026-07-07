import React, { useState, useEffect } from "react";
import { Search, Loader2, Save, Filter } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface Category {
  id: number;
  name: string;
  code: string;
  parent_id: number | null;
}

interface CategoryMapping {
  pim_category_id: number;
  channel_category_code: string;
  channel_category_name: string;
}

interface CategoryMappingTabProps {
  channel: { id: number; code: string; name: string };
}

export default function CategoryMappingTab({ channel }: CategoryMappingTabProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<Record<number, CategoryMapping>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [categoryPaths, setCategoryPaths] = useState<Record<number, string>>({});

  // 1. Fetch categories and mappings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, mapsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/categories`),
          fetch(`${API_BASE_URL}/api/channels/${channel.id}/category-mappings`)
        ]);

        if (!catsRes.ok || !mapsRes.ok) throw new Error("Không thể tải dữ liệu ánh xạ danh mục");

        const catsData: Category[] = await catsRes.json();
        const mapsData: CategoryMapping[] = await mapsRes.json();

        setCategories(catsData);

        // Build path hierarchy
        const catMap = new Map<number, Category>();
        catsData.forEach(c => catMap.set(c.id, c));
        const getPath = (cat: Category): string => {
          if (cat.parent_id && catMap.has(cat.parent_id)) {
            return `${getPath(catMap.get(cat.parent_id)!)} > ${cat.name}`;
          }
          return cat.name;
        };
        const paths: Record<number, string> = {};
        catsData.forEach(c => {
          paths[c.id] = getPath(c);
        });
        setCategoryPaths(paths);

        // Parse mappings into map keying by pim_category_id
        const mapObj: Record<number, CategoryMapping> = {};
        mapsData.forEach(m => {
          mapObj[m.pim_category_id] = m;
        });
        setMappings(mapObj);
      } catch (err: any) {
        void popupService.alert(`Lỗi: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [channel]);

  // 2. Handle input changes for category mapping rows
  const handleInputChange = (pimCatId: number, field: "channel_category_code" | "channel_category_name", value: string) => {
    setMappings(prev => {
      const existing = prev[pimCatId] || {
        pim_category_id: pimCatId,
        channel_category_code: "",
        channel_category_name: ""
      };
      return {
        ...prev,
        [pimCatId]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  // 3. Save category mappings to database
  const handleBulkSave = async () => {
    setSaving(true);
    try {
      // Build the list of active mappings (filtering out empty ones)
      const mappingList = Object.values(mappings).filter(
        m => m.channel_category_code.trim() !== "" && m.channel_category_name.trim() !== ""
      );

      const res = await fetch(`${API_BASE_URL}/api/channels/${channel.id}/category-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingList)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể lưu ánh xạ danh mục");
      }

      void popupService.alert("Lưu ánh xạ danh mục thành công!");
    } catch (err: any) {
      void popupService.alert(`Lỗi lưu trữ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 4. Filter list based on search queries and unmapped settings
  const filteredCategories = categories.filter(cat => {
    const path = categoryPaths[cat.id] || cat.name;
    const matchesSearch = path.toLowerCase().includes(searchQuery.toLowerCase());
    
    const mapping = mappings[cat.id];
    const isMapped = mapping && mapping.channel_category_code.trim() !== "";
    const matchesUnmapped = !showOnlyUnmapped || !isMapped;

    return matchesSearch && matchesUnmapped;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full" />
        Đang tải ánh xạ danh mục...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar filters */}
      <div className="bg-surface border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-72">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm danh mục PIM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-brand-primary transition-all text-gray-700"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
            <input 
              type="checkbox"
              checked={showOnlyUnmapped}
              onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
              className="rounded text-brand-primary focus:ring-brand-primary"
            />
            <span>Chỉ danh mục chưa ánh xạ</span>
          </label>

          <div className="h-4 w-px bg-gray-200" />

          <button
            onClick={handleBulkSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 btn-primary text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Lưu Ánh Xạ Đồng Loạt</span>
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-surface border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold w-1/2">Danh mục PIM (Core)</th>
                <th className="px-6 py-4 font-semibold">Mã danh mục sàn ({channel.name})</th>
                <th className="px-6 py-4 font-semibold">Tên danh mục sàn ({channel.name})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500 font-medium">
                    Không tìm thấy danh mục nào phù hợp bộ lọc
                  </td>
                </tr>
              ) : (
                filteredCategories.map(cat => {
                  const mapping = mappings[cat.id] || { channel_category_code: "", channel_category_name: "" };
                  const path = categoryPaths[cat.id] || cat.name;

                  return (
                    <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{path}</td>
                      <td className="px-6 py-2">
                        <input 
                          type="text" 
                          placeholder="Nhập mã ngành sàn (e.g. 100021)"
                          className="px-3 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:border-brand-primary"
                          value={mapping.channel_category_code}
                          onChange={(e) => handleInputChange(cat.id, "channel_category_code", e.target.value)}
                        />
                      </td>
                      <td className="px-6 py-2">
                        <input 
                          type="text" 
                          placeholder="Nhập tên ngành sàn (e.g. Vợt tennis)"
                          className="px-3 py-1.5 border border-gray-300 rounded-lg w-full focus:outline-none focus:border-brand-primary"
                          value={mapping.channel_category_name}
                          onChange={(e) => handleInputChange(cat.id, "channel_category_name", e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
