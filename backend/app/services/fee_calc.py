"""Fee amount helpers (yearly totals from frequency)."""


def yearly_from_amount(amount: float, frequency: str | None) -> float:
    f = (frequency or "Monthly").strip().lower().replace("-", " ")
    if f in ("monthly",):
        return round(amount * 12, 2)
    if f in ("quarterly",):
        return round(amount * 4, 2)
    if f in ("yearly", "one time", "one_time", "on demand", "on_demand", "penalty"):
        return round(amount, 2)
    return round(amount * 12, 2)


def structure_annual_total(components: list) -> float:
    total = 0.0
    for c in components:
        amt = float(getattr(c, "amount", 0) or 0)
        freq = getattr(c, "frequency", None)
        disc = float(getattr(c, "discount", 0) or 0)
        yearly = yearly_from_amount(amt, freq)
        total += yearly * (1 - disc / 100)
    return round(total, 2)


def monthly_display_total(components: list) -> float:
    """Sum of line amounts where frequency is Monthly (for class list subtitle)."""
    total = 0.0
    for c in components:
        freq = (getattr(c, "frequency", None) or "Monthly").strip().lower()
        if freq.replace("-", " ") in ("monthly",):
            amt = float(getattr(c, "amount", 0) or 0)
            total += amt
    return round(total, 2)
