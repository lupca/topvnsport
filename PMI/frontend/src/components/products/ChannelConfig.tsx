import React, { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { AlertCircle, HelpCircle, Layers, Settings, Globe } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { fetchWithAuth } from "@/utils/apiClient";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

interface ChannelConfigProps {
  channelCode: "shopee_vn" | "tiktok_shop";
  channelName: string;
}

export default function ChannelConfig({ channelCode, channelName }: ChannelConfigProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<any>();
  const [channelId, setChannelId] = useState<number | null>(null);
  const [categoryMapping, setCategoryMapping] = useState<any | null>(null);
  const [attributeMappings, setAttributeMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const watchCategoryId = watch("category_id");
  const watchVariants = watch("variants") || [];
  const channelListings = watch("channel_listings") || [];
  const listingIndex = channelListings.findIndex((cl: any) => cl.channel_code === channelCode);

  const watchOverrides = watch(`channel_listings.${listingIndex}.variant_overrides`) || [];
  const watchAttrValues = watch(`channel_listings.${listingIndex}.attribute_values`) || [];
  const listingErrors = (errors?.channel_listings as any)?.[listingIndex];

  // 1. Fetch channel metadata, mappings, and config on mount / channelCode change
  useEffect(() => {
    setLoading(true);
    fetchWithAuth("/api/channels")
      .then(channels => {
        const chan = channels.find((c: any) => c.code === channelCode);
        if (chan) {
          setChannelId(chan.id);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Error fetching channels:", err);
        setLoading(false);
      });
  }, [channelCode]);

  // 2. Fetch category and attribute mappings when channelId or category changes
  useEffect(() => {
    if (!channelId) return;

    // Fetch category mapping for this specific PIM category
    fetchWithAuth(`/api/channels/${channelId}/category-mappings`)
      .then(mappings => {
        const mapped = mappings.find((m: any) => m.pim_category_id === Number(watchCategoryId));
        setCategoryMapping(mapped || null);
        
        // Fetch attribute mappings
        return fetchWithAuth(`/api/channels/${channelId}/attribute-mappings`)
          .then(attrs => {
            // Filter attributes that are either global (null) or match the channel category code
            const mappedCatCode = mapped?.channel_category_code;
            const filteredAttrs = attrs.filter((a: any) => 
              a.channel_category_code === null || a.channel_category_code === mappedCatCode
            );
            setAttributeMappings(filteredAttrs);
            setLoading(false);
          });
      })
      .catch(err => {
        console.error("Error fetching channel mappings:", err);
        setLoading(false);
      });
  }, [channelId, watchCategoryId]);

  // 3. Sync variant overrides with core variants
  useEffect(() => {
    if (listingIndex === -1 || watchVariants.length === 0) return;

    const newOverrides = watchVariants.map((v: any) => {
      const existing = watchOverrides.find((o: any) => o.sku_code === v.sku_code);
      return {
        sku_code: v.sku_code,
        price_override: existing?.price_override || null,
        channel_variant_id: existing?.channel_variant_id || ""
      };
    });

    if (JSON.stringify(newOverrides) !== JSON.stringify(watchOverrides)) {
      setValue(`channel_listings.${listingIndex}.variant_overrides`, newOverrides);
    }
  }, [watchVariants, listingIndex, setValue]);

  // 4. Sync attribute values with current mapped attributes
  useEffect(() => {
    if (listingIndex === -1 || attributeMappings.length === 0) return;

    const newVals = attributeMappings.map((am: any) => {
      const existing = watchAttrValues.find((av: any) => av.attribute_mapping_id === am.id);
      return {
        attribute_mapping_id: am.id,
        value_string: existing?.value_string || "",
        value_decimal: existing?.value_decimal || null
      };
    });

    if (JSON.stringify(newVals) !== JSON.stringify(watchAttrValues)) {
      setValue(`channel_listings.${listingIndex}.attribute_values`, newVals);
    }
  }, [attributeMappings, listingIndex, setValue]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full" />
        Đang tải cấu hình kênh {channelName}...
      </div>
    );
  }

  if (listingIndex === -1) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0" />
        Lỗi: Kênh {channelName} không có trong danh sách cấu hình. Vui lòng kiểm tra lại defaultValues.
      </div>
    );
  }

  const isPublished = watch(`channel_listings.${listingIndex}.status`) === "Published";

  return (
    <div className="space-y-6">
      {/* 1. Channel Active Switch */}
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" />
            Niêm yết trên {channelName}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">Bật tính năng này để cho phép xuất dữ liệu sản phẩm này sang {channelName}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={isPublished}
            onChange={(e) => {
              setValue(`channel_listings.${listingIndex}.status`, e.target.checked ? "Published" : "Draft");
            }}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
        </label>
      </div>

      {isPublished && (
        <div className="space-y-6 animate-fadeIn">
          {/* 2. Overrides block */}
          <div className="p-6 border border-gray-200 rounded-2xl space-y-4">
            <h4 className="font-bold text-gray-900 border-b pb-3 border-gray-200">Ghi đè thông tin cơ bản</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tên hiển thị ghi đè</label>
                <input 
                  type="text" 
                  placeholder="Mặc định lấy từ Tên gốc"
                  className="pim-input"
                  {...register(`channel_listings.${listingIndex}.title_override`)}
                />
                {listingErrors?.title_override && (
                  <p className="text-[10px] text-rose-500 mt-0.5">{listingErrors.title_override.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Mã sản phẩm trên sàn (Marketplace ID)</label>
                <input 
                  type="text" 
                  placeholder="e.g. shopee_item_12345"
                  className="pim-input"
                  {...register(`channel_listings.${listingIndex}.channel_product_id`)}
                />
                {listingErrors?.channel_product_id && (
                  <p className="text-[10px] text-rose-500 mt-0.5">{listingErrors.channel_product_id.message}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Mô tả chi tiết ghi đè</label>
                <textarea 
                  rows={4}
                  placeholder="Mặc định lấy từ Mô tả gốc"
                  className="pim-input"
                  {...register(`channel_listings.${listingIndex}.description_override`)}
                />
                {listingErrors?.description_override && (
                  <p className="text-[10px] text-rose-500 mt-0.5">{listingErrors.description_override.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Category Mapping display */}
          <div className="p-6 border border-gray-200 rounded-2xl space-y-3">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-gray-500" /> Ngành hàng Marketplace
            </h4>
            {categoryMapping ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                Đã tự động khớp danh mục: <strong className="text-emerald-900">{categoryMapping.channel_category_name}</strong> (Mã: <code>{categoryMapping.channel_category_code}</code>)
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Cảnh báo:</strong> Ngành hàng gốc của sản phẩm chưa được cấu hình ánh xạ sang {channelName}.
                  <p className="text-xs text-amber-700 mt-1">Vui lòng thiết lập ánh xạ danh mục trong phần Cài đặt của hệ thống PIM.</p>
                </div>
              </div>
            )}
          </div>

          {/* 4. Variant Overrides Matrix */}
          <div className="p-6 border border-gray-200 rounded-2xl space-y-4">
            <h4 className="font-bold text-gray-900">Bảng giá riêng trên sàn</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full border-collapse text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Biến thể</th>
                    <th className="px-6 py-3">Mã SKU</th>
                    <th className="px-6 py-3">Giá gốc</th>
                    <th className="px-6 py-3 w-48">Giá bán trên sàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {watchVariants.map((v: any, vIdx: number) => {
                    const optText = [v.tier_1_option, v.tier_2_option].filter(Boolean).join(" / ") || "Mặc định";
                    const variantError = listingErrors?.variant_overrides?.[vIdx];
                    return (
                      <tr key={vIdx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-semibold text-gray-900">{optText}</td>
                        <td className="px-6 py-3 text-xs"><code>{v.sku_code}</code>
                          {variantError?.sku_code && <p className="text-[10px] text-rose-500 mt-0.5">{variantError.sku_code.message}</p>}
                        </td>
                        <td className="px-6 py-3 text-gray-500">₫{Number(v.price).toLocaleString()}</td>
                        <td className="px-6 py-2">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₫</span>
                            <input 
                              type="number" 
                              placeholder="Giá ghi đè"
                              className="pl-6 pr-3 py-1 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-brand-primary"
                              {...register(`channel_listings.${listingIndex}.variant_overrides.${vIdx}.price_override` as const)}
                            />
                          </div>
                          {variantError?.price_override && <p className="text-[10px] text-rose-500 mt-0.5">{variantError.price_override.message}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Dynamic Attributes */}
          {attributeMappings.length > 0 && (
            <div className="p-6 border border-gray-200 rounded-2xl space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" /> Thuộc tính đặc thù sàn
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {attributeMappings.map((am: any, amIdx: number) => {
                  const amValueIdx = watchAttrValues.findIndex((av: any) => av.attribute_mapping_id === am.id);
                  if (amValueIdx === -1) return null;

                  return (
                    <div key={am.id} className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                        {am.channel_attribute_name}
                        <span className="text-xs font-normal text-gray-400">({am.channel_attribute_code})</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder={`Nhập ${am.channel_attribute_name}`}
                        className="pim-input"
                        {...register(`channel_listings.${listingIndex}.attribute_values.${amValueIdx}.value_string`)}
                      />
                      {listingErrors?.attribute_values?.[amValueIdx]?.value_string && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{listingErrors.attribute_values[amValueIdx].value_string.message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
