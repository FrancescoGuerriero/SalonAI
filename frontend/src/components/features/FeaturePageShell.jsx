import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function FeaturePageShell({
  title,
  description,
  icon: Icon,
  actions,
  children,
}) {
  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Icon size={24} />
            </div>

            <div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 transition hover:text-gray-900"
              >
                <ArrowLeft size={15} />
                Dashboard
              </Link>

              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                {title}
              </h1>

              <p className="mt-2 max-w-3xl text-gray-600">
                {description}
              </p>
            </div>
          </div>

          {actions ? (
            <div className="flex flex-wrap gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </header>

      {children}
    </main>
  );
}
