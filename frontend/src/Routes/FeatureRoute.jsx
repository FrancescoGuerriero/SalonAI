import { Link } from "react-router-dom";
import { Power } from "lucide-react";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useFeatureControls from "../hooks/useFeatureControls.js";

export default function FeatureRoute({ children, featureId }) {
  const { loading, isFeatureEnabled } = useFeatureControls();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isFeatureEnabled(featureId)) {
    return (
      <main className="min-h-[60vh] px-4 py-16" id="main-content" tabIndex="-1">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Power className="mx-auto text-slate-500" size={34} />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">This option is currently off</h1>
          <p className="mt-3 text-slate-600">
            A SalonAI administrator has disabled this feature. Existing records are retained and the option can be enabled again from the On/Off Ideas tab.
          </p>
          <Link className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white" to="/">
            Return home
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
