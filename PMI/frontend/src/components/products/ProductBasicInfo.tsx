import React from "react";
import { useFormContext } from "react-hook-form";
import { Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { APP_SETTINGS } from "@/config/settings";
import { popupService } from "@/components/ui/popupService";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { fetchWithAuth, apiClient } from "@/utils/apiClient";

const API_BASE_URL = APP_SETTINGS.api.baseUrl;

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
}

export interface AttributeFamily {
  id: number;
  code: string;
  name: string;
}

interface ProductBasicInfoProps {
  categories: Category[];
  families: AttributeFamily[];
  coverImage: string | null;
  setCoverImage: (url: string | null) => void;
  productImages: string[];
  setProductImages: React.Dispatch<React.SetStateAction<string[]>>;
  uploadingCover: boolean;
  setUploadingCover: (loading: boolean) => void;
  uploadingGallery: boolean;
  setUploadingGallery: (loading: boolean) => void;
}

export default function ProductBasicInfo({
  categories,
  families,
  coverImage,
  setCoverImage,
  productImages,
  setProductImages,
  uploadingCover,
  setUploadingCover,
  uploadingGallery,
  setUploadingGallery
}: ProductBasicInfoProps) {
  const { register, formState: { errors } } = useFormContext();

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await apiClient.post("/upload", formData);
      setCoverImage(normalizeImageUrl(data.image_url) || data.image_url);
    } catch (err) {
      console.error(err);
      void popupService.alert("Không thể tải lên ảnh bìa");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 8 - productImages.length;
    if (remainingSlots <= 0) {
      void popupService.alert("Đã đạt giới hạn tối đa 8 ảnh phụ.");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingGallery(true);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const data = await apiClient.post("/upload", formData);
        newUrls.push(normalizeImageUrl(data.image_url) || data.image_url);
      }

      setProductImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error(err);
      void popupService.alert("Tải lên ảnh phụ thất bại.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const removeGalleryImage = (indexToRemove: number) => {
    setProductImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="pim-card space-y-6">
      <h2 className="text-lg font-bold text-gray-900 border-b pb-3 border-gray-200">Thông tin cơ bản</h2>
      
      {/* Product Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Hình ảnh sản phẩm (Tối đa 9 ảnh chung)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 gap-4 items-end">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500 font-semibold">Ảnh bìa</span>
            <div className="relative h-24 w-24 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-gray-50 overflow-hidden group hover:border-primary-400 transition-colors">
              {coverImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="Cover" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                  >
                    Thay đổi
                  </button>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full">
                  {uploadingCover ? (
                    <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                  ) : (
                    <>
                      <ImageIcon className="h-6 w-6 text-gray-500" />
                      <span className="text-[9px] text-gray-500 mt-1 font-medium">Tải ảnh bìa</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </label>
              )}
            </div>
          </div>

          {productImages.map((url, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-semibold">Ảnh phụ {idx + 1}</span>
              <div className="relative h-24 w-24 border border-gray-300 rounded-2xl overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(idx)}
                  className="absolute inset-0 bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}

          {productImages.length < 8 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-semibold">Thêm ảnh</span>
              <label className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer hover:border-primary-400 transition-colors">
                {uploadingGallery ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
                ) : (
                  <>
                    <Plus className="h-5 w-5 text-gray-500" />
                    <span className="text-[9px] text-gray-500 mt-1 font-medium">Tải ảnh phụ</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleGalleryUpload}
                />
              </label>
            </div>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Khuyên dùng hình ảnh kích thước 800 x 800 trở lên. Bạn có thể tải lên tối đa 1 ảnh bìa và 8 ảnh phụ.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Tên sản phẩm *</label>
          <input 
            type="text" 
            placeholder="Nhập tên sản phẩm (Ví dụ: Áo thun nam Cotton 100% cổ tròn)"
            className="pim-input"
            {...register("name")}
          />
          {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message as string}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Mã SKU sản phẩm cha *</label>
            <input 
              type="text" 
              placeholder="Ví dụ: TSHIRT-PARENT"
              className="pim-input"
              {...register("product_code")}
            />
            {errors.product_code && <p className="text-xs text-rose-500 font-medium">{errors.product_code.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Ngành hàng *</label>
            <select 
              className="pim-input"
              {...register("category_id")}
            >
              <option value={0}>Chọn ngành hàng</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
            {errors.category_id && <p className="text-xs text-rose-500 font-medium">{errors.category_id.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Attribute Family *</label>
            <select
              className="pim-input"
              {...register("family_id")}
            >
              <option value={0}>Chọn bộ thuộc tính</option>
              {families.map(fam => (
                <option key={fam.id} value={fam.id}>
                  {fam.name} ({fam.code})
                </option>
              ))}
            </select>
            {errors.family_id && <p className="text-xs text-rose-500 font-medium">{errors.family_id.message as string}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700">Mô tả sản phẩm *</label>
        <textarea 
          rows={4}
          placeholder="Mô tả thông tin chi tiết về sản phẩm của bạn (chất liệu, công dụng, thông số kỹ thuật...)"
          className="pim-input"
          {...register("description")}
        />
        {errors.description && <p className="text-xs text-rose-500 font-medium">{errors.description.message as string}</p>}
      </div>
    </div>
  );
}
