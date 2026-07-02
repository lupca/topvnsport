import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, ShieldCheck, CheckCircle2, Phone, MapPin, Truck } from 'lucide-react';
import { StringOption } from '../types';
import { sportApi } from '../services/sportApi';
import { popupService } from './ui/popupService';

export interface CartItem {
  id: string; // Unique instance id
  productId: string;
  skuCode?: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  selectedWeight: string;
  selectedColor: string;
  stringOption: StringOption | null;
  tension: number;
  quantity: number;
}

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

export default function CartModal({ isOpen, onClose, cartItems, onRemoveItem, onClearCart }: CartModalProps) {
  const [step, setStep] = useState(1); // 1 = Cart list, 2 = Checkout Form, 3 = Success Screen
  
  // Checkout Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'fast'>('standard');
  const [city, setCity] = useState('Hà Nội');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Calculate prices
  const itemsTotal = cartItems.reduce((acc, item) => {
    const stringCost = item.stringOption ? item.stringOption.price : 0;
    return acc + (item.price + stringCost) * item.quantity;
  }, 0);

  const shippingCost = shippingMethod === 'standard' ? 30000 : 50000;
  const orderTotal = itemsTotal + shippingCost;

  const handleCheckoutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName || !phone || !address) {
      await popupService.alert('Vui lòng cung cấp đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = cartItems.map(item => {
        const safeWeight = item.selectedWeight?.replace(/\//g, '-') || 'STD';
        const safeColor = item.selectedColor?.replace(/\//g, '-') || 'STD';
        return {
          sku_code: item.skuCode || `SKU-${item.productId}-${safeWeight}-${safeColor}`,
          quantity: item.quantity
        };
      });

      await sportApi.createOrder({
        customer_id: 1,
        channel_id: 1,
        items,
        shipping_fee: shippingCost,
        shipping_address: `${address}, ${city}`,
        note: `Khách hàng: ${fullName}, SĐT: ${phone}`
      });

      setStep(3);
    } catch (err) {
      console.error(err);
      await popupService.alert('Có lỗi xảy ra khi tạo đơn hàng trên OMS. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClearCart();
    setStep(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end animate-in fade-in duration-200" id="cart-drawer-modal">
      
      {/* Drawer Container */}
      <div className="bg-white w-full max-w-lg h-full flex flex-col justify-between shadow-2xl relative animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-500" />
            <span className="font-display font-black text-base text-gray-900 uppercase">
              {step === 1 ? 'Giỏ Hàng Của Bạn' : step === 2 ? 'Thanh Toán Đơn Hàng' : 'Đặt Hàng Thành Công'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic step rendering */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {step === 1 && (
            <div className="space-y-4">
              {cartItems.length > 0 ? (
                <>
                  <div className="divide-y divide-gray-100">
                    {cartItems.map((item) => {
                      const stringPrice = item.stringOption ? item.stringOption.price : 0;
                      return (
                        <div key={item.id} className="py-4 flex gap-3.5">
                          <img src={item.image} alt={item.name} className="w-14 h-14 object-contain rounded-lg bg-gray-50 border border-gray-100 shrink-0" referrerPolicy="no-referrer" />
                          <div className="flex-1 space-y-1">
                            <span className="text-[10px] font-mono font-bold text-orange-500 uppercase">{item.brand}</span>
                            <h4 className="font-bold text-xs text-gray-900 line-clamp-1 leading-normal">{item.name}</h4>
                            
                            {/* Selected Specs info */}
                            <div className="text-[10px] text-gray-500 font-mono space-y-0.5">
                              <p>• Phiên bản: <strong className="text-gray-700">{item.selectedWeight} | {item.selectedColor}</strong></p>
                              {item.stringOption ? (
                                <p className="text-orange-600 font-bold">• Đan cước: {item.stringOption.name} ({item.tension} Kg)</p>
                              ) : (
                                <p className="text-gray-400">• Không đan lưới (Mua khung trơn)</p>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-1.5">
                              <span className="text-xs text-gray-400">Số lượng: <strong>{item.quantity}</strong></span>
                              <span className="text-sm font-bold text-orange-600 font-mono">
                                {((item.price + stringPrice) * item.quantity).toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition h-max"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trust warning */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start gap-2 text-[11px] text-gray-500 leading-normal">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Hóa đơn bán vợt kèm thẻ bảo hành chống gãy sập khung chính hãng.</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500 text-sm">Giỏ hàng của bạn đang trống.</p>
                  <button onClick={onClose} className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-full transition glow-btn">
                    Mua Sắm Ngay &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-orange-600 border-b border-gray-100 pb-1.5">Thông tin nhận hàng</h3>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Họ và tên người nhận *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Số điện thoại liên hệ *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ví dụ: 0912345678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Tỉnh / Thành Phố</label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
                  >
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                    <option value="Hải Dương">Hải Dương</option>
                    <option value="Khác">Khu vực khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Địa chỉ cụ thể (Số nhà, Ngõ/Hẻm, Đường) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Số 12 Chùa Hà"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-orange-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Shipping Method */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 text-xs uppercase text-orange-600">Phương thức vận chuyển</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setShippingMethod('standard')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${shippingMethod === 'standard' ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <Truck className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">Giao hàng chuẩn (COD)</p>
                      <p className="text-[10px] text-gray-400">3 - 5 ngày • 30.000đ</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setShippingMethod('fast')}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-2 ${shippingMethod === 'fast' ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-150 hover:border-gray-200'}`}
                  >
                    <Truck className="w-4 h-4 text-orange-600 animate-pulse" />
                    <div>
                      <p className="font-bold text-[11px] text-gray-900">Giao hỏa tốc</p>
                      <p className="text-[10px] text-gray-400">1 - 2 ngày • 50.000đ</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h3 className="font-display font-black text-xl text-gray-900 uppercase">ĐẶT HÀNG THÀNH CÔNG!</h3>
              <p className="text-xs text-gray-500">
                Cảm ơn bạn đã tin tưởng TopVNSport. Hệ thống đang tiến hành đóng gói và chuẩn bị bàn giao cho bưu cục vận chuyển.
              </p>
              
              <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-100 text-xs text-gray-700 space-y-2 font-mono">
                <p>• <strong>Người nhận:</strong> {fullName}</p>
                <p>• <strong>Số điện thoại:</strong> {phone}</p>
                <p>• <strong>Địa chỉ giao:</strong> {address}, {city}</p>
                <p>• <strong>Phương thức giao:</strong> {shippingMethod === 'standard' ? 'Giao hàng chuẩn (COD)' : 'Giao hàng hỏa tốc'}</p>
                <p className="text-sm font-bold text-orange-600 border-t border-gray-200 pt-2 mt-2">
                  Tổng hóa đơn thanh toán: {orderTotal.toLocaleString('vi-VN')}đ
                </p>
              </div>

              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-left text-[11px] text-orange-700 flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>
                  Đơn hàng của bạn sẽ được bảo hành trực tiếp thông qua số điện thoại mua hàng tại tất cả hơn 80 chi nhánh TopVNSport toàn quốc.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions of drawer */}
        {cartItems.length > 0 && step < 3 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
            <div className="space-y-1.5 text-xs text-gray-600 font-mono">
              <div className="flex justify-between">
                <span>Tổng tiền hàng:</span>
                <strong className="text-gray-900">{itemsTotal.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển:</span>
                <strong className="text-gray-900">{shippingCost.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5 font-bold">
                <span className="text-gray-900">Tổng cộng thanh toán:</span>
                <span className="text-orange-600 font-display text-base">{orderTotal.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-full flex items-center justify-center gap-1.5 transition glow-btn"
              >
                Tiến hành thanh toán &rarr;
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={() => setStep(1)}
                  className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-full transition"
                >
                  Quay lại
                </button>
                <button
                  onClick={() => {
                    void handleCheckoutSubmit();
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-full flex items-center justify-center gap-1.5 transition glow-btn ${isSubmitting ? 'bg-orange-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt hàng ✓'}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleFinish}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-full transition"
            >
              Hoàn thành mua sắm
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
