import React, { useEffect, useState } from 'react';
import { Product, StringOption } from '../types';
import ProductMediaGallery from './ProductMediaGallery';
import TrustSealsPanel from './TrustSealsPanel';
import ProductPurchaseSection from './product-detail/ProductPurchaseSection';
import ProductDetailTabs, { DetailTab } from './product-detail/ProductDetailTabs';
import MobilePurchaseBar from './product-detail/MobilePurchaseBar';
import { isNoStringOption } from './product-detail/helpers';

interface ProductDetailPageProps {
  product: Product;
  stringOptions: StringOption[];
  onAddToCartWithSpecs: (product: Product, selectedWeight: string, selectedColor: string, stringChoice: StringOption | null, tension: number) => void;
  onBackToCatalog: () => void;
  
}

export default function ProductDetailPage({ product, stringOptions, onAddToCartWithSpecs }: Omit<ProductDetailPageProps, 'onBackToCatalog'|'onBookTestAtStore'>) {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [selectedWeight, setSelectedWeight] = useState(
    product.category === 'Vợt' ? '4U/G5' : 'Tiêu chuẩn'
  );
  const [selectedColor, setSelectedColor] = useState(
    product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn'
  );

  const [selectedTier1, setSelectedTier1] = useState<string>(() => {
    const t1 = product.tier_variations?.find(tv => tv.tier_index === 1);
    return t1 && t1.options.length > 0 ? t1.options[0] : '';
  });
  const [selectedTier2, setSelectedTier2] = useState<string>(() => {
    const t2 = product.tier_variations?.find(tv => tv.tier_index === 2);
    return t2 && t2.options.length > 0 ? t2.options[0] : '';
  });

  const stringingVariation = product.tier_variations?.find(
    (tv) => tv.name === 'Loại cước'
  );
  const hasStringingVariation = !!stringingVariation;
  const stringingTierIndex = stringingVariation?.tier_index;

  const activeStringValue = stringingTierIndex === 1 ? selectedTier1 : selectedTier2;
  const isDynamicStringingActive = hasStringingVariation && !isNoStringOption(activeStringValue);

  const [withStringing, setWithStringing] = useState(false);
  const [selectedString, setSelectedString] = useState<StringOption | null>(null);
  const [tension, setTension] = useState(10.5);
  const isRacket = product.category === 'Vợt';

  useEffect(() => {
    const t1 = product.tier_variations?.find(tv => tv.tier_index === 1);
    setSelectedTier1(t1 && t1.options.length > 0 ? t1.options[0] : '');

    const t2 = product.tier_variations?.find(tv => tv.tier_index === 2);
    setSelectedTier2(t2 && t2.options.length > 0 ? t2.options[0] : '');

    setWithStringing(false);
    setSelectedString(null);
    setTension(10.5);
  }, [product]);

  const matchedVariant = product.variants?.find((v) => {
    const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === selectedTier1;
    const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === selectedTier2;
    return t1Match && t2Match;
  });

  const displayBasePrice = matchedVariant ? matchedVariant.price : (product.salePrice || product.price);
  const stringPrice = (!hasStringingVariation && withStringing && selectedString) ? selectedString.price : 0;
  const totalDisplayPrice = displayBasePrice + stringPrice;
  const displayOriginalPrice = displayBasePrice * (product.price / (product.salePrice || product.price));

  const resolvedColor = product.tier_variations && product.tier_variations.length > 0
    ? selectedTier1
    : selectedColor;

  const resolvedWeight = product.tier_variations && product.tier_variations.length > 0
    ? selectedTier2
    : selectedWeight;

  const resolvedStringChoice = hasStringingVariation
    ? (isDynamicStringingActive ? {
        id: activeStringValue,
        name: activeStringValue,
        brand: product.brand as any,
        type: 'Trợ lực / Âm thanh' as any,
        thickness: '0.65mm',
        price: 0,
        colors: []
      } : null)
    : (withStringing ? selectedString : null);

  const handleAddToCart = () => {
    onAddToCartWithSpecs(product, resolvedWeight, resolvedColor, resolvedStringChoice, tension);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 animate-in fade-in duration-300" id="product-detail-page">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <ProductMediaGallery
            productName={product.name}
            image={product.image}
            gallery={product.gallery}
          />

          <TrustSealsPanel />
        </div>

        <div className="lg:col-span-7">
          <ProductPurchaseSection
            product={product}
            isRacket={isRacket}
            totalDisplayPrice={totalDisplayPrice}
            displayOriginalPrice={displayOriginalPrice}
            stringPrice={stringPrice}
            selectedTier1={selectedTier1}
            selectedTier2={selectedTier2}
            selectedWeight={selectedWeight}
            selectedColor={selectedColor}
            withStringing={withStringing}
            selectedString={selectedString}
            tension={tension}
            stringOptions={stringOptions}
            hasStringingVariation={hasStringingVariation}
            stringingVariation={stringingVariation}
            stringingTierIndex={stringingTierIndex}
            isDynamicStringingActive={isDynamicStringingActive}
            activeStringValue={activeStringValue}
            onSetSelectedTier1={setSelectedTier1}
            onSetSelectedTier2={setSelectedTier2}
            onSetSelectedWeight={setSelectedWeight}
            onSetSelectedColor={setSelectedColor}
            onSetWithStringing={setWithStringing}
            onSetSelectedString={setSelectedString}
            onSetTension={setTension}
            onAddToCart={handleAddToCart}
          />
        </div>
      </div>

      <ProductDetailTabs
        product={product}
        isRacket={isRacket}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <MobilePurchaseBar
        productName={product.name}
        productImage={product.image}
        totalDisplayPrice={totalDisplayPrice}
        onBuyNow={handleAddToCart}
      />

    </div>
  );
}
