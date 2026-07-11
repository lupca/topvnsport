import React from 'react';
import { ShieldCheck, Trophy } from 'lucide-react';

export default function TrustSealsPanel() {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
        <span>Cam kết chính hãng 100%</span>
      </div>
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-brand-primary shrink-0" />
        <span>Bảo hành lưới gãy 90 ngày</span>
      </div>
    </div>
  );
}
