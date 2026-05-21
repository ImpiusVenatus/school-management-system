"""Supported school currencies (ISO 4217 codes)."""

DEFAULT_CURRENCY_CODE = "BDT"

CURRENCIES: dict[str, dict[str, str]] = {
    "BDT": {"symbol": "৳", "name": "Bangladeshi Taka", "locale": "en-BD"},
    "INR": {"symbol": "₹", "name": "Indian Rupee", "locale": "en-IN"},
    "USD": {"symbol": "$", "name": "US Dollar", "locale": "en-US"},
    "EUR": {"symbol": "€", "name": "Euro", "locale": "de-DE"},
    "GBP": {"symbol": "£", "name": "British Pound", "locale": "en-GB"},
    "AED": {"symbol": "د.إ", "name": "UAE Dirham", "locale": "ar-AE"},
    "SAR": {"symbol": "﷼", "name": "Saudi Riyal", "locale": "ar-SA"},
    "PKR": {"symbol": "₨", "name": "Pakistani Rupee", "locale": "en-PK"},
    "NPR": {"symbol": "रू", "name": "Nepalese Rupee", "locale": "ne-NP"},
    "LKR": {"symbol": "Rs", "name": "Sri Lankan Rupee", "locale": "si-LK"},
    "MYR": {"symbol": "RM", "name": "Malaysian Ringgit", "locale": "ms-MY"},
    "SGD": {"symbol": "S$", "name": "Singapore Dollar", "locale": "en-SG"},
    "AUD": {"symbol": "A$", "name": "Australian Dollar", "locale": "en-AU"},
    "CAD": {"symbol": "C$", "name": "Canadian Dollar", "locale": "en-CA"},
    "CNY": {"symbol": "¥", "name": "Chinese Yuan", "locale": "zh-CN"},
    "JPY": {"symbol": "¥", "name": "Japanese Yen", "locale": "ja-JP"},
    "QAR": {"symbol": "QR", "name": "Qatari Riyal", "locale": "ar-QA"},
    "KWD": {"symbol": "KD", "name": "Kuwaiti Dinar", "locale": "ar-KW"},
    "OMR": {"symbol": "OMR", "name": "Omani Rial", "locale": "ar-OM"},
}


def normalize_currency_code(code: str | None) -> str:
    c = (code or DEFAULT_CURRENCY_CODE).strip().upper()
    return c if c in CURRENCIES else DEFAULT_CURRENCY_CODE


def currency_choices() -> list[dict[str, str]]:
    return [
        {"code": code, "symbol": meta["symbol"], "name": meta["name"]}
        for code, meta in sorted(CURRENCIES.items(), key=lambda x: (x[0] != DEFAULT_CURRENCY_CODE, x[1]["name"]))
    ]
