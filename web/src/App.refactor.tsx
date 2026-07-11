/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import BlogSection from './components/BlogSection';
import CartModal, { CartItem } from './components/CartModal';
import Footer from './components/Footer';
import Header from './components/Header';
import QuickViewModal from './components/QuickViewModal';
import ScrollToTop from './components/ScrollToTop';
import StoreLocator from './components/StoreLocator';
import CatalogPage from './features/catalog/CatalogPage';
import HomePage from './features/home/HomePage';
import MobileBottomNav from './features/navigation/MobileBottomNav';
import ProductDetailRoute from './features/product/ProductDetailRoute';
import { sportApi } from './services/sportApi';
import { Blog, Branch, Category, Product, StringOption } from './types';
import { getProductCategoryCounts, getTopLevelProductCategories } from './utils/categories';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stringOptions, setStringOptions] = useState<StringOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [maxPrice, setMaxPrice] = useState<number>(6000000);
  const [selectedWeight, setSelectedWeight] = useState<string[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<string>('Tất cả');
  const [selectedStiffness, setSelectedStiffness] = useState<string>('Tất cả');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 45, seconds: 30 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [prodList, blogList, branchList, stringList] = await Promise.all([
          sportApi.getProducts(),
          sportApi.getBlogs(),
          sportApi.getBranches(),
          sportApi.getStringOptions()
        ]);
        const categoryList = await sportApi.getCategories();
        if (isMounted) {
          setProducts(prodList);
          setBlogs(blogList);
          setBranches(branchList);
          setStringOptions(stringList);
          setCategories(categoryList);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch data from sportApi:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/catalog') return;

    const categoryParam = searchParams.get('category');
    setSelectedCategory(categoryParam ? decodeURIComponent(categoryParam) : 'Tất cả');
  }, [location.pathname, searchParams]);

  const resolveSkuCode = (product: Product, color: string, weight: string) => {
    const colorSku = product.skuByColor?.[color];
    if (colorSku) return colorSku;

    const byVariant = product.skuByVariant?.[`${color}||${weight}`];
    if (byVariant) return byVariant;

    return product.defaultSku || `SKU-${product.id}-${weight.replace(/\//g, '-')}-${color.replace(/\//g, '-')}`;
  };

  const handleAddToCart = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      skuCode: resolveSkuCode(
        product,
        product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn',
        product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn'
      ),
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.salePrice || product.price,
      selectedWeight: product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn',
      selectedColor: product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn',
      stringOption: null,
      tension: 10.5,
      quantity: 1
    };

    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);
  };

  const handleAddToCartWithSpecs = (
    product: Product,
    weight: string,
    color: string,
    stringChoice: StringOption | null,
    tension: number
  ) => {
    const newItem: CartItem = {
      id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${Date.now()}`,
      productId: product.id,
      skuCode: resolveSkuCode(product, color, weight),
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.salePrice || product.price,
      selectedWeight: weight,
      selectedColor: color,
      stringOption: stringChoice,
      tension,
      quantity: 1
    };

    setCartItems(prev => [...prev, newItem]);
    setIsCartOpen(true);
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => setCartItems([]);

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'Tất cả' && p.category !== selectedCategory) return false;
    if (selectedBrand.length > 0 && !selectedBrand.includes(p.brand)) return false;

    const displayPrice = p.salePrice || p.price;
    if (displayPrice > maxPrice) return false;

    if (selectedWeight.length > 0 && p.category === 'Vợt') {
      const match = selectedWeight.some(wt => p.specs.weight.includes(wt));
      if (!match) return false;
    }

    if (selectedBalance !== 'Tất cả' && p.category === 'Vợt') {
      if (selectedBalance === 'nặng' && p.specs.balance < 298) return false;
      if (selectedBalance === 'nhẹ' && p.specs.balance > 288) return false;
      if (selectedBalance === 'cân bằng' && (p.specs.balance < 288 || p.specs.balance >= 298)) return false;
    }

    if (selectedStiffness !== 'Tất cả' && p.category === 'Vợt') {
      const pStiff = p.specs.stiffness.toLowerCase();
      if (selectedStiffness === 'cứng' && !pStiff.includes('cứng')) return false;
      if (selectedStiffness === 'dẻo' && !pStiff.includes('dẻo')) return false;
      if (selectedStiffness === 'trung bình' && !pStiff.includes('trung bình')) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = p.brand.toLowerCase().includes(q);
      const matchSeries = p.series && p.series.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSeries) return false;
    }

    return true;
  });

  const resetFilters = () => {
    setSelectedBrand([]);
    setSelectedCategory('Tất cả');
    setMaxPrice(6000000);
    setSelectedWeight([]);
    setSelectedBalance('Tất cả');
    setSelectedStiffness('Tất cả');
    setSearchQuery('');
  };

  const topLevelCategories = getTopLevelProductCategories(categories);
  const categoryCounts = getProductCategoryCounts(products);
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans antialiased" id="api-loading-state">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="relative inline-flex">
            <span className="absolute inline-flex h-12 w-12 rounded-full bg-brand-primary opacity-20 animate-ping"></span>
            <div className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-center  duration-1000">
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
        openCart={() => setIsCartOpen(true)}
        products={products}
        categories={categories}
      />

      <main className="flex-1">
        <ScrollToTop />
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                navigate={navigate}
                products={products}
                blogs={blogs}
                topLevelCategories={topLevelCategories}
                categoryCounts={categoryCounts}
                timeLeft={timeLeft}
                onQuickView={setQuickViewProduct}
                onAddToCart={handleAddToCart}
              />
            }
          />

          <Route
            path="/catalog"
            element={
              <CatalogPage
                products={products}
                filteredProducts={filteredProducts}
                searchQuery={searchQuery}
                selectedBrand={selectedBrand}
                selectedCategory={selectedCategory}
                maxPrice={maxPrice}
                selectedWeight={selectedWeight}
                selectedBalance={selectedBalance}
                selectedStiffness={selectedStiffness}
                onSearchQueryChange={setSearchQuery}
                onSelectedCategoryChange={setSelectedCategory}
                onSelectedBalanceChange={setSelectedBalance}
                onSelectedStiffnessChange={setSelectedStiffness}
                onSelectedWeightChange={setSelectedWeight}
                onSelectedBrandChange={setSelectedBrand}
                onMaxPriceChange={setMaxPrice}
                onResetFilters={resetFilters}
                onQuickView={setQuickViewProduct}
                onAddToCart={handleAddToCart}
              />
            }
          />

          <Route
            path="/product/:id"
            element={
              <ProductDetailRoute
                products={products}
                stringOptions={stringOptions}
                onAddToCartWithSpecs={handleAddToCartWithSpecs}
              />
            }
          />

          <Route path="/blog/*" element={<BlogSection blogs={blogs} />} />
          <Route path="/stores" element={<StoreLocator branches={branches} products={products} />} />
        </Routes>
      </main>

      <Footer categories={categories} />

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
      />

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <MobileBottomNav
        pathname={location.pathname}
        navigate={navigate}
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
      />
    </div>
  );
}
