import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  seoForPath,
} from "../../config/seoRoutes.js";

function ensureMeta(name, content) {
  let node = document.head.querySelector(
    `meta[name="${name}"]`
  );

  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("name", name);
    document.head.appendChild(node);
  }

  node.setAttribute("content", content);
}

function ensureCanonical(href) {
  let node = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }

  node.setAttribute("href", href);
}

function announcementTitle(seo) {
  return String(seo.title || "SalonAI")
    .split("|")[0]
    .trim();
}

export default function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const seo = seoForPath(location.pathname);
    const title = announcementTitle(seo);

    document.title = seo.title;
    ensureMeta("description", seo.description);
    ensureMeta("robots", seo.robots);
    ensureCanonical(seo.canonical);
    setMessage(`${title} page loaded`);

    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="route-announcer" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
