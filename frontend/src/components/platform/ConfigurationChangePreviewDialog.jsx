import { ArrowRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useRef } from "react";

import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";

export default function ConfigurationChangePreviewDialog({
  open = false,
  mode = "override",
  settingLabel = "",
  currentValue = "",
  proposedValue = "",
  currentSourceLabel = "",
  proposedSourceLabel = "",
  returnFocusRef,
  onRequestCancel,
  onRequestConfirm,
}) {
  const dialogRef = useRef(null);
  const reverting = mode === "revert";

  useModalFocusTrap({
    open,
    containerRef: dialogRef,
    returnFocusRef,
    setOpen(nextOpen) {
      if (!nextOpen) {
        onRequestCancel?.();
      }
    },
  });

  if (!open) {
    return null;
  }

  const title = reverting
    ? "Revert to inherited configuration?"
    : "Apply this configuration override?";

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-end justify-center p-2 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cancel configuration change"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onRequestCancel}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="configuration-change-preview-title"
        aria-describedby="configuration-change-preview-description"
        tabIndex="-1"
        className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-black/10 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
              {reverting ? (
                <RotateCcw size={20} aria-hidden="true" />
              ) : (
                <SlidersHorizontal size={20} aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Configuration preview
              </p>
              <h2
                id="configuration-change-preview-title"
                className="mt-1 text-xl font-bold text-black"
              >
                {title}
              </h2>
            </div>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p
            id="configuration-change-preview-description"
            className="text-sm leading-6 text-stone-700"
          >
            Review the effective value before requesting this change. The
            server remains authoritative and will validate the request again
            before applying it.
          </p>

          <div className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
              {settingLabel || "Configuration setting"}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-lg border border-black/10 bg-white p-3">
                <p className="text-xs font-bold text-stone-600">
                  {reverting ? "Current override" : "Current value"}
                </p>
                <p className="mt-1 break-words text-base font-bold text-black">
                  {currentValue}
                </p>
                {currentSourceLabel ? (
                  <p className="mt-1 text-xs text-stone-600">
                    Source: {currentSourceLabel}
                  </p>
                ) : null}
              </div>

              <ArrowRight
                size={20}
                aria-hidden="true"
                className="mx-auto rotate-90 text-amber-700 sm:rotate-0"
              />

              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">
                  {reverting ? "Inherited value" : "Proposed value"}
                </p>
                <p className="mt-1 break-words text-base font-bold text-black">
                  {proposedValue}
                </p>
                {proposedSourceLabel ? (
                  <p className="mt-1 text-xs text-stone-600">
                    Source: {proposedSourceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-black/10 bg-stone-50 px-5 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onRequestCancel}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 bg-white px-4 text-sm font-bold text-black hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onRequestConfirm}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {reverting ? "Revert to inherited" : "Request override"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
