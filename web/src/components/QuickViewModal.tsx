import React from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, e?: React.MouseEvent) => void;
}

export default function QuickViewModal({ product, onClose, onAddToCart }: QuickViewModalProps) {
  return (
    <AnimatePresence>
      {product && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" id="quick-view-overlay">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden relative border border-gray-100 shadow-2xl p-6"
            id="quick-view-modal-content"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition"
              id="close-quickview-btn"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="aspect-square bg-gray-50 rounded-xl p-4 flex items-center justify-center overflow-hidden">
                <img src={product.image} alt={product.name} className="max-h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] bg-brand-primary text-white font-extrabold uppercase px-2 py-0.5 rounded-sm">{product.brand}</span>
                  <h3 className="font-display font-black text-lg text-gray-900 leading-snug">{product.name}</h3>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed font-light">{product.description}</p>

                {/* Spec Sheet block */}
                <div className="space-y-1.5 text-xs text-gray-600 font-mono py-3 border-t border-b border-gray-100">
                  <div className="flex justify-between">
                    <span>Cân nặng:</span>
                    <strong className="text-gray-900">{product.specs.weight}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Độ cứng thân:</span>
                    <strong className="text-gray-900">{product.specs.stiffness}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Điểm cân bằng:</span>
                    <strong className="text-gray-900">{product.specs.balance}mm</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Lực căng tối đa:</span>
                    <strong className="text-gray-900">{product.specs.maxTension} Lbs</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold text-brand-primary font-display">{(product.salePrice || product.price).toLocaleString('vi-VN')}đ</span>
                  <button
                    onClick={() => {
                      onAddToCart(product);
                      onClose();
                    }}
                    className="bg-brand-light hover:bg-brand-secondary text-white text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-full flex items-center gap-1.5 transition "
                    id="add-to-cart-quickview"
                  >
                    <ShoppingBag className="w-4 h-4" /> Thêm vào giỏ
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
