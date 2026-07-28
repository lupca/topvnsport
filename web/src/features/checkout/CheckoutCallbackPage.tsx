import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, ShoppingBag } from 'lucide-react';

interface CheckoutCallbackPageProps {
  status: 'success' | 'error' | 'cancel';
}

export default function CheckoutCallbackPage({ status }: CheckoutCallbackPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderNumber = searchParams.get('order') || searchParams.get('order_number') || '';

  if (status === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl text-gray-900 uppercase">Thanh toán thành công!</h1>
            <p className="text-sm text-gray-500">
              Cảm ơn bạn đã hoàn tất thanh toán cho đơn hàng. Hệ thống đã xác nhận thanh toán qua SePay.
            </p>
          </div>

          {orderNumber && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs font-mono text-gray-700">
              Mã đơn hàng: <strong className="text-brand-primary">{orderNumber}</strong>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="w-full btn-primary text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" /> Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'cancel') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <AlertTriangle className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl text-gray-900 uppercase">Đã hủy thanh toán</h1>
            <p className="text-sm text-gray-500">
              Bạn đã hủy quá trình thanh toán SePay. Đơn hàng của bạn vẫn được lưu giữ.
            </p>
          </div>

          {orderNumber && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs font-mono text-gray-700">
              Mã đơn hàng: <strong className="text-gray-900">{orderNumber}</strong>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => navigate('/catalog')}
              className="w-full btn-primary text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2"
            >
              Quay lại cửa hàng <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <XCircle className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-black text-2xl text-gray-900 uppercase">Thanh toán thất bại</h1>
          <p className="text-sm text-gray-500">
            Có lỗi xảy ra trong quá trình xử lý thanh toán qua SePay. Vui lòng thử lại hoặc chọn phương thức khác.
          </p>
        </div>

        {orderNumber && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs font-mono text-gray-700">
            Mã đơn hàng: <strong className="text-rose-600">{orderNumber}</strong>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            onClick={() => navigate('/catalog')}
            className="w-full btn-primary text-xs uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2"
          >
            Quay lại cửa hàng <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
