import { ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useRef } from "react";

import useModalFocusTrap from "../../../hooks/useModalFocusTrap.js";

export default function InstallationWriteConfirmationDialog({
  open = false,
  businessLabel = "",
  verticalLabel = "",
  deploymentLabel = "",
  pendingDomainCount = 0,
  requestedCapabilityCount = 0,
  canRequestWrite = false,
  returnFocusRef,
  onRequestCancel,
  onRequestConfirm,
}) {
  const dialogRef = useRef(null);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-end justify-center p-2 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cancel installation write request"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onRequestCancel}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="installation-write-confirmation-title"
        aria-describedby="installation-write-confirmation-description"
        tabIndex="-1"
        className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-black/10 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Explicit write confirmation
              </p>
              <h2
                id="installation-write-confirmation-title"
                className="mt-1 text-xl font-bold text-black"
              >
                Request tenant installation writes?
              </h2>
            </div>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p
            id="installation-write-confirmation-description"
            className="text-sm leading-6 text-stone-700"
          >
            This requests creation or update of platform resources. The
            server must revalidate authority, collisions and current state
            before any write is committed.
          </p>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Business
              </dt>
              <dd className="mt-1 text-sm font-bold text-black">
                {businessLabel || "Not supplied"}
              </dd>
            </div>
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Vertical
              </dt>
              <dd className="mt-1 text-sm font-bold text-black">
                {verticalLabel || "Not supplied"}
              </dd>
            </div>
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Deployment
              </dt>
              <dd className="mt-1 text-sm font-bold text-black">
                {deploymentLabel || "Not supplied"}
              </dd>
            </div>
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Capability intent
              </dt>
              <dd className="mt-1 text-sm font-bold text-black">
                {requestedCapabilityCount} requested
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-stone-800">
            {pendingDomainCount} pending domain
            {pendingDomainCount === 1 ? "" : "s"} will remain a domain
            lifecycle state; this dialog does not activate DNS. Capability
            intent is also not billing or subscription activation.
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

            {canRequestWrite && onRequestConfirm ? (
              <button
                type="button"
                onClick={onRequestConfirm}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Request installation writes
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
