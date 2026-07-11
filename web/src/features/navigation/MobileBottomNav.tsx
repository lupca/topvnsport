import { Home, MapPin, ShoppingBag, Sparkles, Trophy } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

type MobileBottomNavProps = {
  pathname: string;
  navigate: NavigateFunction;
  cartCount: number;
  onOpenCart: () => void;
};

export default function MobileBottomNav({ pathname, navigate, cartCount, onOpenCart }: MobileBottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex justify-around items-center py-2 px-2 shadow-sm rounded-t-2xl">
      <button
        onClick={() => navigate('/')}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Trang chủ</span>
      </button>

      <button
        onClick={() => navigate('/catalog')}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/catalog' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
      >
        <Trophy className="w-5 h-5" />
        <span className="text-[10px]">Sản phẩm</span>
      </button>

      <button
        onClick={() => {
          navigate('/');
          setTimeout(() => {
            const el = document.getElementById('racket-finder-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
        className="flex flex-col items-center gap-1 p-1 text-gray-400 hover:text-brand-primary transition"
      >
        <Sparkles className="w-5 h-5 text-brand-primary " />
        <span className="text-[10px] text-brand-primary font-medium">Chọn vợt AI</span>
      </button>

      <button
        onClick={() => navigate('/stores')}
        className={`flex flex-col items-center gap-1 p-1 transition ${pathname === '/stores' ? 'text-brand-primary font-bold' : 'text-gray-400'}`}
      >
        <MapPin className="w-5 h-5" />
        <span className="text-[10px]">Cửa hàng</span>
      </button>

      <button
        onClick={onOpenCart}
        className="flex flex-col items-center gap-1 p-1 text-gray-400 hover:text-brand-primary transition relative"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 text-gray-500" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">Giỏ hàng</span>
      </button>
    </div>
  );
}
