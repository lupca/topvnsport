import { useState } from "react";
import { apiClient } from "@/utils/apiClient";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { popupService } from "@/components/ui/popupService";

interface UseMediaUploadReturn {
  // Cover image
  coverImage: string | null;
  setCoverImage: (url: string | null) => void;
  uploadingCover: boolean;
  setUploadingCover: React.Dispatch<React.SetStateAction<boolean>>;
  handleCoverUpload: (file: File) => Promise<void>;
  
  // Gallery images
  productImages: string[];
  setProductImages: React.Dispatch<React.SetStateAction<string[]>>;
  uploadingGallery: boolean;
  setUploadingGallery: React.Dispatch<React.SetStateAction<boolean>>;
  handleGalleryUpload: (files: FileList) => Promise<void>;
  removeGalleryImage: (index: number) => void;
  
  // Tier 1 images
  tier1Images: Record<string, string>;
  setTier1Images: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  uploadingTier1: Record<string, boolean>;
  setUploadingTier1: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleTier1Upload: (optionName: string, file: File) => Promise<void>;
  removeTier1Image: (optionName: string) => void;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  
  const [tier1Images, setTier1Images] = useState<Record<string, string>>({});
  const [uploadingTier1, setUploadingTier1] = useState<Record<string, boolean>>({});

  const handleCoverUpload = async (file: File) => {
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

  const handleGalleryUpload = async (files: FileList) => {
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
    }
  };

  const removeGalleryImage = (index: number) => {
    setProductImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTier1Upload = async (optionName: string, file: File) => {
    setUploadingTier1(prev => ({ ...prev, [optionName]: true }));
    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await apiClient.post("/upload", formData);
      setTier1Images(prev => ({ 
        ...prev, 
        [optionName]: normalizeImageUrl(data.image_url) || data.image_url 
      }));
    } catch (err) {
      console.error(err);
      void popupService.alert(`Không thể tải lên ảnh cho phân loại ${optionName}`);
    } finally {
      setUploadingTier1(prev => ({ ...prev, [optionName]: false }));
    }
  };

  const removeTier1Image = (optionName: string) => {
    setTier1Images(prev => {
      const next = { ...prev };
      delete next[optionName];
      return next;
    });
  };

  return {
    coverImage,
    setCoverImage,
    uploadingCover,
    setUploadingCover,
    handleCoverUpload,
    productImages,
    setProductImages,
    uploadingGallery,
    setUploadingGallery,
    handleGalleryUpload,
    removeGalleryImage,
    tier1Images,
    setTier1Images,
    uploadingTier1,
    setUploadingTier1,
    handleTier1Upload,
    removeTier1Image,
  };
}
