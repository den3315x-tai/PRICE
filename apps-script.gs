const SHEET_CONFIG = {
  spreadsheetId: "請填入你的 Google 試算表 ID",
  sheetName: "車輛資料",
  allowedOrigin: "*",
};

const RESPONSE_FIELDS = [
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

function doGet() {
  const data = getSheetRows_();
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      rows: data,
      count: data.length,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function getSheetRows_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SHEET_CONFIG.sheetName);

  if (!sheet) {
    throw new Error("找不到指定的工作表: " + SHEET_CONFIG.sheetName);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(String);
  const rows = values.slice(1);

  return rows
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        item[header] = row[index] || "";
      });

      const normalized = {};
      RESPONSE_FIELDS.forEach(function(field) {
        normalized[field] = pickFirstValue_(item, field);
      });

      return normalized;
    })
    .filter(function(item) {
      return item["車號"] || item["品牌"] || item["車型"];
    });
}

function pickFirstValue_(row, field) {
  const aliasMap = {
    "車號": ["車號", "車牌", "牌照"],
    "品牌": ["品牌"],
    "車型": ["車型", "型號"],
    "年份": ["年份", "年式"],
    "排氣量": ["排氣量", "cc"],
    "顏色": ["顏色"],
    "里程數": ["里程數", "里程"],
    "一手車": ["一手車", "是否一手車", "首手車"],
    "車況": ["車況"],
    "車況備注": ["車況備注", "車況備註", "備注", "備註"],
    "車輛照片": ["車輛照片", "照片", "圖片", "照片網址", "圖片網址"],
    "售價": ["售價", "價格"],
    "發票": ["發票", "F"],
  };

  const aliases = aliasMap[field] || [field];

  for (var i = 0; i < aliases.length; i += 1) {
    var key = aliases[i];
    if (row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }

  return "";
}
