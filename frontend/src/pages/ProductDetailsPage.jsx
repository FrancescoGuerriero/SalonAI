import {
  ArrowLeft,
  PackageOpen,
  ShoppingBag,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import Seo from "../components/Seo.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import useCart from "../hooks/useCart.js";
import commerceService from "../Services/commerceService.js";
import { formatCurrency } from "../utils/currency.js";

function ProductGallery({
  product,
}) {
  const images = useMemo(
    () =>
      Array.isArray(
        product?.images
      )
        ? product.images.filter(
            Boolean
          )
        : [],
    [product]
  );
  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0);
  const [
    failedImages,
    setFailedImages,
  ] = useState(
    () => new Set()
  );

  useEffect(() => {
    setSelectedIndex(0);
    setFailedImages(
      new Set()
    );
  }, [
    product?._id,
    product?.slug,
  ]);

  const availableImages =
    images.filter(
      (image) =>
        !failedImages.has(
          image
        )
    );

  const selectedImage =
    availableImages[
      Math.min(
        selectedIndex,
        Math.max(
          availableImages.length -
            1,
          0
        )
      )
    ];

  function markFailed(
    image
  ) {
    setFailedImages(
      (current) => {
        const next =
          new Set(current);
        next.add(image);
        return next;
      }
    );
    setSelectedIndex(0);
  }

  if (!selectedImage) {
    return (
      <div
        className="commerce-product-detail-placeholder"
        aria-hidden="true"
      >
        <PackageOpen
          size={72}
        />
      </div>
    );
  }

  return (
    <div className="commerce-product-gallery">
      <div className="commerce-product-gallery-main">
        <img
          className="commerce-product-detail-image"
          src={selectedImage}
          alt={`${product.name} product view ${Math.min(
            selectedIndex + 1,
            availableImages.length
          )}`}
          width="900"
          height="900"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={() =>
            markFailed(
              selectedImage
            )
          }
        />
      </div>

      {availableImages.length >
        1 && (
        <div
          className="commerce-product-thumbnails"
          aria-label={`${product.name} product images`}
        >
          {availableImages.map(
            (
              image,
              index
            ) => (
              <button
                key={image}
                type="button"
                className={
                  index ===
                  selectedIndex
                    ? "is-selected"
                    : ""
                }
                onClick={() =>
                  setSelectedIndex(
                    index
                  )
                }
                aria-label={`Show ${product.name} image ${index + 1}`}
                aria-pressed={
                  index ===
                  selectedIndex
                }
              >
                <img
                  src={image}
                  alt=""
                  width="160"
                  height="160"
                  loading="lazy"
                  decoding="async"
                  onError={() =>
                    markFailed(
                      image
                    )
                  }
                />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailsPage() {
  const {
    identifier,
  } = useParams();
  const {
    addItem,
  } = useCart();

  const [
    product,
    setProduct,
  ] = useState(null);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    added,
    setAdded,
  ] = useState(false);

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      try {
        setLoading(
          true
        );
        setError("");

        const result =
          await commerceService.getProduct(
            identifier,
            {
              signal:
                controller.signal,
            }
          );

        setProduct(
          result
        );
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
            "Product could not be loaded."
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

    void load();

    return () => {
      controller.abort();
    };
  }, [
    identifier,
  ]);

  if (loading) {
    return (
      <main className="page commerce-page">
        <section
          className="commerce-product-detail"
          aria-label="Loading product"
        >
          <Skeleton className="commerce-product-detail-skeleton-image" />

          <div className="commerce-product-detail-copy">
            <Skeleton className="commerce-product-detail-skeleton-meta" />
            <Skeleton className="commerce-product-detail-skeleton-title" />
            <Skeleton className="commerce-product-detail-skeleton-line" />
            <Skeleton className="commerce-product-detail-skeleton-line" />
            <Skeleton className="commerce-product-detail-skeleton-line commerce-product-detail-skeleton-line-short" />
            <Skeleton className="commerce-product-detail-skeleton-action" />
          </div>
        </section>
      </main>
    );
  }

  if (
    error ||
    !product
  ) {
    return (
      <main className="page">
        <div className="error-message">
          {error ||
            "Product was not found."}
        </div>
        <Link
          className="commerce-text-link"
          to="/shop"
        >
          Return to shop
        </Link>
      </main>
    );
  }

  const inStock =
    product.stockQuantity >
    0;

  function handleAdd() {
    addItem(
      product,
      1
    );
    setAdded(true);

    setTimeout(
      () =>
        setAdded(false),
      1200
    );
  }

  const detailDescription =
    product.officialDescription ||
    product.description ||
    "Professional salon haircare product.";

  return (
    <main className="page commerce-page">
      <Seo
        title={`${product.name} | SalonAI Shop`}
        description={
          product.description ||
          `${product.name} from the SalonAI professional haircare shop.`
        }
      />

      <Link
        className="commerce-back-link"
        to="/shop"
      >
        <ArrowLeft
          size={17}
        />
        Back to shop
      </Link>

      <section className="commerce-product-detail">
        <ProductGallery
          product={product}
        />

        <div className="commerce-product-detail-copy">
          <div className="commerce-product-meta">
            <span>
              {product.brand ||
                "SalonAI"}
            </span>
            <span>
              {product.category ||
                "Haircare"}
            </span>
          </div>

          <div className="commerce-product-labels">
            {product.collectionName && (
              <span>
                {
                  product.collectionName
                }
              </span>
            )}
            {product.badge && (
              <strong>
                {
                  product.badge
                }
              </strong>
            )}
          </div>

          <h1>
            {product.name}
          </h1>

          <p className="commerce-product-detail-description commerce-product-long-description">
            {
              detailDescription
            }
          </p>

          {product.size && (
            <p className="commerce-size">
              Size:{" "}
              {product.size}
            </p>
          )}

          <div className="commerce-product-detail-purchase">
            <strong>
              {formatCurrency(
                product.price
              )}
            </strong>

            <span
              className={
                inStock
                  ? "stock-ok"
                  : "stock-out"
              }
            >
              {inStock
                ? `${product.stockQuantity} in stock`
                : "Currently out of stock"}
            </span>

            <button
              type="button"
              disabled={!inStock}
              onClick={
                handleAdd
              }
            >
              <ShoppingBag
                size={18}
              />
              {added
                ? "Added to cart"
                : "Add to cart"}
            </button>
          </div>

          {!inStock && (
            <p className="commerce-stock-note">
              This product is
              in the SalonAI
              catalogue but
              cannot be
              purchased until
              verified salon
              stock is
              available.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
