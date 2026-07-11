import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductDetailPage from '../../components/ProductDetailPage';
import { addCartItem, buildConfiguredCartItem, openCart } from '../cart/cartSlice';
import { StringOption } from '../../types';
import { findProductBySlug } from '../../utils/productSlug';

export default function ProductDetailRoute() {
  const dispatch = useAppDispatch();
  const { slug } = useParams<{ slug: string }>();
  const products = useAppSelector(state => state.appData.products);
  const stringOptions = useAppSelector(state => state.appData.stringOptions);
  const product = findProductBySlug(products, slug);

  if (!product) return <div>Not Found</div>;

  const handleAddToCartWithSpecs = (
    targetProduct: (typeof products)[number],
    weight: string,
    color: string,
    stringChoice: StringOption | null,
    tension: number
  ) => {
    dispatch(addCartItem(buildConfiguredCartItem(targetProduct, weight, color, stringChoice, tension)));
    dispatch(openCart());
  };

  return (
    <ProductDetailPage
      product={product}
      stringOptions={stringOptions}
      onAddToCartWithSpecs={handleAddToCartWithSpecs}
    />
  );
}
