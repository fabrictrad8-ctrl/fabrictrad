import {useLoaderData} from 'react-router';
import type {Route} from './+types/_index';
import {FabricTradHome} from '~/components/FabricTradHome';

export const meta: Route.MetaFunction = () => [
  {title: 'FabricTrad | India’s textile marketplace'},
  {
    name: 'description',
    content:
      'Discover fabrics, source from verified sellers, manage business buying and sell textiles through FabricTrad.',
  },
];

export async function loader({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const {products} = await storefront.query(HOME_PRODUCTS_QUERY, {
    variables: {first: 8},
  });

  return {products: products.nodes};
}

export default function Homepage() {
  const {products} = useLoaderData<typeof loader>();
  return <FabricTradHome products={products} />;
}

const HOME_PRODUCTS_QUERY = `#graphql
  query FabricTradHomeProducts($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        vendor
        featuredImage {
          id
          url
          altText
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;
