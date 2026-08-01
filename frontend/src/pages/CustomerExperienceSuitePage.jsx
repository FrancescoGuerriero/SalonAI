import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, Save, Sparkles, Star } from "lucide-react";
import { roadmapFeatureMap, roadmapFeatures } from "../features/roadmap/roadmapFeatures.js";

const keyFor = (id) => `salonai.sprint-suite.${id}`;
const readSaved = (id) => {
  try { return JSON.parse(localStorage.getItem(keyFor(id)) || "{}"); }
  catch { return {}; }
};

function Workspace({ feature }) {
  const initial = readSaved(feature.id);
  const [notes, setNotes] = useState(initial.notes || "");
  const [complete, setComplete] = useState(Boolean(initial.complete));
  const [rating, setRating] = useState(Number(initial.rating || 0));
  const [copied, setCopied] = useState(false);

  const referralCode = useMemo(
    () => `SALON-${feature.sprint}-${feature.id.slice(0, 4).toUpperCase()}`,
    [feature]
  );

  function save() {
    localStorage.setItem(keyFor(feature.id), JSON.stringify({ notes, complete, rating }));
  }

  async function copyCode() {
    await navigator.clipboard?.writeText(referralCode);
    setCopied(true);
  }

  return (
    <section className="suite-workspace">
      <header>
        <span>Interactive frontend workspace</span>
        <p>Data is stored locally until a matching backend API is connected.</p>
      </header>

      {(feature.id === "reviews" || feature.id === "feedback") && (
        <div className="suite-rating" aria-label="Rating">
          {[1,2,3,4,5].map((value) => (
            <button key={value} type="button" className={value <= rating ? "is-selected" : ""} onClick={() => setRating(value)} aria-label={`${value} stars`}>
              <Star size={22} />
            </button>
          ))}
        </div>
      )}

      {feature.id === "referrals" && (
        <div className="suite-referral">
          <span>Your referral reference</span>
          <strong>{referralCode}</strong>
          <button type="button" onClick={copyCode}><Copy size={17} />{copied ? "Copied" : "Copy code"}</button>
        </div>
      )}

      <label htmlFor="suite-notes">Sprint notes or preferences</label>
      <textarea id="suite-notes" rows="8" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Record ${feature.title.toLowerCase()} details here`} />

      <label className="suite-complete">
        <input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} />
        Mark this frontend workspace as reviewed
      </label>

      <button className="suite-primary" type="button" onClick={save}><Save size={17} />Save locally</button>
    </section>
  );
}

export default function CustomerExperienceSuitePage() {
  const { featureId = "privacy" } = useParams();
  const feature = roadmapFeatureMap[featureId] || roadmapFeatures[0];

  return (
    <main className="suite-page" id="main-content" tabIndex="-1">
      <header className="suite-hero">
        <div>
          <Link to="/experience" className="suite-back"><ArrowLeft size={16} />All experience sprints</Link>
          <span className="suite-eyebrow"><Sparkles size={15} />Frontend Sprint {feature.sprint}</span>
          <h1>{feature.title}</h1>
          <p>{feature.summary}</p>
        </div>
        <span className="suite-status"><CheckCircle2 size={17} />Installed</span>
      </header>

      <div className="suite-layout">
        <nav className="suite-nav" aria-label="Frontend sprint suite">
          {roadmapFeatures.map((item) => (
            <Link className={item.id === feature.id ? "is-active" : ""} to={`/experience/${item.id}`} key={item.id}>
              <span>{item.sprint}</span><strong>{item.title}</strong>
            </Link>
          ))}
        </nav>
        <Workspace feature={feature} />
      </div>
    </main>
  );
}
