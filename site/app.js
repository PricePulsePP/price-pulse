import {
  changeClass,
  formatMoney,
  formatPercent,
  formatPrice,
  formatUpdatedAt,
  isSnapshotStale
} from "./format.mjs";

const state = {
  currency: localStorage.getItem("pp-currency") === "usd" ? "usd" : "ada",
  snapshot: globalThis.__PRICE_PULSE_MARKET__ ?? null
};

const body = document.querySelector("#market-body");
const updatedAt = document.querySelector("#updated-at");
const statusLabel = document.querySelector("#status-label");
const statusDot = document.querySelector("#status-dot");
const currencyButtons = [...document.querySelectorAll("[data-currency]")];
const refreshIntervalMs = 5 * 60 * 1000;

currencyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.currency = button.dataset.currency;
    localStorage.setItem("pp-currency", state.currency);
    updateCurrencyControls();
    renderRows();
  });
});

updateCurrencyControls();
if (state.snapshot) {
  renderStatus();
  renderRows();
}
loadMarket({ quiet: Boolean(state.snapshot) });
setInterval(() => loadMarket({ quiet: true }), refreshIntervalMs);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadMarket({ quiet: true });
  }
});

async function loadMarket({ quiet = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`./market.json?refresh=${Date.now()}`, {
      cache: "no-cache",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Market request returned ${response.status}`);
    const snapshot = await response.json();
    if (
      state.snapshot &&
      new Date(snapshot.generatedAt).getTime() <= new Date(state.snapshot.generatedAt).getTime()
    ) {
      renderStatus();
      return;
    }
    state.snapshot = snapshot;
    renderStatus();
    renderRows();
  } catch (error) {
    if (quiet && state.snapshot) {
      renderStatus();
      console.error(error);
      return;
    }
    statusDot.classList.add("error");
    statusLabel.textContent = "Snapshot unavailable";
    updatedAt.textContent = "Try again shortly";
    body.innerHTML = `<tr class="loading-row"><td colspan="10"><div class="empty-state">Market data is temporarily unavailable.</div></td></tr>`;
    console.error(error);
  } finally {
    clearTimeout(timeout);
  }
}

function renderStatus() {
  const { generatedAt } = state.snapshot;
  const stale = isSnapshotStale(generatedAt);

  updatedAt.textContent = formatUpdatedAt(generatedAt);
  statusLabel.textContent = stale ? "Update delayed" : "Updated hourly";
  statusDot.classList.toggle("stale", stale);
}

function renderRows() {
  if (!state.snapshot) return;
  body.innerHTML = state.snapshot.tokens.map(renderRow).join("");
}

function renderRow(token) {
  const currency = state.currency;
  return `
    <tr>
      <td class="rank-column" data-label="Rank"><span class="rank">${token.rank ?? "—"}</span></td>
      <td class="token-column">
        <div class="token">
          ${renderLogo(token)}
          <div class="token-copy">
            <strong>${escapeHtml(token.symbol)}</strong>
            <span>${escapeHtml(token.name)}</span>
          </div>
        </div>
      </td>
      <td class="numeric price-cell" data-label="Price">${formatPrice(token.price?.[currency], currency)}</td>
      ${renderChange(token.change?.h24, "24h")}
      ${renderChange(token.change?.h1, "1h")}
      <td class="numeric emphasis" data-label="Market Cap">${formatMoney(token.marketCap?.[currency], currency)}</td>
      <td class="numeric" data-label="Volume">${formatMoney(token.volume24h?.[currency], currency)}</td>
      <td class="numeric" data-label="Liquidity">${formatMoney(token.liquidity?.[currency], currency)}</td>
      <td class="numeric" data-label="FDV">${formatMoney(token.fdv?.[currency], currency)}</td>
      <td class="numeric" data-label="Txns">${formatInteger(token.transactions24h)}</td>
    </tr>
  `;
}

function renderLogo(token) {
  if (token.imageUrl) {
    const safeUrl = escapeAttribute(token.imageUrl);
    return `<span class="token-logo"><img src="${safeUrl}" alt="" loading="lazy" onerror="this.parentElement.textContent='${escapeAttribute(token.symbol.slice(0, 2))}'"></span>`;
  }
  return `<span class="token-logo fallback">${escapeHtml(token.symbol.slice(0, 2))}</span>`;
}

function renderChange(value, label) {
  return `<td class="numeric" data-label="${label}"><span class="change ${changeClass(value)}">${formatPercent(value)}</span></td>`;
}

function formatInteger(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function updateCurrencyControls() {
  currencyButtons.forEach((button) => {
    const active = button.dataset.currency === state.currency;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
