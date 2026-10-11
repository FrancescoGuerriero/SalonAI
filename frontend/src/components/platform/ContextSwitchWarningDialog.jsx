import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { useRef } from "react";

import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";

export default function ContextSwitchWarningDialog({
  open = false,
  currentContextLabel = "",
  nextContextLabel = "",
  unsavedWorkLabel = "this page",
  returnFocusRef,
  onRequestStay,
  onRequestDiscardAndSwitch,
}) {
  const dialogRef = useRef(null);

  useModalFocusTrap({
    open,
    containerRef: dialogRef,
    returnFocusRef,
    setOpen(nextOpen) {
      if (!nextOpen) {
        onRequestStay?.();
      }
    },
  });

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-end justify-center p-2 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Stay on current location"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onRequestStay}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-switch-warning-title"
        aria-describedby="context-switch-warning-description"
        tabIndex="-1"
        className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-black/10 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Unsaved work
              </p>
              <h2
                id="context-switch-warning-title"
                className="mt-1 text-xl font-bold text-black"
              >
                Switch location without saving?
              </h2>
            </div>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p
            id="context-switch-warning-description"
            className="text-sm leading-6 text-stone-700"
          >
            You have unsaved changes in {unsavedWorkLabel}. Switching
            {currentContextLabel ? " from " + currentContextLabel : ""}
            {nextContextLabel ? " to " + nextContextLabel : ""} may discard
            those changes.
          </p>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-stone-800">
            Stay here to save your work first, or discard the unsaved changes
            and continue with the requested context switch.
          </div>
        </div>

        <footer className="shrink-0 border-t border-black/10 bg-stone-50 px-5 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onRequestStay}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 bg-white px-4 text-sm font-bold text-black hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              Stay here
            </button>

            <button
              type="button"
              onClick={onRequestDiscardAndSwitch}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              Discard changes and switch
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
