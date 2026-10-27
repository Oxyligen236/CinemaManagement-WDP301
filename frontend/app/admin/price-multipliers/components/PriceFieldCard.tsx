"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createPriceValue,
  deletePriceValue,
  MSG_SAVE_FAILED,
  PriceField,
  PriceValue,
  PriceValueMutation,
  SubmitResult,
  updatePriceValue,
} from "../api";
import AddPriceValueForm from "./AddPriceValueForm";
import DeletePriceValueDialog from "./DeletePriceValueDialog";
import ErrorBanner from "./ErrorBanner";
import PriceValueRow, { formatMultiplier } from "./PriceValueRow";

interface Props {
  field: PriceField;
  onFieldChange: (field: PriceField) => void;
  onToast: (message: string) => void;
  /** Called when the backend answers 401 (session expired). */
  onUnauthorized: () => void;
  /** Called when a value no longer exists so the page can reload the list. */
  onReload: () => void;
}

type Pending = { kind: "add" } | { kind: "edit" | "delete"; ruleId: string };

const NO_PERMISSION_ACTION = "Bạn không có quyền thực hiện thao tác này.";
const NOT_FOUND_BANNER = "Giá trị không còn tồn tại";

export default function PriceFieldCard({
  field,
  onFieldChange,
  onToast,
  onUnauthorized,
  onReload,
}: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [banner, setBanner] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PriceValue | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const busyRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const restoreRuleIdRef = useRef<string | null>(null);

  const fieldId = `${field.group}-${field.fieldKey}`.toLowerCase();
  const existing = field.values.map((item) => item.multiplier);
  const busy = pending !== null;

  // Return focus after the delete dialog closes: the row's Delete button if the
  // row still exists, otherwise the card's add input.
  useEffect(() => {
    if (deleteTarget || restoreRuleIdRef.current === null) return;
    const ruleId = restoreRuleIdRef.current;
    restoreRuleIdRef.current = null;
    const section = sectionRef.current;
    if (!section) return;
    const rowButton = Array.from(
      section.querySelectorAll<HTMLButtonElement>("button[data-delete-rule]"),
    ).find((el) => el.dataset.deleteRule === ruleId);
    const target = rowButton ?? section.querySelector<HTMLElement>(`#add-${fieldId}`);
    target?.focus();
  }, [deleteTarget, fieldId]);

  /**
   * Runs one write call with a double-click guard. Maps errors per plan 4.2 #6.
   * Returns the inline outcome for the calling input.
   */
  async function run(
    next: Pending,
    call: () => Promise<PriceValueMutation>,
    target: "input" | "dialog",
  ): Promise<SubmitResult> {
    if (busyRef.current) return { done: false };
    busyRef.current = true;
    setPending(next);
    setBanner("");
    try {
      const result = await call();
      onFieldChange(result.field);
      onToast(result.message);
      return { done: true };
    } catch (err) {
      return handleError(err, target);
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  function handleError(err: unknown, target: "input" | "dialog"): SubmitResult {
    const show = (message: string): SubmitResult => {
      if (target === "dialog") setDeleteError(message);
      return { done: false, error: message };
    };
    if (err instanceof ApiError) {
      if (err.status === 401) {
        onUnauthorized();
        return { done: false };
      }
      if (err.status === 403) {
        if (target === "dialog") setDeleteError(NO_PERMISSION_ACTION);
        else setBanner(NO_PERMISSION_ACTION);
        return { done: false };
      }
      if (err.status === 404) {
        restoreRuleIdRef.current = deleteTarget?.ruleId ?? null;
        setDeleteTarget(null);
        setDeleteError("");
        setBanner(NOT_FOUND_BANNER);
        onReload();
        return { done: false };
      }
      if (err.status === 400) {
        const first = err.errors.find((e) => e.field === "multiplier");
        return show(first?.message ?? err.errors[0]?.message ?? err.message);
      }
      if (err.status === 409) return show(err.message);
    }
    if (target === "dialog") setDeleteError(MSG_SAVE_FAILED);
    else setBanner(MSG_SAVE_FAILED);
    return { done: false };
  }

  function handleAdd(multiplier: number) {
    return run(
      { kind: "add" },
      () => createPriceValue(field.group, field.fieldKey, { multiplier }),
      "input",
    );
  }

  function handleUpdate(ruleId: string, multiplier: number) {
    return run(
      { kind: "edit", ruleId },
      () => updatePriceValue(field.group, field.fieldKey, ruleId, { multiplier }),
      "input",
    );
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const result = await run(
      { kind: "delete", ruleId: deleteTarget.ruleId },
      () => deletePriceValue(field.group, field.fieldKey, deleteTarget.ruleId),
      "dialog",
    );
    if (result.done) {
      restoreRuleIdRef.current = deleteTarget.ruleId;
      setDeleteTarget(null);
      setDeleteError("");
    }
  }

  function closeDialog() {
    if (pending?.kind === "delete") return;
    restoreRuleIdRef.current = deleteTarget?.ruleId ?? null;
    setDeleteTarget(null);
    setDeleteError("");
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`${fieldId}-title`}
      className="rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6"
    >
      <h3 id={`${fieldId}-title`} className="text-base font-bold text-text-main">
        {field.label}
      </h3>

      {banner && (
        <div className="mt-3">
          <ErrorBanner message={banner} />
        </div>
      )}

      {field.values.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border-main px-3 py-4 text-sm text-text-sub">
          Chưa có giá trị nào. Suất chiếu sẽ dùng hệ số 1.0x cho trường này.
        </p>
      ) : (
        <ul aria-label={`Danh sách hệ số ${field.label}`} className="mt-3 space-y-2">
          {field.values.map((value) => (
            <PriceValueRow
              key={value.ruleId}
              value={value}
              fieldLabel={field.label}
              existing={existing}
              disabled={busy}
              saving={pending?.kind === "edit" && pending.ruleId === value.ruleId}
              onSave={(multiplier) => handleUpdate(value.ruleId, multiplier)}
              onDelete={() => {
                setDeleteError("");
                setDeleteTarget(value);
              }}
            />
          ))}
        </ul>
      )}

      <AddPriceValueForm
        inputId={`add-${fieldId}`}
        fieldLabel={field.label}
        existing={existing}
        disabled={busy}
        submitting={pending?.kind === "add"}
        onSubmit={handleAdd}
      />

      {deleteTarget && (
        <DeletePriceValueDialog
          fieldLabel={field.label}
          multiplierText={formatMultiplier(deleteTarget.multiplier)}
          submitting={pending?.kind === "delete"}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onClose={closeDialog}
        />
      )}
    </section>
  );
}
