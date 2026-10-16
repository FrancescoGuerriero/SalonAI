import { CircleCheck, CircleDot, CircleOff } from "lucide-react";

function normaliseSteps(value) {
  return Array.isArray(value) ? value : [];
}

export default function InstallationStepper({
  steps = [],
  currentStepId = "",
  onRequestStep,
}) {
  const safeSteps = normaliseSteps(steps);

  return (
    <nav className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm" aria-label="Tenant installation progress">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {safeSteps.map((step, index) => {
          const id = String(step?.id || index);
          const current = id === String(currentStepId || "");
          const complete = step?.complete === true;
          const disabled = step?.disabled === true;
          const label = step?.label || `Step ${index + 1}`;
          const meta = step?.meta || "";
          const Icon = complete ? CircleCheck : disabled ? CircleOff : CircleDot;

          return (
            <li key={id}>
              <button
                type="button"
                aria-label={label}
                aria-current={current ? "step" : undefined}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => {
                  if (!disabled && typeof onRequestStep === "function") onRequestStep(step);
                }}
                className={
                  "flex min-h-16 w-full items-start gap-3 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 " +
                  (current ? "border-amber-700 bg-amber-50" : "border-black/10 bg-white hover:border-amber-500") +
                  (disabled ? " cursor-not-allowed opacity-60" : "")
                }
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-stone-100 text-xs font-bold text-black">
                  {complete ? <Icon size={16} aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-black">{label}</span>
                  {meta ? <span className="mt-1 block text-xs leading-5 text-stone-600">{meta}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
