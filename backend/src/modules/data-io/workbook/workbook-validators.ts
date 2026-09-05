import type { CellValue } from 'exceljs';

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Explicit per-shape handling rather than a blind String(value) fallback —
// CellValue's union includes formula/error objects with no meaningful
// toString, which would otherwise silently coerce to "[object Object]".
function cellText(value: CellValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value) return String((value as { text: unknown }).text);
    if (
      'result' in value &&
      value.result !== undefined &&
      value.result !== null
    ) {
      return cellText(value.result);
    }
  }
  return undefined;
}

export function coerceString(value: CellValue): string | undefined {
  const text = cellText(value);
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

export interface NumberResult {
  value?: number;
  invalid?: boolean;
}

export function coerceNumber(value: CellValue): NumberResult {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'number') return { value };
  const text = cellText(value)?.trim();
  if (!text) return {};
  const parsed = Number(text);
  return Number.isNaN(parsed) ? { invalid: true } : { value: parsed };
}

export interface DateResult {
  iso?: string;
  invalid?: boolean;
}

// Accepts a real Excel date cell (JS Date from exceljs), an ISO/common-format
// string, or a raw numeric Excel date serial (a frequent copy-paste artifact
// when a date cell loses its date formatting) — converts all three to the
// same YYYY-MM-DD instead of rejecting the numeric case outright.
export function coerceDate(value: CellValue): DateResult {
  if (value === null || value === undefined || value === '') return {};
  if (value instanceof Date) {
    return { iso: value.toISOString().slice(0, 10) };
  }
  if (typeof value === 'number') {
    const ms = EXCEL_EPOCH_MS + value * MS_PER_DAY;
    const date = new Date(ms);
    return Number.isNaN(date.getTime())
      ? { invalid: true }
      : { iso: date.toISOString().slice(0, 10) };
  }
  const text = cellText(value)?.trim();
  if (!text) return {};
  const isoAttempt = Date.parse(text);
  if (!Number.isNaN(isoAttempt)) {
    return { iso: new Date(isoAttempt).toISOString().slice(0, 10) };
  }
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!Number.isNaN(date.getTime())) {
      return { iso: date.toISOString().slice(0, 10) };
    }
  }
  return { invalid: true };
}

export function matchEnum(
  value: string,
  enumValues: string[],
): string | undefined {
  return enumValues.find((v) => v.toLowerCase() === value.toLowerCase());
}
