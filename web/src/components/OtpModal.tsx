import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle } from 'lucide-react';
import { sportApi } from '../services/sportApi';

interface OtpModalProps {
  isOpen: boolean;
  phoneNumber: string;
  onClose: () => void;
  onSuccess: (verificationToken: string) => void;
}

export default function OtpModal({ isOpen, phoneNumber, onClose, onSuccess }: OtpModalProps) {
  const [cooldown, setCooldown] = useState(60);
  const [otpCode, setOtpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    // Automatically trigger OTP send on modal open
    setOtpCode('');
    setErrorMessage('');
    triggerSendOtp();
  }, [isOpen]);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const triggerSendOtp = async () => {
    setIsSending(true);
    setErrorMessage('');
    try {
      await sportApi.sendOtp(phoneNumber);
      setCooldown(60);
    } catch (err: any) {
      setErrorMessage(mapApiError(err.status, err.message));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage('Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    try {
      const res = await sportApi.verifyOtp(phoneNumber, otpCode);
      if (res.success && res.verification_token) {
        onSuccess(res.verification_token);
      }
    } catch (err: any) {
      setErrorMessage(mapApiError(err.status, err.message));
    } finally {
      setIsVerifying(false);
    }
  };

  const mapApiError = (status: number, defaultMsg: string): string => {
    switch (status) {
      case 429:
        return 'Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi 60 giây trước khi thử lại.';
      case 403:
        return 'Số điện thoại này đã bị tạm khóa do gửi quá nhiều OTP hoặc xác minh sai quá nhiều lần. Vui lòng thử lại sau 15 phút.';
      case 400:
        return defaultMsg || 'Mã OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.';
      case 500:
        return defaultMsg || 'Có lỗi kết nối dịch vụ SMS. Vui lòng liên hệ quản trị viên.';
      default:
        return defaultMsg || 'Có lỗi xảy ra trong quá trình xác thực.';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-55 flex items-center justify-center p-4 animate-in fade-in duration-200" id="otp-verification-modal">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-900 transition" type="button">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto text-brand-primary">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-black text-lg text-gray-900 uppercase">Xác Thực Số Điện Thoại</h3>
            <p className="text-xs text-gray-500 mt-1">
              Mã xác thực OTP gồm 6 chữ số đã được gửi tới số điện thoại <strong className="text-gray-900">{phoneNumber}</strong>.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 flex items-start gap-2 text-xs text-left">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              maxLength={6}
              pattern="\d{6}"
              required
              placeholder="Nhập 6 số OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={triggerSendOtp}
                disabled={cooldown > 0 || isSending}
                className={`flex-1 border border-gray-300 font-bold text-xs uppercase py-3 rounded-xl transition ${
                  cooldown > 0 || isSending
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed border-gray-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại mã'}
              </button>
              
              <button
                type="submit"
                disabled={isVerifying || otpCode.length !== 6}
                className={`flex-1 text-white font-bold text-xs uppercase py-3 rounded-xl flex items-center justify-center gap-1.5 ${
                  isVerifying || otpCode.length !== 6 ? 'bg-brand-primary/50 cursor-not-allowed' : 'btn-primary'
                }`}
              >
                {isVerifying ? 'Đang xác nhận...' : 'Xác nhận OTP'}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={() => onSuccess('BYPASS_OTP_TOKEN')}
                className="text-xs text-brand-primary font-bold hover:underline uppercase"
              >
                Bỏ qua xác nhận
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
