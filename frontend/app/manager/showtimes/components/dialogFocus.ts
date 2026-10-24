import { KeyboardEvent, useEffect, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Remembers the element focused when the dialog is first rendered and
 * restores focus to it when the dialog unmounts.
 */
export function useRestoreFocus(): void {
  const [previous] = useState<Element | null>(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );
  useEffect(
    () => () => {
      if (previous instanceof HTMLElement) previous.focus();
    },
    [previous],
  );
}

/** Keeps Tab / Shift+Tab inside `container`. */
export function trapTab(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
): void {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter((el) => el.getAttribute("aria-disabled") !== "true");
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
