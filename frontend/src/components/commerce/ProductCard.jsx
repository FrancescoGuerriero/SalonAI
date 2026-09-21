import {
  PackageOpen,
} from "lucide-react";
import {
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import Skeleton from "../ui/Skeleton.jsx";
import {
  formatCurrency,
} from "../../utils/currency.js";

function ProductImage({
  product,
  priority = false,
}) {
  const [
    failed,
    setFailed,
  ] = useState(false);

  const image =
    product.images?.[0];

  if (
    !image ||
    failed
  ) {
    return (
      <div
        className="commerce-product-placeholder"
        aria-hidden="true"
      >
        <PackageOpen
          size={42}
        />
      </div>
    );
  }

  return (
    <img
      className="commerce-product-image"
      src={image}
      alt={product.name}
      width="640"
      height="470"
      loading={
        priority
          ? "eager"
          : "lazy"
      }
      fetchPriority={
        priority
          ? "high"
          : "auto"
      }
      decoding="async"
      onError={() =>
        setFailed(true)
      }
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <article
      className="commerce-product-card commerce-product-card-skeleton"
      aria-hidden="true"
    >
      <Skeleton className="commerce-product-skeleton-media" />

      <div className="commerce-product-body">
        <div className="commerce-product-meta">
          <Skeleton className="commerce-product-skeleton-meta" />
          <Skeleton className="commerce-product-skeleton-meta commerce-product-skeleton-meta-short" />
        </div>

        <div className="commerce-product-copy">
          <Skeleton className="commerce-product-skeleton-title" />
          <Skeleton className="commerce-product-skeleton-line" />
          <Skeleton className="commerce-product-skeleton-line commerce-product-skeleton-line-short" />
        </div>

        <div className="commerce-product-footer">
          <div>
            <Skeleton className="commerce-product-skeleton-price" />
            <Skeleton className="commerce-product-skeleton-stock" />
          </div>

          <div className="commerce-card-actions">
            <Skeleton className="commerce-product-skeleton-action" />
            <Skeleton className="commerce-product-skeleton-action commerce-product-skeleton-action-wide" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ProductCard({
  product,
  onAdd,
  added = false,
  priority = false,
}) {
  const inStock =
    product.stockQuantity >
    0;

  return (
    <article className="commerce-product-card">
      <Link
        className="commerce-product-media-link"
        to={`/shop/${product.slug}`}
        aria-label={`View ${product.name}`}
      >
        <ProductImage
          product={
            product
          }
          priority={
            priority
          }
        />
      </Link>

      <div className="commerce-product-body">
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

        {(
          product.collectionName ||
          product.badge
        ) ? (
          <div className="commerce-product-labels">
            {product.collectionName ? (
              <span>
                {product.collectionName}
              </span>
            ) : null}

            {product.badge ? (
              <strong>
                {product.badge}
              </strong>
            ) : null}
          </div>
        ) : null}

        <div className="commerce-product-copy">
          <h2>
            <Link
              className="commerce-product-title-link"
              to={`/shop/${product.slug}`}
            >
              {product.name}
            </Link>
          </h2>

          <p>
            {product.description ||
              "Professional salon haircare product."}
          </p>

          {product.size ? (
            <span className="commerce-size">
              {product.size}
            </span>
          ) : null}
        </div>

        <div className="commerce-product-footer">
          <div>
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
                : "Out of stock"}
            </span>
          </div>

          <div className="commerce-card-actions">
            <Link
              className="commerce-details-link"
              to={`/shop/${product.slug}`}
            >
              Details
            </Link>

            <button
              type="button"
              disabled={
                !inStock
              }
              onClick={() =>
                onAdd(
                  product
                )
              }
            >
              {added
                ? "Added"
                : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
