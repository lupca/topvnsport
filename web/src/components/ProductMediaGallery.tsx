import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ProductMediaGalleryProps {
  productName: string;
  image: string;
  gallery?: string[];
}

export default function ProductMediaGallery({ productName, image, gallery }: ProductMediaGalleryProps) {
  const galleryImages = useMemo(() => {
    const images = [image, ...(gallery || [])].filter(Boolean);
    return Array.from(new Set(images));
  }, [image, gallery]);

  const [selectedImage, setSelectedImage] = useState(image);
  const thumbRailRef = useRef<HTMLDivElement | null>(null);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [modalZoomLevel, setModalZoomLevel] = useState(1.4);

  useEffect(() => {
    setSelectedImage(galleryImages[0] || image);
    setIsImageHovered(false);
    setIsZoomModalOpen(false);
    setModalZoomLevel(1.4);
  }, [galleryImages, image]);

  useEffect(() => {
    if (!isZoomModalOpen) return;

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsZoomModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [isZoomModalOpen]);

  const scrollThumbRail = (direction: 'prev' | 'next') => {
    if (!thumbRailRef.current) return;
    const offset = direction === 'next' ? 200 : -200;
    thumbRailRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleSelectImage = (img: string, index: number) => {
    setSelectedImage(img);

    const node = thumbRailRef.current?.children[index] as HTMLElement | undefined;
    node?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const handleMainImageMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setZoomOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const decreaseModalZoom = () => {
    setModalZoomLevel((prev) => Math.max(1, Number((prev - 0.2).toFixed(1))));
  };

  const increaseModalZoom = () => {
    setModalZoomLevel((prev) => Math.min(3, Number((prev + 0.2).toFixed(1))));
  };

  return (
    <>
      <div
        className="bg-gray-50 rounded-2xl border border-gray-100 p-6 flex items-center justify-center relative aspect-square group overflow-hidden shadow-xs cursor-zoom-in"
        onMouseEnter={() => setIsImageHovered(true)}
        onMouseLeave={() => {
          setIsImageHovered(false);
          setZoomOrigin({ x: 50, y: 50 });
        }}
        onMouseMove={handleMainImageMouseMove}
        onClick={() => setIsZoomModalOpen(true)}
      >
        <img
          src={selectedImage}
          alt={productName}
          className="max-h-full max-w-full object-contain transition-transform duration-150"
          style={{
            transform: `scale(${isImageHovered ? 2.25 : 1})`,
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          }}
          referrerPolicy="no-referrer"
        />
        <div className="pointer-events-none absolute left-3 bottom-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">
          Di chuot de zoom • Cham de phong to
        </div>
      </div>

      {galleryImages.length > 1 && (
        <div className="relative z-20 rounded-xl border border-gray-100 bg-white/80 p-2.5">
          <button
            type="button"
            onClick={() => scrollThumbRail('prev')}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white/95 p-1.5 text-gray-600 shadow-sm transition hover:text-brand-primary"
            aria-label="Cuon danh sach anh sang trai"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollThumbRail('next')}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-gray-200 bg-white/95 p-1.5 text-gray-600 shadow-sm transition hover:text-brand-primary"
            aria-label="Cuon danh sach anh sang phai"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            ref={thumbRailRef}
            className="scroll-smooth flex gap-2.5 overflow-x-auto px-7 py-0.5 scrollbar-hide snap-x snap-mandatory touch-pan-x"
          >
            {galleryImages.map((img, i) => (
              <button
                key={`${img}-${i}`}
                type="button"
                onClick={() => handleSelectImage(img, i)}
                className={`w-16 h-16 p-1 bg-white rounded-lg border flex items-center justify-center overflow-hidden shrink-0 snap-start transition-all ${selectedImage === img ? 'border-brand-primary ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                aria-label={`Xem anh ${i + 1} cua ${productName}`}
                aria-pressed={selectedImage === img}
              >
                <img src={img} alt={`${productName} gallery ${i + 1}`} className="max-h-full object-contain" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      )}

      {isZoomModalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Xem anh san pham chi tiet"
          onClick={() => setIsZoomModalOpen(false)}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <div className="absolute right-0 top-0 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  decreaseModalZoom();
                }}
                className="rounded-full bg-white/90 p-2 text-gray-700 transition hover:bg-white"
                aria-label="Thu nho anh"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  increaseModalZoom();
                }}
                className="rounded-full bg-white/90 p-2 text-gray-700 transition hover:bg-white"
                aria-label="Phong to anh"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsZoomModalOpen(false);
                }}
                className="rounded-full bg-white/90 p-2 text-gray-700 transition hover:bg-white"
                aria-label="Dong anh chi tiet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="h-full w-full overflow-auto pt-14 md:pt-0"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto flex min-h-full min-w-max items-center justify-center">
                <img
                  src={selectedImage}
                  alt={`${productName} zoom`}
                  className="h-auto max-h-none w-auto max-w-none object-contain"
                  style={{ width: `${modalZoomLevel * 70}vw` }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
