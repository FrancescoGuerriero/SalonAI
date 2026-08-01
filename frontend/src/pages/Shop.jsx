import { PackageOpen, Search, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import useCart from "../hooks/useCart.js";
import commerceService from "../services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  const image = product.images?.[0];

  if (!image || failed) {
    return (
      <div className="commerce-product-placeholder" aria-hidden="true">
        <PackageOpen size={42} />
      </div>
    );
  }

  return (
    <img
      className="commerce-product-image"
      src={image}
      alt={product.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function Shop() {
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const result = await commerceService.listProducts({
          search: search || undefined,
          category: category || undefined,
          sort,
          limit: 100,
        });
        if (active) {
          setProducts(result.items || []);
          setCategories(result.categories || []);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || "Products could not be loaded.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, category, sort]);

  const availableCount = useMemo(
    () => products.filter((product) => product.stockQuantity > 0).length,
    [products]
  );

  function handleAdd(product) {
    addItem(product, 1);
    setAddedId(product._id);
    setTimeout(() => setAddedId(""), 1200);
  }

  return (
    <main className="page commerce-page">
      <section className="commerce-hero">
        <div>
          <span className="commerce-eyebrow">Salon-quality haircare</span>
          <h1>Shop professional products</h1>
          <p>
            Discover curated haircare and styling products selected for healthy,
            manageable hair between appointments.
          </p>
        </div>
        <ShoppingBag size={58} aria-hidden="true" />
      </section>

      <CommerceTrustBar />

      <section className="commerce-toolbar" aria-label="Product filters">
        <label className="commerce-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products, brands or categories"
          />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="name">Name</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </section>

      <div className="commerce-results-summary">
        {loading ? "Loading products…" : `${products.length} products · ${availableCount} in stock`}
      </div>

      {error && <div className="error-message">{error}</div>}

      {!loading && !error && products.length === 0 && (
        <div className="empty-state">
          <h2>No products found</h2>
          <p>Change the search or category filter.</p>
        </div>
      )}

      <section className="commerce-product-grid" aria-live="polite">
        {products.map((product) => {
          const inStock = product.stockQuantity > 0;
          return (
            <article className="commerce-product-card" key={product._id}>
              <ProductImage product={product} />
              <div className="commerce-product-body">
                <div className="commerce-product-meta">
                  <span>{product.brand || "SalonAI"}</span>
                  <span>{product.category || "Haircare"}</span>
                </div>
                <h2>{product.name}</h2>
                <p>{product.description || "Professional salon haircare product."}</p>
                {product.size && <span className="commerce-size">{product.size}</span>}
                <div className="commerce-product-footer">
                  <div>
                    <strong>{formatCurrency(product.price)}</strong>
                    <span className={inStock ? "stock-ok" : "stock-out"}>
                      {inStock ? `${product.stockQuantity} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <button type="button" disabled={!inStock} onClick={() => handleAdd(product)}>
                    {addedId === product._id ? "Added" : "Add to cart"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
