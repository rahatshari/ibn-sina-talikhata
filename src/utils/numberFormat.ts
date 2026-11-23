export type NumeralMode = 'en' | 'bn';

export const DEFAULT_NUMERAL_MODE: NumeralMode = 'en';
export const NUMERAL_MODE_STORAGE_KEY = 'ibn_sina_numeral_mode_v1';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;
const EN_DIGITS_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

let activeNumeralModeCache: NumeralMode | null = null;

export function toBengaliDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function toEnglishDigits(value: string | number): string {
  return String(value).replace(/[০-৯]/g, (d) => EN_DIGITS_MAP[d] ?? d);
}

export function loadNumeralMode(): NumeralMode {
  if (typeof window === 'undefined') {
    return activeNumeralModeCache ?? DEFAULT_NUMERAL_MODE;
  }
  try {
    const raw = window.localStorage.getItem(NUMERAL_MODE_STORAGE_KEY);
    const mode: NumeralMode = raw === 'bn' ? 'bn' : raw === 'en' ? 'en' : DEFAULT_NUMERAL_MODE;
    activeNumeralModeCache = mode;
    return mode;
  } catch {
    return activeNumeralModeCache ?? DEFAULT_NUMERAL_MODE;
  }
}

export function getActiveNumeralMode(): NumeralMode {
  if (activeNumeralModeCache) return activeNumeralModeCache;
  return loadNumeralMode();
}

export function saveNumeralMode(mode: NumeralMode): NumeralMode {
  const safeMode: NumeralMode = mode === 'bn' ? 'bn' : 'en';
  activeNumeralModeCache = safeMode;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(NUMERAL_MODE_STORAGE_KEY, safeMode);
    } catch {
      // Ignore storage errors
    }
  }
  return safeMode;
}

export function formatDigits(value: string | number, mode?: NumeralMode): string {
  const targetMode = mode ?? getActiveNumeralMode();
  return targetMode === 'bn' ? toBengaliDigits(value) : toEnglishDigits(value);
}

export function formatNumberValue(
  value: number,
  options?: {
    mode?: NumeralMode;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  },
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    useGrouping: options?.useGrouping ?? true,
  });
  return formatDigits(formatted, options?.mode);
}
