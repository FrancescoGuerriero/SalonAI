import {
  Search,
  ShoppingBag,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import CommerceTrustBar from "../components/commerce/CommerceTrustBar.jsx";
import ProductCard, {
  ProductCardSkeleton,
} from "../components/commerce/ProductCard.jsx";
import useCart from "../hooks/useCart.js";
import commerceService from "../Services/commerceService.js";

export default function Shop() {
  const {
    addItem,
  } = useCart();

  const [
    products,
    setProducts,
  ] = useState([]);
  const [
    categories,
    setCategories,
  ] = useState([]);
  const [
    brands,
    setBrands,
  ] = useState([]);
  const [
    collections,
    setCollections,
  ] = useState([]);
  const [
    search,
    setSearch,
  ] = useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");
  const [
    category,
    setCategory,
  ] = useState("");
  const [
    brand,
    setBrand,
  ] = useState("");
  const [
    collection,
    setCollection,
  ] = useState("");
  const [
    sort,
    setSort,
  ] = useState("name");
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    addedId,
    setAddedId,
  ] = useState("");

  const facetsLoadedRef =
    useRef(
      false
    );

  useEffect(() => {
    if (
      !search
    ) {
      setDebouncedSearch(
        ""
      );
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            search.trim()
          );
        },
        180
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    search,
  ]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadProducts() {
      try {
        setLoading(
          true
        );
        setError("");

        const result =
          await commerceService.listProducts(
            {
              search:
                debouncedSearch ||
                undefined,
              category:
                category ||
                undefined,
              brand:
                brand ||
                undefined,
              collection:
                collection ||
                undefined,
              sort,
              limit: 100,
              facets:
                facetsLoadedRef
                  .current
                  ? "false"
                  : "true",
            },
            {
              signal:
                controller.signal,
            }
          );

        setProducts(
          result.items ||
            []
        );
        if (
          Array.isArray(
            result.categories
          ) &&
          Array.isArray(
            result.brands
          ) &&
          Array.isArray(
            result.collections
          )
        ) {
          setCategories(
            result.categories
          );
          setBrands(
            result.brands
          );
          setCollections(
            result.collections
          );
          facetsLoadedRef
            .current = true;
        }
      } catch (
        requestError
      ) {
        if (
          requestError?.code ===
            "ERR_CANCELED" ||
          requestError?.name ===
            "CanceledError"
        ) {
          return;
        }

        setError(
          requestError
            .response?.data
            ?.message ||
            "Products could not be loaded."
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [
    debouncedSearch,
    category,
    brand,
    collection,
    sort,
  ]);

  const availableCount =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.stockQuantity >
            0
        ).length,
      [products]
    );

  const davinesCount =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.brand ===
            "Davines"
        ).length,
      [products]
    );

  function handleAdd(
    product
  ) {
    addItem(product, 1);
    setAddedId(
      product._id
    );

    setTimeout(
      () =>
        setAddedId(""),
      1200
    );
  }

  return (
    <main className="page commerce-page">
      <section className="commerce-hero">
        <div>
          <span className="commerce-eyebrow">
            Salon-quality
            haircare
          </span>
          <h1>
            Shop professional
            products
          </h1>
          <p>
            Discover curated
            haircare and styling
            products selected for
            healthy, manageable
            hair between
            appointments.
          </p>
        </div>
        <ShoppingBag
          size={58}
          aria-hidden="true"
        />
      </section>

      {davinesCount > 0 && (
        <section className="commerce-collection-callout">
          <div>
            <span className="commerce-eyebrow">
              Featured retail
              collection
            </span>
            <h2>
              Davines Summer
              Favourites
            </h2>
            <p>
              A seasonal edit of
              Davines haircare,
              styling, sun-care and
              travel products.
            </p>
          </div>
          <button
            type="button"
            className="commerce-secondary-button"
            onClick={() => {
              setBrand(
                "Davines"
              );
              setCollection(
                "Summer Favourites"
              );
            }}
          >
            Browse Davines
          </button>
        </section>
      )}

      <CommerceTrustBar />

      <section
        className="commerce-toolbar"
        aria-label="Product filters"
      >
        <label className="commerce-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="Search products, brands or categories"
          />
        </label>

        <select
          value={brand}
          onChange={(
            event
          ) =>
            setBrand(
              event.target
                .value
            )
          }
          aria-label="Brand"
        >
          <option value="">
            All brands
          </option>
          {brands.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          value={collection}
          onChange={(
            event
          ) =>
            setCollection(
              event.target
                .value
            )
          }
          aria-label="Collection"
        >
          <option value="">
            All collections
          </option>
          {collections.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          value={category}
          onChange={(
            event
          ) =>
            setCategory(
              event.target
                .value
            )
          }
          aria-label="Category"
        >
          <option value="">
            All categories
          </option>
          {categories.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <select
          value={sort}
          onChange={(
            event
          ) =>
            setSort(
              event.target
                .value
            )
          }
          aria-label="Sort products"
        >
          <option value="name">
            Name
          </option>
          <option value="newest">
            Newest
          </option>
          <option value="price_asc">
            Price: low to high
          </option>
          <option value="price_desc">
            Price: high to low
          </option>
        </select>
      </section>

      <div
        className="commerce-results-summary"
        role="status"
      >
        {loading &&
        products.length === 0
          ? "Loading products…"
          : loading
            ? "Updating products…"
            : `${products.length} products · ${availableCount} in stock`}
      </div>

      {error ? (
        <div className="error-message">
          {error}
        </div>
      ) : null}

      {!loading &&
      !error &&
      products.length ===
        0 ? (
        <div className="empty-state">
          <h2>
            No products found
          </h2>
          <p>
            Change the search,
            brand, collection or
            category filter.
          </p>
        </div>
      ) : null}

      {loading &&
      products.length ===
        0 ? (
        <section
          className="commerce-product-grid"
          aria-label="Loading products"
        >
          {Array.from({
            length: 8,
          }).map(
            (_, index) => (
              <ProductCardSkeleton
                key={
                  index
                }
              />
            )
          )}
        </section>
      ) : null}

      {products.length >
      0 ? (
        <section
          className="commerce-product-grid"
          aria-live="polite"
          aria-busy={
            loading
          }
        >
          {products.map(
            (
              product,
              index
            ) => (
              <ProductCard
                key={
                  product._id
                }
                product={
                  product
                }
                onAdd={
                  handleAdd
                }
                added={
                  addedId ===
                  product._id
                }
                priority={
                  index < 4
                }
              />
            )
          )}
        </section>
      ) : null}
    </main>
  );
}
