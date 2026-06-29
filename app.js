const API_CONFIG = {
  // 填入 Apps Script Web App URL。
  // 例如: https://script.google.com/macros/s/xxxxx/exec
  apiUrl: "https://script.google.com/macros/s/AKfycbzsZXg330Ic7VlcJ_RdUePkf3QJ9zmYtbablsKN6hId00mmwUa_pRtH7KMo4R4JGKBMUw/exec",
};

const SAMPLE_ROWS = [
  {
    車號: "ABC-1234",
    品牌: "TOYOTA",
    車型: "ALTIS",
    年份: "20/04",
    排氣量: "1.8",
    顏色: "白",
    里程數: "1.9",
    一手車: "Y",
    車況: "A",
    車況備注: "原鈑件，定保完整",
    車輛照片: "https://example.com/car-1",
    售價: "35.8萬",
    發票: "有",
  },
  {
    車號: "BDE-7788",
    品牌: "HONDA",
    車型: "CR-V",
    年份: "21/06",
    排氣量: "1.5T",
    顏色: "黑",
    里程數: "2.9",
    一手車: "N",
    車況: "A",
    車況備注: "一手車，配備齊全",
    車輛照片: "https://example.com/car-2",
    售價: "69.8萬",
    發票: "有",
  },
  {
    車號: "KLM-2456",
    品牌: "MAZDA",
    車型: "MAZDA3",
    年份: "19/03",
    排氣量: "2.0",
    顏色: "魂動紅",
    里程數: "3.8",
    一手車: "N",
    車況: "B",
    車況備注: "前保桿小傷，已整理",
    車輛照片: "https://example.com/car-3",
    售價: "42.5萬",
    發票: "無",
  },
  {
    車號: "PLQ-9001",
    品牌: "BMW",
    車型: "320i",
    年份: "18/11",
    排氣量: "2.0",
    顏色: "灰",
    里程數: "4.2",
    一手車: "Y",
    車況: "B",
    車況備注: "里程透明，可第三方鑑定",
    車輛照片: "https://example.com/car-4",
    售價: "56.8萬",
    發票: "有",
  },
];

const FIELD_ORDER = [
  "車號",
  "品牌",
  "車型",
  "年份",
  "排氣量",
  "顏色",
  "里程數",
  "一手車",
  "車況",
  "車況備注",
  "車輛照片",
  "售價",
  "發票",
];

const dom = {
  plateInput: document.querySelector("#plateInput"),
  brandSelect: document.querySelector("#brandSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  yearSelect: document.querySelector("#yearSelect"),
  resetFilters: document.querySelector("#resetFilters"),
  statusMessage: document.querySelector("#statusMessage"),
  resultSummary: document.querySelector("#resultSummary"),
  mobileResults: document.querySelector("#mobileResults"),
  tableBody: document.querySelector("#tableBody"),
};

const state = {
  rows: [],
  filteredRows: [],
  filters: {
    plate: "",
    brand: "",
    model: "",
    year: "",
  },
};

bootstrap();

async function bootstrap() {
  bindEvents();
  try {
    const rows = await loadRows();
    state.rows = normalizeRows(rows);
    setStatus(`資料已載入，共 ${state.rows.length} 筆。`);
  } catch (error) {
    console.error(error);
    state.rows = normalizeRows(SAMPLE_ROWS);
    setStatus("Apps Script API 讀取失敗，已改用示範資料預覽版型。");
  }

  syncFilterOptions();
  applyFilters();
}

function bindEvents() {
  dom.plateInput.addEventListener("input", (event) => {
    state.filters.plate = event.target.value.trim().toUpperCase();
    applyFilters();
  });

  dom.brandSelect.addEventListener("change", (event) => {
    state.filters.brand = event.target.value;
    state.filters.model = "";
    state.filters.year = "";
    syncFilterOptions();
    applyFilters();
  });

  dom.modelSelect.addEventListener("change", (event) => {
    state.filters.model = event.target.value;
    state.filters.year = "";
    syncFilterOptions();
    applyFilters();
  });

  dom.yearSelect.addEventListener("change", (event) => {
    state.filters.year = event.target.value;
    applyFilters();
  });

  dom.resetFilters.addEventListener("click", () => {
    state.filters = { plate: "", brand: "", model: "", year: "" };
    dom.plateInput.value = "";
    syncFilterOptions();
    applyFilters();
  });
}

async function loadRows() {
  if (!API_CONFIG.apiUrl) {
    return SAMPLE_ROWS;
  }

  const response = await fetch(API_CONFIG.apiUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.rows)) {
    throw new Error("API response format is invalid.");
  }

  return payload.rows;
}

function normalizeRows(rows) {
  return rows
    .map((row) => {
      return {
        車號: getFirstValue(row, ["車號", "車牌", "牌照"]) || "-",
        品牌: getFirstValue(row, ["品牌"]) || "-",
        車型: getFirstValue(row, ["車型", "型號"]) || "-",
        年份: getFirstValue(row, ["年份", "年式"]) || "-",
        排氣量: getFirstValue(row, ["排氣量", "cc"]) || "-",
        顏色: getFirstValue(row, ["顏色"]) || "-",
        里程數: getFirstValue(row, ["里程數", "里程"]) || "-",
        一手車: normalizeOwnership(getFirstValue(row, ["一手車", "是否一手車", "首手車"])) || "-",
        車況: getFirstValue(row, ["車況"]) || "-",
        車況備注: getFirstValue(row, ["車況備注", "車況備註", "備注", "備註"]) || "-",
        車輛照片: getFirstValue(row, ["車輛照片", "照片", "圖片", "照片網址", "圖片網址"]) || "-",
        售價: getFirstValue(row, ["售價", "價格"]) || "-",
        發票: getFirstValue(row, ["發票", "F"]) || "-",
      };
    })
    .filter((row) => row.車號 !== "-" || row.品牌 !== "-" || row.車型 !== "-");
}

function getFirstValue(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function normalizeOwnership(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "Y" || normalized === "N") {
    return normalized;
  }
  return normalized;
}

function syncFilterOptions() {
  const brands = uniqueValues(state.rows, "品牌");
  const models = uniqueValues(
    state.rows.filter((row) => !state.filters.brand || row.品牌 === state.filters.brand),
    "車型"
  );
  const years = uniqueValues(
    state.rows.filter(
      (row) =>
        (!state.filters.brand || row.品牌 === state.filters.brand) &&
        (!state.filters.model || row.車型 === state.filters.model)
    ),
    "年份"
  );

  fillSelect(dom.brandSelect, brands, "全部品牌", state.filters.brand);
  fillSelect(dom.modelSelect, models, "全部車型", state.filters.model);
  fillSelect(dom.yearSelect, years, "全部年份", state.filters.year);

  dom.modelSelect.disabled = models.length === 0;
  dom.yearSelect.disabled = years.length === 0;
}

function fillSelect(select, values, defaultLabel, selectedValue) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selectedValue;
    select.append(option);
  });
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value && value !== "-"))].sort(
    (a, b) => a.localeCompare(b, "zh-Hant")
  );
}

function applyFilters() {
  state.filteredRows = state.rows.filter((row) => {
    const byPlate = !state.filters.plate || row.車號.toUpperCase().includes(state.filters.plate);
    const byBrand = !state.filters.brand || row.品牌 === state.filters.brand;
    const byModel = !state.filters.model || row.車型 === state.filters.model;
    const byYear = !state.filters.year || row.年份 === state.filters.year;
    return byPlate && byBrand && byModel && byYear;
  });

  renderResults();
}

function renderResults() {
  dom.resultSummary.textContent = `共 ${state.filteredRows.length} 筆資料`;

  if (state.filteredRows.length === 0) {
    dom.mobileResults.innerHTML = '<div class="empty-state">查無符合條件的車輛資料</div>';
    dom.tableBody.innerHTML = '<tr><td colspan="13">查無符合條件的車輛資料</td></tr>';
    return;
  }

  dom.mobileResults.innerHTML = state.filteredRows.map(renderMobileCard).join("");
  dom.tableBody.innerHTML = state.filteredRows.map(renderTableRow).join("");
}

function renderMobileCard(row) {
  return `
    <article class="result-card">
      <div class="result-card__head">
        <div>
          <h3 class="result-card__title">${escapeHtml(row.車號)}</h3>
          <p class="result-card__subtitle">${escapeHtml(row.品牌)} / ${escapeHtml(row.車型)} / ${escapeHtml(row.年份)}</p>
        </div>
        <div class="price-chip">
          <span>售價</span>
          <strong>${escapeHtml(row.售價)}</strong>
        </div>
      </div>
      <div class="result-card__grid">
        ${FIELD_ORDER.map((field) => renderMetaItem(field, row[field], field === "車況備注")).join("")}
      </div>
    </article>
  `;
}

function renderMetaItem(label, value, isFull) {
  if (label === "車輛照片") {
    return `
      <div class="meta-item ${isFull ? "meta-item--full" : ""}">
        <span class="meta-item__label">${escapeHtml(label)}</span>
        ${renderPhotoLink(value)}
      </div>
    `;
  }

  return `
    <div class="meta-item ${isFull ? "meta-item--full" : ""}">
      <span class="meta-item__label">${escapeHtml(label)}</span>
      <span class="meta-item__value ${statusClass(label, value)}">${escapeHtml(value || "-")}</span>
    </div>
  `;
}

function renderTableRow(row) {
  return `
    <tr>
      ${FIELD_ORDER.map((field) => `<td class="${statusClass(field, row[field])}">${renderTableCell(field, row[field])}</td>`).join("")}
    </tr>
  `;
}

function renderTableCell(label, value) {
  if (label === "車輛照片") {
    return renderPhotoLink(value);
  }
  return escapeHtml(value || "-");
}

function renderPhotoLink(value) {
  if (!value || value === "-") {
    return '<span class="photo-link photo-link--empty">-</span>';
  }

  const safeUrl = escapeAttribute(value);
  return `<a class="photo-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">查看照片</a>`;
}

function statusClass(label, value) {
  if (label === "車況" && /^A$/i.test(String(value || ""))) {
    return "tag-ok";
  }
  if (label === "車況" && /^B$/i.test(String(value || ""))) {
    return "tag-warn";
  }
  return "";
}

function setStatus(message) {
  dom.statusMessage.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
