import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import customerExperienceService from "../Services/customerExperienceService.js";

function ContentBlock({ block }) {
  if (block.type === "heading") {
    const Tag = block.level === 3 ? "h3" : block.level === 4 ? "h4" : "h2";
    return <Tag>{block.text}</Tag>;
  }
  if (block.type === "paragraph") return <p>{block.text}</p>;
  if (block.type === "image") {
    const srcSet = (block.media?.variants || []).map((variant) => `${variant.url} ${variant.width}w`).join(", ");
    return <img src={block.media?.url} srcSet={srcSet || undefined} alt={block.media?.alt || ""} width={block.media?.width || undefined} height={block.media?.height || undefined} loading="lazy" />;
  }
  if (block.type === "call_to_action") {
    return block.href?.startsWith("/") ? <Link className="customer-primary-link" to={block.href}>{block.label}</Link> : <a className="customer-primary-link" href={block.href}>{block.label}</a>;
  }
  return null;
}

export default function CmsPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    customerExperienceService.getPublishedContentPage(slug, searchParams.get("locale") || undefined)
      .then((result) => { if (active) setPage(result.page); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "This content is unavailable."); });
    return () => { active = false; };
  }, [slug, searchParams]);

  useEffect(() => {
    if (!page) return;
    document.title = page.seoTitle || page.title || "SalonAI";
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = page.seoDescription || page.summary || "";
  }, [page]);

  if (error) return <main className="customer-page"><div className="customer-page-container"><div className="experience-message is-error" role="alert">{error}</div></div></main>;
  if (!page) return <main className="customer-page"><div className="customer-page-container"><p>Loading content…</p></div></main>;

  return <main className="customer-page" id="main-content" tabIndex="-1"><article className="customer-page-container"><header className="customer-page-header"><div><p className="customer-eyebrow">SalonAI</p><h1>{page.title}</h1>{page.summary ? <p>{page.summary}</p> : null}</div></header><section className="experience-panel">{(page.blocks || []).map((block, index)=><ContentBlock key={block._id || `${block.type}-${index}`} block={block}/>)}</section></article></main>;
}
