/** School currency codes — keep in sync with backend app/core/currencies.py */

export const DEFAULT_CURRENCY_CODE = "BDT";

export type CurrencyMeta = {
  code: string;
  symbol: string;
  name: string;
  locale: string;
};

export const CURRENCIES: Record<string, CurrencyMeta> = {
  BDT: { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "en-BD" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", locale: "ar-SA" },
  PKR: { code: "PKR", symbol: "₨", name: "Pakistani Rupee", locale: "en-PK" },
  NPR: { code: "NPR", symbol: "रू", name: "Nepalese Rupee", locale: "ne-NP" },
  LKR: { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", locale: "si-LK" },
  MYR: { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  QAR: { code: "QAR", symbol: "QR", name: "Qatari Riyal", locale: "ar-QA" },
  KWD: { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar", locale: "ar-KW" },
  OMR: { code: "OMR", symbol: "OMR", name: "Omani Rial", locale: "ar-OM" },
};

export function normalizeCurrencyCode(code: string | null | undefined): string {
  const c = (code || DEFAULT_CURRENCY_CODE).trim().toUpperCase();
  return c in CURRENCIES ? c : DEFAULT_CURRENCY_CODE;
}

export function getCurrency(code: string | null | undefined): CurrencyMeta {
  return CURRENCIES[normalizeCurrencyCode(code)];
}

export function currencySelectOptions(): { value: string; label: string }[] {
  return Object.values(CURRENCIES)
    .sort((a, b) => {
      if (a.code === DEFAULT_CURRENCY_CODE) return -1;
      if (b.code === DEFAULT_CURRENCY_CODE) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      value: c.code,
      label: `${c.symbol}  ${c.code} — ${c.name}`,
    }));
}

export function formatMoney(
  amount: number,
  code: string | null | undefined = DEFAULT_CURRENCY_CODE,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  const c = getCurrency(code);
  const maxFrac = options?.maximumFractionDigits ?? 0;
  const minFrac = options?.minimumFractionDigits ?? 0;
  const formatted = Math.abs(amount).toLocaleString(c.locale, {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: minFrac,
  });
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}${c.symbol}${formatted}`;
}

/** Compact display for large totals (e.g. ₹6.71L). */
export function formatMoneyCompact(amount: number, code: string | null | undefined = DEFAULT_CURRENCY_CODE): string {
  const c = getCurrency(code);
  const sym = c.symbol;
  const neg = amount < 0;
  const abs = Math.abs(amount);
  if (abs >= 10_000_000) {
    const v = abs / 10_000_000;
    const n = v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, "");
    return `${neg ? "-" : ""}${sym}${n}Cr`;
  }
  if (abs >= 100_000) {
    const v = abs / 100_000;
    const n = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "");
    return `${neg ? "-" : ""}${sym}${n}L`;
  }
  return formatMoney(amount, code);
}
