const apiBase = String(window.RALEIGH_RENTER_CONFIG?.apiBase || "").replace(/\/$/, "");
const form = document.querySelector("#search-form");
const addressInput = document.querySelector("#address");
const formStatus = document.querySelector("#form-status");
const loading = document.querySelector("#loading");
const reportNode = document.querySelector("#report");
const suggestions = document.querySelector("#suggestions");
let currentReport;
let currentFilter = "all";
let map;
let debounce;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = addressInput.value.trim();
  if (address.length < 5) return showError("Enter a complete Raleigh street address.");
  await loadReport(address);
});

addressInput.addEventListener("input", () => {
  clearTimeout(debounce);
  hideSuggestions();
  if (addressInput.value.trim().length < 7) return;
  debounce = setTimeout(() => loadSuggestions(addressInput.value.trim()), 300);
});

document.querySelector("#new-search").addEventListener("click", () => {
  reportNode.hidden = true;
  addressInput.value = "";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  addressInput.focus();
});

async function loadSuggestions(query) {
  try {
    const response = await fetch(`${apiBase}/api/addresses?q=${encodeURIComponent(query)}`);
    if (!response.ok) return;
    const body = await response.json();
    suggestions.replaceChildren();
    for (const item of body.addresses || []) {
      const button = element("button", "suggestion", item.address);
      button.type = "button";
      button.addEventListener("click", () => {
        addressInput.value = item.address;
        hideSuggestions();
        addressInput.focus();
      });
      suggestions.append(button);
    }
    suggestions.hidden = !suggestions.childElementCount;
  } catch { hideSuggestions(); }
}

async function loadReport(address) {
  setBusy(true);
  showStatus("Checking five public-data systems. This can take about 15 seconds.");
  try {
    const response = await fetch(`${apiBase}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The report could not be generated.");
    currentReport = body;
    currentFilter = "all";
    renderReport(body);
    reportNode.hidden = false;
    reportNode.scrollIntoView({ behavior: "smooth", block: "start" });
    showStatus("");
  } catch (error) {
    showError(error.message || "The report could not be generated.");
  } finally {
    setBusy(false);
  }
}

function renderReport(report) {
  text("#report-title", report.property.address);
  const generated = new Date(report.generatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  text("#report-meta", `Generated ${generated} · ${report.cache?.hit ? "recent cached source snapshot" : "fresh source checks"}`);
  text("#summary-headline", report.summary.headline);
  renderOverview(report.summary.overview);
  renderQuestions(report.summary.questionsForLandlord);
  renderProperty(report.property);
  renderFilters(report.findings);
  renderFindings(report.findings);
  renderCaveats(report.summary.caveats);
  renderSources(report.sources);
  document.querySelector("#records-request-link").href = report.coverage.nextStepUrl;
  renderMap(report.property);
}

function renderOverview(items) {
  const node = document.querySelector("#summary-overview");
  node.replaceChildren(...items.map((item) => {
    const wrapper = element("div", "summary-item");
    wrapper.append(element("p", "", item.claim), evidenceList(item.evidenceIds));
    return wrapper;
  }));
}

function renderQuestions(items) {
  const node = document.querySelector("#landlord-questions");
  node.replaceChildren(...items.map((item, index) => {
    const wrapper = element("article", "question");
    wrapper.append(element("p", "", `${index + 1}. ${item.question}`), evidenceList(item.evidenceIds));
    return wrapper;
  }));
}

function renderProperty(property) {
  const parcel = property.parcel || {};
  const facts = [
    ["Parcel PIN", property.pin || "Not matched"],
    ["Jurisdiction", property.jurisdiction || "Not listed"],
    ["Property use", parcel.propertyUse || "Not listed"],
    ["Year built", parcel.yearBuilt || "Not listed"],
    ["Units", parcel.units || "Not listed"],
    ["Match", "Wake address point + parcel"],
  ];
  const dl = document.querySelector("#property-facts");
  dl.replaceChildren(...facts.map(([label, value]) => {
    const wrapper = element("div", "fact");
    wrapper.append(element("dt", "", label), element("dd", "", String(value)));
    return wrapper;
  }));
}

function renderFilters(findings) {
  const labels = new Map([
    ["all", "All records"], ["complaint_or_request", "Service requests"], ["permit_record", "Permits"],
    ["reported_incident", "Nearby incidents"], ["environmental_context", "Flood context"], ["property_record", "Parcel"],
  ]);
  const present = new Set(findings.map((item) => item.classification));
  const node = document.querySelector("#finding-filters");
  node.replaceChildren(...[...labels.entries()].filter(([key]) => key === "all" || present.has(key)).map(([key, label]) => {
    const count = key === "all" ? findings.length : findings.filter((item) => item.classification === key).length;
    const button = element("button", "filter-button", `${label} (${count})`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(currentFilter === key));
    button.addEventListener("click", () => {
      currentFilter = key;
      renderFilters(findings);
      renderFindings(findings);
    });
    return button;
  }));
}

function renderFindings(findings) {
  const labels = {
    complaint_or_request: "Complaint / request", permit_record: "Permit record", reported_incident: "Reported incident",
    environmental_context: "Environmental context", property_record: "Property record",
  };
  const visible = currentFilter === "all" ? findings : findings.filter((item) => item.classification === currentFilter);
  const node = document.querySelector("#findings");
  if (!visible.length) return node.replaceChildren(element("div", "empty-state", "No records in this category were returned by the checked sources."));
  node.replaceChildren(...visible.map((item) => {
    const card = element("article", "finding");
    card.dataset.level = item.level;
    const middle = element("div");
    middle.append(element("h4", "", item.title), element("p", "", item.detail));
    const meta = element("div", "finding-meta");
    if (item.date) meta.append(element("span", "", new Date(item.date).toLocaleDateString()));
    const link = element("a", "", "Official source ↗");
    link.href = item.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    meta.append(link);
    card.append(element("div", "finding-type", `${labels[item.classification] || item.classification}\n${scopeLabel(item.scope)}`), middle, meta);
    card.id = item.id;
    return card;
  }));
}

function renderCaveats(caveats) {
  const node = document.querySelector("#caveats");
  node.replaceChildren(...caveats.map((caveat) => element("p", "caveat", `• ${caveat}`)));
}

function renderSources(sources) {
  const node = document.querySelector("#sources");
  node.replaceChildren(...sources.map((source) => {
    const wrapper = element("article", "source");
    const name = element("div");
    const link = element("a", "", source.name);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener";
    const heading = element("h4");
    heading.append(link);
    name.append(heading, element("p", "", `${source.scope}. ${source.cadence}.`));
    const method = element("div");
    method.append(element("p", "", source.matchMethod || "Source was not queried."), element("p", "", `Checked ${new Date(source.retrievedAt).toLocaleString()}`));
    const status = element("div", `source-status ${source.status}`, source.status === "ok" ? `Available · ${source.recordCount} record${source.recordCount === 1 ? "" : "s"}` : "Unavailable");
    wrapper.append(name, method, status);
    return wrapper;
  }));
}

function renderMap(property) {
  if (!window.L || !Number.isFinite(property.latitude) || !Number.isFinite(property.longitude)) return;
  if (map) map.remove();
  map = window.L.map("map", { scrollWheelZoom: false }).setView([property.latitude, property.longitude], 15);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  window.L.circle([property.latitude, property.longitude], { radius: 402.336, color: "#ff5600", weight: 2, fillOpacity: .06 }).addTo(map);
  window.L.marker([property.latitude, property.longitude]).addTo(map).bindPopup(property.address).openPopup();
  setTimeout(() => map.invalidateSize(), 50);
}

function evidenceList(ids = []) {
  const node = element("div", "evidence-links");
  if (!ids.length) return node;
  node.append(document.createTextNode("Evidence: "));
  ids.forEach((id, index) => {
    const link = element("a", "", id);
    link.href = `#${id}`;
    node.append(link, document.createTextNode(index === ids.length - 1 ? "" : ", "));
  });
  return node;
}

function scopeLabel(scope) {
  return ({ parcel: "Parcel match", address: "Address match", within_40_meters: "Within 40 m", within_quarter_mile: "Within 0.25 mi", address_point: "Address point" })[scope] || scope;
}

function element(tag, className = "", content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function text(selector, value) { document.querySelector(selector).textContent = value || ""; }
function hideSuggestions() { suggestions.hidden = true; suggestions.replaceChildren(); }
function showStatus(message) { formStatus.textContent = message; formStatus.className = "form-status"; }
function showError(message) { formStatus.textContent = message; formStatus.className = "form-status error"; }
function setBusy(busy) {
  form.querySelector("button[type=submit]").disabled = busy;
  addressInput.disabled = busy;
  loading.hidden = !busy;
  if (busy) reportNode.hidden = true;
}
