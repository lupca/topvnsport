/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MouseEvent, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import BlogSection from './components/BlogSection';
import CartModal from './components/CartModal';
import Footer from './components/Footer';
import Header from './components/Header';
import QuickViewModal from './components/QuickViewModal';
import ScrollToTop from './components/ScrollToTop';
import StoreLocator from './components/StoreLocator';
import { fetchAppData } from './features/appData/appDataSlice';
import CatalogPage from './features/catalog/CatalogPage';
import { setSelectedCategory } from './features/catalog/catalogSlice';
import {
  addCartItem,
  buildDefaultCartItem,
  clearCart,
  closeCart,
  openCart,
  removeCartItem,
  setQuickViewProduct
} from './features/cart/cartSlice';
import HomePage from './features/home/HomePage';
import MobileBottomNav from './features/navigation/MobileBottomNav';
import ProductDetailRoute from './features/product/ProductDetailRoute';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  const { products, blogs, branches, categories, isLoading } = useAppSelector(state => state.appData);
  const { items: cartItems, isOpen: isCartOpen, quickViewProduct } = useAppSelector(state => state.cart);
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  useEffect(() => {
    dispatch(fetchAppData()).catch(error => {
      console.error('Failed to fetch data from sportApi:', error);
    });
  }, [dispatch]);

  useEffect(() => {
    if (location.pathname !== '/catalog') return;

    const categoryParam = searchParams.get('category');
    dispatch(setSelectedCategory(categoryParam ? decodeURIComponent(categoryParam) : 'Tất cả'));
  }, [dispatch, location.pathname, searchParams]);

  const handleAddToCart = (product: (typeof products)[number], e?: MouseEvent) => {
    if (e) e.stopPropagation();
    dispatch(addCartItem(buildDefaultCartItem(product)));
    dispatch(openCart());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans antialiased" id="api-loading-state">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="relative inline-flex">
            <span className="absolute inline-flex h-12 w-12 rounded-full bg-brand-primary opacity-20 animate-ping"></span>
            <div className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-center duration-1000">
              <RefreshCw className="w-8 h-8 text-brand-primary animate-spin text-center" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display font-black text-gray-900 text-lg uppercase tracking-wider">TopVNSport API</h3>
            <p className="text-xs text-gray-500 font-medium">Đang tải đồng bộ cơ sở dữ liệu thiết bị cầu lông & O2O chi nhánh...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-brand-primary selection:text-white antialiased pb-16 md:pb-0">
      <Header
        cartCount={cartCount}
        openCart={() => dispatch(openCart())}
        products={products}
        categories={categories}
      />

      <main className="flex-1">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:slug" element={<ProductDetailRoute />} />
          <Route path="/blog/*" element={<BlogSection blogs={blogs} />} />
          <Route path="/stores" element={<StoreLocator branches={branches} products={products} />} />
        </Routes>
      </main>

      <Footer categories={categories} />

      <CartModal
        isOpen={isCartOpen}
        onClose={() => dispatch(closeCart())}
        cartItems={cartItems}
        onRemoveItem={id => dispatch(removeCartItem(id))}
        onClearCart={() => dispatch(clearCart())}
      />

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => dispatch(setQuickViewProduct(null))}
        onAddToCart={handleAddToCart}
      />

      <MobileBottomNav
        pathname={location.pathname}
        navigate={navigate}
        cartCount={cartCount}
        onOpenCart={() => dispatch(openCart())}
      />
    </div>
  );
}
