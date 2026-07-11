import { useParams } from 'react-router-dom';
import ProductDetailPage from '../../components/ProductDetailPage';
import { Product, StringOption } from '../../types';

type ProductDetailRouteProps = {
  products: Product[];
  stringOptions: StringOption[];
  onAddToCartWithSpecs: (product: Product, weight: string, color: string, stringChoice: StringOption | null, tension: number) => void;
};

export default function ProductDetailRoute({ products, stringOptions, onAddToCartWithSpecs }: ProductDetailRouteProps) {
  const { id } = useParams<{ id: string }>();
  const product = products.find(p => p.id === id) || products[0];

  if (!product) return <div>Not Found</div>;

  return (
    <ProductDetailPage
      product={product}
      stringOptions={stringOptions}
      onAddToCartWithSpecs={onAddToCartWithSpecs}
    />
  );
}
