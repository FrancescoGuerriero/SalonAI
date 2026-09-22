import {
  useEffect,
} from "react";
import {
  useLocation,
} from "react-router-dom";

import {
  seoForPath,
} from "../../config/seoRoutes.js";

function ensureMeta(
  name,
  content
) {
  let node =
    document.head.querySelector(
      `meta[name="${name}"]`
    );

  if (!node) {
    node =
      document.createElement(
        "meta"
      );
    node.setAttribute(
      "name",
      name
    );
    document.head.appendChild(
      node
    );
  }

  node.setAttribute(
    "content",
    content
  );
}

function ensureCanonical(
  href
) {
  let node =
    document.head.querySelector(
      'link[rel="canonical"]'
    );

  if (!node) {
    node =
      document.createElement(
        "link"
      );
    node.setAttribute(
      "rel",
      "canonical"
    );
    document.head.appendChild(
      node
    );
  }

  node.setAttribute(
    "href",
    href
  );
}

export default function SeoRouteHead() {
  const location =
    useLocation();

  useEffect(() => {
    const seo =
      seoForPath(
        location.pathname
      );

    document.title =
      seo.title;

    ensureMeta(
      "description",
      seo.description
    );
    ensureMeta(
      "robots",
      seo.robots
    );
    ensureCanonical(
      seo.canonical
    );
  }, [location.pathname]);

  return null;
}
