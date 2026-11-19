export type AppFontId =
  | 'hind-siliguri'
  | 'noto-sans'
  | 'noto-serif'
  | 'baloo-da'
  | 'atma';

export interface AppFontOption {
  id: AppFontId;
  label: string;
  sample: string;
  fontFamily: string;
  canvasFont: string;
}

const FONT_STORAGE_KEY = 'ibn_sina_app_font_v1';

export const APP_FONT_OPTIONS: AppFontOption[] = [
  {
    id: 'hind-siliguri',
    label: 'হিন্দ শিলিগুড়ি',
    sample: 'আধুনিক ক্লিন',
    fontFamily: "'Hind Siliguri', 'Plus Jakarta Sans', system-ui, sans-serif",
    canvasFont: '"Hind Siliguri", system-ui, sans-serif',
  },
  {
    id: 'noto-sans',
    label: 'নোটো সানস',
    sample: 'অফিসিয়াল স্পষ্ট',
    fontFamily: "'Noto Sans Bengali', 'Plus Jakarta Sans', system-ui, sans-serif",
    canvasFont: '"Noto Sans Bengali", system-ui, sans-serif',
  },
  {
    id: 'noto-serif',
    label: 'নোটো সেরিফ',
    sample: 'ক্লাসিক খাতা',
    fontFamily: "'Noto Serif Bengali', Georgia, serif",
    canvasFont: '"Noto Serif Bengali", Georgia, serif',
  },
  {
    id: 'baloo-da',
    label: 'বালু দা ২',
    sample: 'রাউন্ডেড বোল্ড',
    fontFamily: "'Baloo Da 2', 'Plus Jakarta Sans', system-ui, sans-serif",
    canvasFont: '"Baloo Da 2", system-ui, sans-serif',
  },
  {
    id: 'atma',
    label: 'আত্মা স্টাইল',
    sample: 'হাতের লেখা',
    fontFamily: "'Atma', 'Hind Siliguri', system-ui, sans-serif",
    canvasFont: '"Atma", "Hind Siliguri", system-ui, sans-serif',
  },
];

export function getFontOption(fontId: AppFontId): AppFontOption {
  return APP_FONT_OPTIONS.find((f) => f.id === fontId) ?? APP_FONT_OPTIONS[0];
}

export function loadSavedFontId(): AppFontId {
  if (typeof window === 'undefined') return 'hind-siliguri';
  try {
    const raw = window.localStorage.getItem(FONT_STORAGE_KEY);
    if (raw && APP_FONT_OPTIONS.some((f) => f.id === raw)) {
      return raw as AppFontId;
    }
  } catch {
    // Ignore storage errors
  }
  return 'hind-siliguri';
}

export function saveAndApplyAppFont(fontId: AppFontId): AppFontOption {
  const option = getFontOption(fontId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, option.id);
    } catch {
      // Ignore storage errors
    }
  }
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--font-sans', option.fontFamily);
    root.style.setProperty('--font-display', option.fontFamily);
    document.body.style.fontFamily = option.fontFamily;
  }
  return option;
}

export function getActiveFontOption(): AppFontOption {
  return getFontOption(loadSavedFontId());
}
