import type { CellValue } from 'exceljs';
import type { FieldRules } from './workbook-columns';

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DATE = '1900-01-01';

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

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

// A formula cell's value is { formula, result }; unwrap to the result so a
// formula like =500*2 imports as 1000.
function unwrapFormula(value: CellValue): CellValue {
  if (value && typeof value === 'object' && 'formula' in value) {
    return value.result ?? null;
  }
  return value;
}

// "#DIV/0!", "#N/A", "#REF!" … — either a literal error cell or a formula
// whose cached result is one.
export function excelError(value: CellValue): string | undefined {
  const unwrapped = unwrapFormula(value);
  if (unwrapped && typeof unwrapped === 'object' && 'error' in unwrapped) {
    return String(unwrapped.error);
  }
  return undefined;
}

export function isBlank(value: CellValue): boolean {
  if (excelError(value)) return false;
  return coerceString(value) === undefined;
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

// Strict about what counts as a number (no Infinity, hex, exponent or
// stray words), but forgiving of how people type amounts: "1,500",
// "₹1500", "Rs. 1,500" and surrounding spaces are all 1500.
export function coerceNumber(value: CellValue): NumberResult {
  const unwrapped = unwrapFormula(value);
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') {
    return {};
  }
  if (typeof unwrapped === 'number') {
    return Number.isFinite(unwrapped)
      ? { value: unwrapped }
      : { invalid: true };
  }
  if (typeof unwrapped === 'boolean' || unwrapped instanceof Date) {
    return { invalid: true };
  }
  const text = cellText(unwrapped)?.trim();
  if (!text) return {};
  const cleaned = text.replace(/^(rs\.?|inr)/i, '').replace(/[\s,₹$€£]/g, '');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return { invalid: true };
  return { value: Number(cleaned) };
}

export interface DateResult {
  iso?: string;
  invalid?: boolean;
}

function isoFromParts(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject roll-over: Date.UTC(2026, 1, 30) silently becomes 2 March.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

// Accepts a real Excel date cell, a raw Excel date serial (a frequent
// copy-paste artifact when a cell loses its date format), or text in one of a
// few unambiguous shapes. Text is always read day-first — never month-first —
// so "03/04/2026" is 3 April, never 4 March. Deliberately not Date.parse():
// it reads slashes as US month/day, rolls impossible dates over, and turns
// fragments like "5" or "1 Aug" into dates in 2001.
export function coerceDate(value: CellValue): DateResult {
  const unwrapped = unwrapFormula(value);
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') {
    return {};
  }
  if (unwrapped instanceof Date) {
    return Number.isNaN(unwrapped.getTime())
      ? { invalid: true }
      : { iso: unwrapped.toISOString().slice(0, 10) };
  }
  if (typeof unwrapped === 'number') {
    if (!Number.isFinite(unwrapped) || unwrapped < 1) return { invalid: true };
    const date = new Date(EXCEL_EPOCH_MS + Math.floor(unwrapped) * MS_PER_DAY);
    return Number.isNaN(date.getTime())
      ? { invalid: true }
      : { iso: date.toISOString().slice(0, 10) };
  }

  const text = cellText(unwrapped)?.trim();
  if (!text) return {};

  let iso: string | undefined;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(T.*)?$/.exec(text))) {
    iso = isoFromParts(+match[1], +match[2], +match[3]);
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text))) {
    iso = isoFromParts(+match[3], +match[2], +match[1]);
  } else if (
    (match = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4})$/.exec(text))
  ) {
    const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    iso = month > 0 ? isoFromParts(+match[3], month, +match[1]) : undefined;
  }
  return iso ? { iso } : { invalid: true };
}

export function matchEnum(
  value: string,
  enumValues: string[],
  aliases?: Record<string, string>,
): string | undefined {
  const lower = value.toLowerCase();
  return enumValues.find((v) => v.toLowerCase() === lower) ?? aliases?.[lower];
}

export interface CellResult {
  value?: string | number;
  error?: string;
}

function decimalsExceed(value: number, maxDecimals: number): boolean {
  const scaled = value * 10 ** maxDecimals;
  return Math.abs(scaled - Math.round(scaled)) > 1e-6;
}

// Runs every rule for one cell. Messages say what to fix, without the
// location — the caller prefixes the sheet and cell reference.
export function validateCell(
  raw: CellValue,
  rules: FieldRules,
  now: Date = new Date(),
): CellResult {
  const label = `"${rules.label}"`;
  const error = excelError(raw);
  if (error) {
    return {
      error: `${label} contains an Excel error (${error}) — replace it with a value`,
    };
  }

  if (rules.type === 'number') {
    const { value, invalid } = coerceNumber(raw);
    if (invalid) {
      return {
        error: `${label} must be a number${rules.example ? `, e.g. ${rules.example}` : ''}`,
      };
    }
    if (value === undefined) {
      return rules.required ? { error: `${label} is required` } : {};
    }
    if (rules.integer && !Number.isInteger(value)) {
      return { error: `${label} must be a whole number` };
    }
    if (
      rules.maxDecimals !== undefined &&
      decimalsExceed(value, rules.maxDecimals)
    ) {
      return {
        error: `${label} can have at most ${rules.maxDecimals} decimal places`,
      };
    }
    if (rules.min !== undefined && value < rules.min) {
      return { error: `${label} must be at least ${rules.min}` };
    }
    if (rules.max !== undefined && value > rules.max) {
      return { error: `${label} must be at most ${rules.max}` };
    }
    return { value };
  }

  if (rules.type === 'date') {
    const { iso, invalid } = coerceDate(raw);
    if (invalid) {
      return {
        error: `${label} isn't a valid date — use DD/MM/YYYY (e.g. 25/08/2026) or YYYY-MM-DD`,
      };
    }
    if (iso === undefined) {
      return rules.required ? { error: `${label} is required` } : {};
    }
    // One day of leeway, so "today" in a timezone ahead of the server's
    // isn't rejected as the future.
    const latest = new Date(now.getTime() + MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    if (iso > latest) return { error: `${label} can't be in the future` };
    if (iso < MIN_DATE) return { error: `${label} can't be before 1900` };
    return { value: iso };
  }

  const text = coerceString(raw);
  if (text === undefined) {
    return rules.required ? { error: `${label} is required` } : {};
  }
  if (rules.enumValues) {
    const matched = matchEnum(text, rules.enumValues, rules.aliases);
    if (!matched) {
      return {
        error: `${label} value "${text}" isn't one of: ${rules.enumValues.join(', ')}`,
      };
    }
    return { value: matched };
  }
  const normalized = rules.uppercase ? text.toUpperCase() : text;
  if (rules.maxLength !== undefined && normalized.length > rules.maxLength) {
    return {
      error: `${label} is too long (${normalized.length} characters, max ${rules.maxLength})`,
    };
  }
  if (rules.pattern && !rules.pattern.regex.test(normalized)) {
    return { error: `${label} ${rules.pattern.hint}` };
  }
  return { value: normalized };
}
