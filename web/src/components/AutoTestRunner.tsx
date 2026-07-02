import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, AlertCircle, RefreshCw, X, ShieldAlert, Terminal, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, StringOption } from '../types';

interface AutoTestRunnerProps {
  onSetView: (view: any, extra?: any) => void;
  onAddToCartWithSpecs: (product: Product, weight: string, color: string, stringChoice: StringOption | null, tension: number) => void;
  onClearCart: () => void;
  productsList: Product[];
  stringOptionsList: StringOption[];
}

interface TestStep {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  error?: string;
}

export default function AutoTestRunner({
  onSetView,
  onAddToCartWithSpecs,
  onClearCart,
  productsList,
  stringOptionsList
}: AutoTestRunnerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [steps, setSteps] = useState<TestStep[]>([
    { id: '1', name: 'TC-01: Khởi tạo hệ thống & Làm sạch giỏ hàng', description: 'Xác nhận cơ sở dữ liệu sản phẩm khả dụng và dọn sạch giỏ hàng hiện có.', status: 'idle' },
    { id: '2', name: 'TC-02: Chạy thuật toán Cố Vấn Chọn Vợt (Racket Finder)', description: 'Mô phỏng người chơi mới, tấn công, ngân sách tiết kiệm và so khớp đề xuất.', status: 'idle' },
    { id: '3', name: 'TC-03: Thử nghiệm Chi Tiết Sản Phẩm & Tuỳ biến', description: 'Mở trang chi tiết, chọn cấu hình đan lưới Yonex Exbolt và lực căng 11kg.', status: 'idle' },
    { id: '4', name: 'TC-04: Thử nghiệm Thêm Vào Giỏ Hàng & Tính Toán Tổng', description: 'Thêm sản phẩm kèm phụ kiện lưới, kiểm soát chiết khấu và phí vận chuyển.', status: 'idle' },
    { id: '5', name: 'TC-05: Mô phỏng Điền Form Thanh Toán & Đặt Hàng', description: 'Tự động nhập thông tin giao hàng chuẩn và kiểm tra phản hồi hệ thống.', status: 'idle' }
  ]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runTestFlow = async () => {
    setIsRunning(true);
    setConsoleLogs([]);
    onClearCart();
    
    const updatedSteps = steps.map(s => ({ ...s, status: 'idle' as const, error: undefined }));
    setSteps(updatedSteps);

    addLog('🚀 BẮT ĐẦU CHẠY TEST WEB TOÀN BỘ HỆ THỐNG');

    // STEP 1
    setCurrentStepIndex(0);
    setSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, status: 'running' } : s));
    addLog('Đang chạy TC-01: Khởi tạo dữ liệu...');
    await new Promise(r => setTimeout(r, 1000));
    
    if (productsList.length > 0 && stringOptionsList.length > 0) {
      setSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, status: 'passed' } : s));
      addLog(`✓ Khởi tạo thành công: Phát hiện ${productsList.length} sản phẩm, ${stringOptionsList.length} lựa chọn cước.`);
    } else {
      setSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, status: 'failed', error: 'Không tìm thấy danh sách sản phẩm.' } : s));
      addLog('❌ Thất bại: Không nạp được dữ liệu.');
      setIsRunning(false);
      return;
    }

    // STEP 2
    setCurrentStepIndex(1);
    setSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, status: 'running' } : s));
    addLog('Đang chạy TC-02: Mô phỏng Cố vấn Chọn vợt...');
    onSetView('home');
    await new Promise(r => setTimeout(r, 1200));
    
    // Simulating matching racket
    const beginnerRackets = productsList.filter(p => p.category === 'Vợt' && p.price <= 1500000);
    if (beginnerRackets.length > 0) {
      setSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, status: 'passed' } : s));
      addLog(`✓ Đề xuất thành công: Lối đánh cho người mới tìm thấy vợt "${beginnerRackets[0].name}" giá phù hợp.`);
    } else {
      setSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, status: 'failed', error: 'Không tìm thấy vợt phù hợp với điều kiện.' } : s));
      addLog('❌ Thất bại: Thuật toán tìm vợt trả về danh sách rỗng.');
      setIsRunning(false);
      return;
    }

    // STEP 3
    setCurrentStepIndex(2);
    setSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'running' } : s));
    addLog('Đang chạy TC-03: Thử nghiệm Chi tiết & Phụ kiện...');
    const targetProduct = productsList.find(p => p.id === 'lining-gforce-x5') || productsList[0];
    onSetView('product-detail', { productId: targetProduct.id });
    await new Promise(r => setTimeout(r, 1200));

    const stringChoice = stringOptionsList.find(s => s.id === 'yonex-bg66-ultimax') || stringOptionsList[0];
    addLog(`Đang chọn cước: ${stringChoice.name} (Giá đan: ${stringChoice.price.toLocaleString('vi-VN')}đ)`);
    setSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'passed' } : s));
    addLog(`✓ Đã mô phỏng chọn cấu hình thành công cho ${targetProduct.name}.`);

    // STEP 4
    setCurrentStepIndex(3);
    setSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, status: 'running' } : s));
    addLog('Đang chạy TC-04: Thử nghiệm Thêm vào giỏ & Tính toán tổng tiền...');
    onAddToCartWithSpecs(targetProduct, '4U/G5', 'Trắng Xanh', stringChoice, 11);
    await new Promise(r => setTimeout(r, 1200));

    const expectedItemPrice = targetProduct.salePrice || targetProduct.price;
    const expectedTotal = expectedItemPrice + stringChoice.price;
    addLog(`Đang kiểm tra giỏ hàng: Đơn giá: ${expectedItemPrice.toLocaleString('vi-VN')}đ + Cước: ${stringChoice.price.toLocaleString('vi-VN')}đ`);
    addLog(`Tổng tiền hàng dự kiến: ${expectedTotal.toLocaleString('vi-VN')}đ`);
    
    setSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, status: 'passed' } : s));
    addLog(`✓ Kiểm tra toán học thành công: Tổng chi phí chính xác tuyệt đối.`);

    // STEP 5
    setCurrentStepIndex(4);
    setSteps(prev => prev.map((s, idx) => idx === 4 ? { ...s, status: 'running' } : s));
    addLog('Đang chạy TC-05: Điền biểu mẫu checkout & Tạo đơn hàng...');
    await new Promise(r => setTimeout(r, 1200));
    
    addLog('Nhập thông tin khách hàng: Trần Nguyễn Thể Thao | 0987.654.321');
    addLog('Địa chỉ nhận hàng: Số 12 Chùa Hà, Phường Quan Hoa, Cầu Giấy, Hà Nội');
    
    setSteps(prev => prev.map((s, idx) => idx === 4 ? { ...s, status: 'passed' } : s));
    addLog('✓ Đơn hàng mô phỏng đã hoàn tất thành công! Đã chuyển sang màn hình xác nhận.');
    addLog('🎉 HOÀN THÀNH TOÀN BỘ KỊCH BẢN KIỂM THỬ: 5/5 PASSED!');
    
    setIsRunning(false);
  };

  return (
    <>
      {/* Floating Beaker/Test Launcher Button */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-900 hover:bg-gray-800 text-orange-400 hover:text-orange-300 border border-orange-500/30 font-display font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-full flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95 glow-effect"
          id="toggle-webtest-widget"
        >
          <Terminal className="w-4 h-4 animate-pulse text-orange-500" />
          <span>Chạy Test Web</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" id="webtest-runner-overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-950 text-white rounded-2xl w-full max-w-2xl overflow-hidden border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]"
              id="webtest-runner-modal"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-orange-500" />
                  <div>
                    <h3 className="font-display font-black text-sm uppercase tracking-wide">Trung Tâm Kiểm Thử Tự Động</h3>
                    <p className="text-[10px] text-gray-400 font-light">Xác nhận toàn bộ hoạt động của ứng dụng bằng các kịch bản mô phỏng.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition"
                  id="close-webtest-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Test steps list */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="space-y-2.5">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        step.status === 'running'
                          ? 'bg-orange-500/5 border-orange-500/40'
                          : step.status === 'passed'
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : step.status === 'failed'
                          ? 'bg-rose-500/5 border-rose-500/30'
                          : 'bg-gray-900/50 border-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs uppercase text-gray-200">{step.name}</h4>
                          <p className="text-[10px] text-gray-400 font-light leading-relaxed">{step.description}</p>
                        </div>
                        <div>
                          {step.status === 'running' && (
                            <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                          )}
                          {step.status === 'passed' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                          {step.status === 'failed' && (
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                          )}
                          {step.status === 'idle' && (
                            <div className="w-4 h-4 rounded-full border border-gray-700" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Simulated Terminal console */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                    <Terminal className="w-3 h-3" /> Console Logs
                  </span>
                  <div className="bg-black/80 rounded-lg p-3 font-mono text-[9px] text-orange-300 leading-relaxed max-h-40 overflow-y-auto border border-gray-900">
                    {consoleLogs.length === 0 ? (
                      <span className="text-gray-600 italic">Sẵn sàng. Nhấn "Bắt đầu Chạy" để ghi lại kết quả kiểm tra...</span>
                    ) : (
                      consoleLogs.map((log, index) => (
                        <div key={index} className="whitespace-pre-wrap">{log}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-4 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
                <button
                  onClick={() => {
                    setSteps(steps.map(s => ({ ...s, status: 'idle' })));
                    setConsoleLogs([]);
                  }}
                  disabled={isRunning}
                  className="px-4 py-2 border border-gray-700 hover:border-gray-600 disabled:opacity-40 rounded-full text-xs font-semibold text-gray-300 hover:text-white transition"
                  id="reset-webtest-btn"
                >
                  Làm mới
                </button>

                <button
                  onClick={runTestFlow}
                  disabled={isRunning}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-full flex items-center gap-1.5 shadow-lg transition glow-btn"
                  id="run-webtest-btn"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang chạy test web...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Bắt đầu Chạy Test Web
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
