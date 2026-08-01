import { useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import API from "../api/axios.js";

export default function SystemAdministrationPage() {
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");

    try {
      const [healthResponse, settingsResponse] =
        await Promise.all([
          API.get("/health/dependencies"),
          API.get("/system-administration/settings"),
        ]);

      setHealth(healthResponse.data);
      setSettings(settingsResponse.data.settings || []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
        requestError.message
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-700">
                <ShieldCheck size={20} />
                Production administration
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                System Administration
              </h1>
            </div>

            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Activity className="text-indigo-700" />
            <h2 className="mt-4 font-semibold text-slate-900">
              Dependency health
            </h2>
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(health, null, 2)}
            </pre>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              System settings
            </h2>

            <div className="mt-4 divide-y divide-slate-100">
              {settings.map((setting) => (
                <div key={setting._id} className="py-3">
                  <p className="font-medium text-slate-900">
                    {setting.key}
                  </p>
                  <p className="text-sm text-slate-500">
                    {String(setting.value)}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
