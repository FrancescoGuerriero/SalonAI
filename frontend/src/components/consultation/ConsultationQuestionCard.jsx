import { useId } from "react";

import Button from "../ui/Button.jsx";

export default function ConsultationQuestionCard({
  question,
  description = "",
  options = [],
  selectedValue = "",
  hintTitle = "",
  hint = "",
  onRequestSelect,
  onRequestContinue,
  onRequestSave,
  onRequestHandoff,
  continueLabel = "Continue",
  busy = false,
}) {
  const descriptionId = useId();
  const hintId = useId();
  const describedBy = [description ? descriptionId : "", hint ? hintId : ""]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6"
      aria-busy={busy || undefined}
    >
      <fieldset disabled={busy} aria-describedby={describedBy}>
        <legend className="text-xl font-bold leading-8 text-black">
          {question}
        </legend>

        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-stone-600">
            {description}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          {options.map((option, index) => {
            const value = typeof option === "string" ? option : option?.value;
            const label = typeof option === "string" ? option : option?.label;
            const optionId = typeof option === "string" ? `${index}-${option}` : option?.id || value || index;
            const checked = value === selectedValue;

            return (
              <label
                key={optionId}
                className={[
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                  checked
                    ? "border-amber-500 bg-amber-50 text-black"
                    : "border-black/10 bg-white text-stone-800 hover:border-amber-300 hover:bg-amber-50/40",
                  busy ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="consultation-question"
                  value={value ?? ""}
                  checked={checked}
                  onChange={() => onRequestSelect?.(value)}
                  readOnly={!onRequestSelect}
                  className="h-5 w-5 accent-amber-600"
                />
                <span>{label || value}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {hint ? (
        <aside
          id={hintId}
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          {hintTitle ? (
            <h3 className="text-sm font-bold text-black">{hintTitle}</h3>
          ) : null}
          <p className={`${hintTitle ? "mt-1 " : ""}text-sm leading-6 text-stone-700`}>
            {hint}
          </p>
        </aside>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {onRequestContinue ? (
          <Button
            type="button"
            className="min-h-11"
            loading={busy}
            disabled={busy}
            onClick={onRequestContinue}
          >
            {continueLabel}
          </Button>
        ) : null}

        {onRequestSave ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={onRequestSave}
          >
            Save for later
          </Button>
        ) : null}

        {onRequestHandoff ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={onRequestHandoff}
          >
            Talk to a stylist
          </Button>
        ) : null}
      </div>

      {busy ? (
        <p className="sr-only" role="status" aria-live="polite">
          Saving consultation response
        </p>
      ) : null}
    </section>
  );
}
