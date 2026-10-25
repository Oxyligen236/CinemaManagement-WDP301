export type PriceGroup = "SEAT" | "DAY";

export interface PriceValue {
  ruleId: string;
  multiplier: number;
  updatedAt: string;
}

export interface PriceField {
  group: PriceGroup;
  fieldKey: string;
  label: string;
  values: PriceValue[];
}

export interface PriceValueMutation {
  message: string;
  value: PriceValue;
  field: PriceField;
}

export interface FieldError {
  field: "multiplier" | "group" | "fieldKey";
  message: string;
}

/**
 * Outcome of an add/edit submission reported to the input component:
 * `done` clears/closes the input; otherwise `error` (if any) is shown under it.
 */
export interface SubmitResult {
  done: boolean;
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
  }
}

export const MSG03 = "Update asset(s) successfully.";
export const MSG_CREATE_SUCCESS = "Create asset(s) successfully.";
export const MSG_DELETE_SUCCESS = "Delete asset(s) successfully.";
export const MSG_INVALID_MULTIPLIER =
  "Multiplier value must be a valid positive number.";
export const MSG_DUPLICATE_MULTIPLIER =
  "This multiplier value already exists for this field.";
export const MSG_MAX_VALUES = "A field can have at most 20 values.";
export const MSG_SAVE_FAILED =
  "Unable to save pricing configurations due to system failure. Please try again later.";
export const MSG_LOAD_FAILED = "Unable to load pricing configurations.";
export const msg02 = (label: string) => `The ${label} field is required.`;

export const MULTIPLIER_MIN = 1;
export const MULTIPLIER_MAX = 10;
export const MAX_VALUES_PER_FIELD = 20;

const FIELD_ERROR_KEYS = ["multiplier", "group", "fieldKey"];

/**
 * Validates one raw input with the same rules as the backend:
 * required, finite number, >= 1.0, <= 10, at most 2 decimal places,
 * and not already present in the field (except `ignoreValue`).
 * Returns the parsed number or an error message.
 */
export function validateMultiplierInput(
  raw: string,
  existing: number[],
  ignoreValue?: number,
): { value: number } | { error: string } {
  const text = raw.trim();
  if (text === "") return { error: msg02("Multiplier") };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: MSG_INVALID_MULTIPLIER };
  const value = Math.round(Number(text) * 100) / 100;
  if (
    !Number.isFinite(value) ||
    value < MULTIPLIER_MIN ||
    value > MULTIPLIER_MAX
  ) {
    return { error: MSG_INVALID_MULTIPLIER };
  }
  const duplicated = existing.some(
    (item) => item === value && item !== ignoreValue,
  );
  if (duplicated) return { error: MSG_DUPLICATE_MULTIPLIER };
  return { value };
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("cinema_access_token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // localStorage unavailable
  }
  return {};
}

function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.message === "string" &&
    typeof item.field === "string" &&
    FIELD_ERROR_KEYS.includes(item.field)
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
  const headers: Record<string, string> = { ...authHeaders() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? "Request failed.");
    const errors: FieldError[] = Array.isArray(body?.errors)
      ? body.errors.filter(isFieldError)
      : [];
    throw new ApiError(message, response.status, errors);
  }
  return body as T;
}

function valuesPath(group: PriceGroup, fieldKey: string): string {
  return `/price-multipliers/${encodeURIComponent(group)}/${encodeURIComponent(fieldKey)}/values`;
}

export function fetchPriceFields(): Promise<PriceField[]> {
  return request("/price-multipliers");
}

export function createPriceValue(
  group: PriceGroup,
  fieldKey: string,
  payload: { multiplier: number },
): Promise<PriceValueMutation> {
  return request(valuesPath(group, fieldKey), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePriceValue(
  group: PriceGroup,
  fieldKey: string,
  ruleId: string,
  payload: { multiplier: number },
): Promise<PriceValueMutation> {
  return request(`${valuesPath(group, fieldKey)}/${encodeURIComponent(ruleId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePriceValue(
  group: PriceGroup,
  fieldKey: string,
  ruleId: string,
): Promise<PriceValueMutation> {
  return request(`${valuesPath(group, fieldKey)}/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
  });
}
