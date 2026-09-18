import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

function focusableElements(container) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      !element.hasAttribute("inert")
  );
}

export default function useModalFocusTrap({
  open,
  containerRef,
  returnFocusRef,
  setOpen,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const container =
      containerRef.current;

    if (!container) {
      return undefined;
    }

    const previouslyFocused =
      document.activeElement;

    const focusInitial =
      window.requestAnimationFrame(() => {
        const [first] =
          focusableElements(
            container
          );

        (first || container)
          .focus();
      });

    function handleKeyDown(
      event
    ) {
      if (
        event.key === "Escape"
      ) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (
        event.key !== "Tab"
      ) {
        return;
      }

      const focusable =
        focusableElements(
          container
        );

      if (
        focusable.length === 0
      ) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first =
        focusable[0];
      const last =
        focusable[
          focusable.length - 1
        ];
      const active =
        document.activeElement;

      if (
        event.shiftKey &&
        (active === first ||
          active === container)
      ) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (
        !event.shiftKey &&
        active === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.cancelAnimationFrame(
        focusInitial
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      window.requestAnimationFrame(
        () => {
          const target =
            returnFocusRef
              ?.current ||
            previouslyFocused;

          if (
            target instanceof
              HTMLElement &&
            target.isConnected
          ) {
            target.focus();
          }
        }
      );
    };
  }, [
    containerRef,
    open,
    returnFocusRef,
    setOpen,
  ]);
}
