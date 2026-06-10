const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

export function formatMoney(value, currency, compact = true) {
  if (!Number.isFinite(value)) return "—";
  const prefix = currency === "usd" ? "$" : "";
  const suffix = currency === "ada" ? " ₳" : "";
  const formatted = compact
    ? compactFormatter.format(value)
    : integerFormatter.format(value);
  return `${prefix}${formatted}${suffix}`;
}

export function formatPrice(value, currency) {
  if (!Number.isFinite(value)) return "—";
  const prefix = currency === "usd" ? "$" : "";
  const suffix = currency === "ada" ? " ₳" : "";
  const absolute = Math.abs(value);
  let digits = 3;
  if (absolute < 1) digits = 5;
  if (absolute < 0.01) digits = 7;
  if (absolute < 0.0001) digits = 10;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: absolute > 0 && absolute < 0.01 ? Math.min(2, digits) : 0
  }).format(value);
  return `${prefix}${formatted}${suffix}`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 100 ? 0 : 2)}%`;
}

export function changeClass(value) {
  if (!Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function formatAge(timestamp, now = Date.now()) {
  if (!timestamp) return "—";
  const elapsed = Math.max(0, now - new Date(timestamp).getTime());
  const days = Math.floor(elapsed / 86_400_000);
  if (days < 1) return "<1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function formatUpdatedAt(timestamp) {
  if (!timestamp) return "Update time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(timestamp));
}

export function isSnapshotStale(timestamp, now = Date.now()) {
  if (!timestamp) return true;
  return now - new Date(timestamp).getTime() > 2 * 60 * 60 * 1000;
}
