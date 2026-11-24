const amountInput = document.querySelector("#amount");
const fromSelect = document.querySelector("#from-currency");
const toSelect = document.querySelector("#to-currency");
const form = document.querySelector("#converter-form");
const swapButton = document.querySelector("#swap-button");
const convertButton = document.querySelector("#convert-button");
const resultLabel = document.querySelector("#result-label");
const resultValue = document.querySelector("#result-value");
const rateNote = document.querySelector("#rate-note");
const statusMessage = document.querySelector("#status");
const ratesByBase = new Map();

async function loadRates(base) {
  if (ratesByBase.has(base)) {
    return ratesByBase.get(base);
  }

  const response = await fetch(`/api/rates?base=${encodeURIComponent(base)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to load live exchange rates.");
  }

  ratesByBase.set(base, data);
  return data;
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 4
  }).format(value);
}

function renderConversion(data) {
  const amountText = amountInput.value.trim();
  const amount = Number(amountText);
  const from = fromSelect.value;
  const to = toSelect.value;
  const rate = data.rates[to];

  if (amountText === "" || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate)) {
    resultValue.textContent = "Unable to convert this amount.";
    rateNote.textContent = "";
    return;
  }

  resultLabel.textContent = `${formatCurrency(amount, from)} equals`;
  resultValue.textContent = formatCurrency(amount * rate, to);
  rateNote.textContent = `1 ${from} = ${new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 7
  }).format(rate)} ${to}${data.updatedAt ? ` · Rates updated ${data.updatedAt}` : ""}`;
}

async function updateConversion() {
  statusMessage.textContent = "";
  resultValue.textContent = "Loading live rates…";

  try {
    const base = fromSelect.value;
    const data = await loadRates(base);
    if (base !== fromSelect.value) {
      return;
    }
    renderConversion(data);
  } catch (error) {
    resultValue.textContent = "Rates unavailable";
    rateNote.textContent = "";
    statusMessage.textContent = error.message;
  }
}

function populateCurrencies(currencies) {
  const options = currencies.map((currency) => {
    const option = document.createElement("option");
    option.value = currency;
    option.textContent = currency;
    return option;
  });

  for (const select of [fromSelect, toSelect]) {
    select.replaceChildren(...options.map((option) => option.cloneNode(true)));
  }
}

async function initialize() {
  try {
    const data = await loadRates("USD");
    const currencies = Object.keys(data.rates).sort();
    populateCurrencies(currencies);
    fromSelect.value = "USD";
    toSelect.value = currencies.includes("EUR") ? "EUR" : currencies[0];
    fromSelect.disabled = false;
    toSelect.disabled = false;
    swapButton.disabled = false;
    convertButton.disabled = false;
    renderConversion(data);
  } catch (error) {
    resultValue.textContent = "Rates unavailable";
    statusMessage.textContent = error.message;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateConversion();
});

fromSelect.addEventListener("change", updateConversion);
toSelect.addEventListener("change", updateConversion);
amountInput.addEventListener("input", updateConversion);

swapButton.addEventListener("click", () => {
  const previousFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = previousFrom;
  updateConversion();
});

initialize();
