const SHEET_CONFIG = {
  spreadsheetId: "1bd5sRygfzwo43tjDhJIJEiUN7mgMQv9m-WZo0WHpdh4",
  sheetName: "車輛資料",
};

const FIELD_ALIASES = {
  "sid": ["sid", "SID"],
  "車號": ["車號", "車牌", "牌照", "carnum"],
  "品牌": ["品牌", "brand"],
  "車型": ["車型", "型號", "type"],
  "年份": ["年份", "年式", "yaer"],
  "排氣量": ["排氣量", "cc"],
  "顏色": ["顏色", "c"],
  "里程數": ["里程數", "里程", "miles"],
  "一手車": ["一手車", "是否一手車", "首手車", "fhand"],
  "車況": ["車況", "sl"],
  "車況備注": ["車況備注", "車況備註", "備注", "備註", "note"],
  "車輛照片": ["車輛照片", "照片", "圖片", "照片網址", "圖片網址", "imageweb"],
  "售價": ["售價", "價格", "op"],
  "發票": ["發票", "F", "ticket"],
  "買進日": ["買進日", "已買進日", "購入日", "indate"],
  "來源": ["來源", "資料來源", "source"],
  "8891": ["8891", "8891編號", "elseweb"],
  "線上購": ["線上購", "onbuy"],
};

const RESPONSE_FIELDS = Object.keys(FIELD_ALIASES);

function doGet() {
  try {
    const rows = getSheetRows_();
    return jsonResponse_({ success: true, rows: rows, count: rows.length });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      success: false,
      message: error.message,
      rows: [],
      count: 0,
    });
  }
}

// 接收庫存程式的 { action, sid, carNo, data }。
function doPost(e) {
  let lock;
  let locked = false;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("請透過 HTTP POST 傳入 JSON，不要直接在編輯器執行 doPost。");
    }
    const payload = JSON.parse(e.postData.contents);
    const action = String(payload.action || "").trim().toLowerCase();
    if (["create", "update", "delete"].indexOf(action) === -1) {
      throw new Error("不支援的 action，請使用 create、update 或 delete。");
    }

    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    locked = true;

    const sheet = getSheet_();
    const headers = ensureHeaders_(sheet);
    const data = normalizeInput_(payload.data || {});
    const sid = cleanValue_(payload.sid) || cleanValue_(data.sid);
    const carNo = cleanValue_(payload.carNo) || cleanValue_(payload.carnum) || cleanValue_(data["車號"]);
    if (!sid && !carNo) {
      throw new Error("缺少 sid 或車號，無法辨識車輛。");
    }

    const rowNumber = findVehicleRow_(sheet, headers, sid, carNo);
    if (action === "delete") {
      if (rowNumber) sheet.deleteRow(rowNumber);
      return jsonResponse_({ success: true, deleted: Boolean(rowNumber), sid: sid });
    }

    if (sid) data.sid = sid;
    if (!Object.prototype.hasOwnProperty.call(data, "車號") && carNo) {
      data["車號"] = carNo;
    }
    if (!rowNumber && !cleanValue_(data["車號"])) {
      throw new Error("新增車輛時必須提供車號。");
    }

    // 更新只寫入有傳入的欄位，避免舊程式把其他欄位清空。
    const targetRow = rowNumber || sheet.getLastRow() + 1;
    const isNew = !rowNumber;
    if (isNew && !Object.prototype.hasOwnProperty.call(data, "線上購")) {
      data["線上購"] = "1";
    }
    writeFields_(sheet, headers, targetRow, data);
    SpreadsheetApp.flush();
    return jsonResponse_({
      success: true,
      created: isNew,
      sid: sid,
      row: readVehicleRow_(sheet, headers, targetRow),
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ success: false, message: error.message });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function getSheet_() {
  const sheet = SpreadsheetApp.openById(SHEET_CONFIG.spreadsheetId)
    .getSheetByName(SHEET_CONFIG.sheetName);
  if (!sheet) throw new Error("找不到指定的工作表：" + SHEET_CONFIG.sheetName);
  return sheet;
}

function getSheetRows_() {
  const values = getSheet_().getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(cleanValue_);
  return values.slice(1).map(function(row) {
    return normalizeOutput_(rowObject_(headers, row));
  }).filter(function(row) {
    return row["車號"] || row["品牌"] || row["車型"];
  });
}

function cleanValue_(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeOnlinePurchase_(value) {
  const text = cleanValue_(value).toUpperCase();
  return ["0", "FALSE", "不可"].indexOf(text) >= 0 ? "0" : "1";
}

function pickValue_(row, field) {
  const aliases = FIELD_ALIASES[field] || [field];
  for (let i = 0; i < aliases.length; i += 1) {
    const value = cleanValue_(row[aliases[i]]);
    if (value !== "") return value;
  }
  return "";
}

function normalizeOutput_(row) {
  const normalized = {};
  RESPONSE_FIELDS.forEach(function(field) {
    const value = pickValue_(row, field);
    normalized[field] = field === "線上購" ? normalizeOnlinePurchase_(value) : value;
  });
  return normalized;
}

function normalizeInput_(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("data 必須是 JSON 物件。");
  }
  const normalized = {};
  RESPONSE_FIELDS.forEach(function(field) {
    const aliases = FIELD_ALIASES[field];
    for (let i = 0; i < aliases.length; i += 1) {
      const key = aliases[i];
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        normalized[field] = field === "線上購"
          ? normalizeOnlinePurchase_(input[key]) : cleanValue_(input[key]);
        break;
      }
    }
  });
  return normalized;
}

function canonicalField_(header) {
  for (let i = 0; i < RESPONSE_FIELDS.length; i += 1) {
    const field = RESPONSE_FIELDS[i];
    if (FIELD_ALIASES[field].indexOf(header) >= 0) return field;
  }
  return "";
}

function ensureHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(cleanValue_) : [];
  RESPONSE_FIELDS.forEach(function(field) {
    if (!headers.some(function(header) { return canonicalField_(header) === field; })) {
      headers.push(field);
      sheet.getRange(1, headers.length).setValue(field);
    }
  });
  return headers;
}

function rowObject_(headers, values) {
  const row = {};
  headers.forEach(function(header, index) { row[header] = cleanValue_(values[index]); });
  return row;
}

function findVehicleRow_(sheet, headers, sid, carNo) {
  if (sheet.getLastRow() < 2) return 0;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
  let legacyPlateRow = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rowObject_(headers, rows[i]);
    const rowSid = pickValue_(row, "sid");
    if (sid && rowSid === sid) return i + 2;
    if (carNo && pickValue_(row, "車號").toUpperCase() === carNo.toUpperCase()) {
      // 有 sid 時，只補接尚未填 sid 的舊資料，避免誤更新同車號的其他紀錄。
      if (!sid) return i + 2;
      if (!rowSid) legacyPlateRow = i + 2;
    }
  }
  return legacyPlateRow;
}

function writeFields_(sheet, headers, rowNumber, data) {
  if (rowNumber > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowNumber - sheet.getMaxRows());
  }
  let start = 0;
  let values = [];
  function flush() {
    if (!values.length) return;
    sheet.getRange(rowNumber, start + 1, 1, values.length)
      .setNumberFormat("@").setValues([values]);
    values = [];
  }
  headers.forEach(function(header, index) {
    const field = canonicalField_(header);
    if (field && Object.prototype.hasOwnProperty.call(data, field)) {
      // 合併連續欄位寫入，並以文字保留 2.0、年/月及編號格式。
      if (!values.length) start = index;
      values.push(data[field]);
    } else flush();
  });
  flush();
}

function readVehicleRow_(sheet, headers, rowNumber) {
  const values = sheet.getRange(rowNumber, 1, 1, headers.length).getDisplayValues()[0];
  return normalizeOutput_(rowObject_(headers, values));
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
