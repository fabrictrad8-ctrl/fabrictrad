import {Image, Money} from '@shopify/hydrogen';
import {Form, Link} from 'react-router';
import '~/styles/fabrictrad-home.css';

type HomeProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  featuredImage?: {
    id?: string;
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
};

const categories = [
  ['Cotton', 'Everyday, shirting & home textiles'],
  ['Silk', 'Premium occasion fabrics'],
  ['Linen', 'Breathable natural fabrics'],
  ['Denim', 'Fashion & workwear'],
  ['Knits', 'Stretch, jersey & performance'],
  ['Printed', 'Digital, block & screen prints'],
];

export function FabricTradHome({products}: {products: HomeProduct[]}) {
  return (
    <main className="ft-shell">
      <section className="ft-hero" aria-labelledby="ft-hero-title">
        <div className="ft-hero-copy">
          <p className="ft-eyebrow">India’s textile marketplace</p>
          <h1 id="ft-hero-title">Source better fabric. Sell with less friction.</h1>
          <p className="ft-hero-subtitle">
            Retail pieces, wholesale metres and verified business sourcing in one
            marketplace built for textile buyers and sellers.
          </p>

          <Form method="get" action="/search" className="ft-search" role="search">
            <label className="ft-sr-only" htmlFor="fabric-search">
              Search FabricTrad
            </label>
            <input
              id="fabric-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search cotton, silk, linen, seller, colour…"
            />
            <button type="submit">Search</button>
          </Form>

          <div className="ft-hero-actions">
            <Link className="ft-primary" to="/collections">
              Explore marketplace
            </Link>
            <Link className="ft-secondary" to="/account">
              Buy or sell
            </Link>
          </div>

          <ul className="ft-trust-row" aria-label="Marketplace benefits">
            <li>Verified business sellers</li>
            <li>Retail + wholesale</li>
            <li>Secure Shopify checkout</li>
            <li>Tracked fulfilment</li>
          </ul>
        </div>

        <aside className="ft-hero-panel" aria-label="FabricTrad business tools">
          <span className="ft-panel-badge">Built for textile trade</span>
          <h2>One account. Buy and sell.</h2>
          <p>
            Move between sourcing and selling without re-registering. Business
            verification, catalog tools and order operations stay role-aware.
          </p>
          <div className="ft-stat-grid">
            <div><strong>B2C</strong><span>Single-piece buying</span></div>
            <div><strong>B2B</strong><span>MOQ & bulk pricing</span></div>
            <div><strong>AI</strong><span>Drape & catalog help</span></div>
            <div><strong>Ops</strong><span>Payments & shipping</span></div>
          </div>
        </aside>
      </section>

      <section className="ft-section" aria-labelledby="ft-category-title">
        <div className="ft-section-head">
          <div>
            <p className="ft-eyebrow">Shop by need</p>
            <h2 id="ft-category-title">Find the right fabric faster</h2>
          </div>
          <Link to="/collections">View all categories →</Link>
        </div>
        <div className="ft-category-grid">
          {categories.map(([name, copy]) => (
            <Link key={name} to={`/search?q=${encodeURIComponent(name)}`} className="ft-category-card">
              <span className="ft-category-mark" aria-hidden="true">{name.slice(0, 1)}</span>
              <span><strong>{name}</strong><small>{copy}</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ft-section" aria-labelledby="ft-new-title">
        <div className="ft-section-head">
          <div>
            <p className="ft-eyebrow">Fresh catalog</p>
            <h2 id="ft-new-title">Recently updated fabrics</h2>
          </div>
          <Link to="/collections/all">Browse all →</Link>
        </div>
        <div className="ft-product-grid">
          {products.map((product) => (
            <Link key={product.id} to={`/products/${product.handle}`} className="ft-product-card">
              <div className="ft-product-media">
                {product.featuredImage ? (
                  <Image
                    data={product.featuredImage}
                    sizes="(min-width: 1000px) 22vw, (min-width: 640px) 45vw, 92vw"
                    loading="lazy"
                  />
                ) : (
                  <div className="ft-product-placeholder">FabricTrad</div>
                )}
              </div>
              <div className="ft-product-copy">
                <small>{product.vendor || 'FabricTrad seller'}</small>
                <h3>{product.title}</h3>
                <p><span>From </span><Money data={product.priceRange.minVariantPrice} /></p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="ft-role-band" aria-labelledby="ft-role-title">
        <div>
          <p className="ft-eyebrow">Marketplace tools</p>
          <h2 id="ft-role-title">The storefront stays simple. The operations stay powerful.</h2>
        </div>
        <div className="ft-role-cards">
          <article><strong>For buyers</strong><span>Search, compare, cart, checkout, track and reorder.</span></article>
          <article><strong>For stores</strong><span>Business verification, wholesale pricing and repeat sourcing.</span></article>
          <article><strong>For sellers</strong><span>Variants, stock, media, orders, returns and fulfilment.</span></article>
        </div>
      </section>
    </main>
  );
}
