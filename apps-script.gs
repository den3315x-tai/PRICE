const SHEET_CONFIG = {
  spreadsheetId: "1bd5sRygfzwo43tjDhJIJEiUN7mgMQv9m-WZo0WHpdh4",
  sheetName: "車輛資料",
};

const FIELDS = {
  sid: "sid",
  carNo: "車號",
  brand: "品牌",
  type: "車型",
  year: "年份",
  cc: "排氣量",
  color: "顏色",
  miles: "里程數",
  firstHand: "一手車",
  condition: "車況",
  conditionNote: "車況備注",
  image: "車輛照片",
  price: "售價",
  ticket: "發票",
  purchaseDate: "買進日",
  source: "來源",
  number8891: "8891",
  onlinePurchase: "線上購",
};

const FIELD_ORDER = [
  FIELDS.sid,
  FIELDS.carNo,
  FIELDS.brand,
  FIELDS.type,
  FIELDS.year,
  FIELDS.cc,
  FIELDS.color,
  FIELDS.miles,
  FIELDS.firstHand,
  FIELDS.condition,
  FIELDS.conditionNote,
  FIELDS.image,
  FIELDS.price,
  FIELDS.ticket,
  FIELDS.purchaseDate,
  FIELDS.source,
  FIELDS.number8891,
  FIELDS.onlinePurchase,
];

/*
 * 唯讀資料查詢
 * 提供外部車價查詢網站讀取資料。
 */
function doGet() {
  try {
    const rows = getSheetRows_();

    return jsonOutput_({
      success: true,
      rows: rows,
      count: rows.length,
    });
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: getErrorMessage_(error),
      rows: [],
      count: 0,
    });
  }
}

/*
 * 新增、修改、刪除資料入口
 *
 * action=create：新增資料
 * action=update：修改資料
 * action=delete：刪除資料
 */
function doPost(e) {
  try {
    const payload = parseRequestBody_(e);
    const action = cleanValue_(payload.action).toLowerCase();

    if (!action) {
      throw new Error("缺少 action 參數。");
    }

    if (action === "create") {
      const result = withWriteLock_(function() {
        return createRow_(payload.data || {});
      });

      return jsonOutput_({
        success: true,
        message: result.created ? "新增成功。" : "資料已存在，已更新。",
        created: result.created,
        row: result.row,
      });
    }

    if (action === "update") {
      const result = withWriteLock_(function() {
        return updateRow_(payload);
      });

      return jsonOutput_({
        success: true,
        message: result.created ? "找不到原資料，已新增。" : "更新成功。",
        created: result.created,
        row: result.row,
      });
    }

    if (action === "delete") {
      const result = withWriteLock_(function() {
        return deleteRow_(payload);
      });

      return jsonOutput_({
        success: true,
        message: result ? "刪除成功。" : "找不到資料，未執行刪除。",
        deleted: Boolean(result),
        row: result,
      });
    }

    throw new Error("不支援的 action：" + action);
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: getErrorMessage_(error),
    });
  }
}

/*
 * 讀取全部資料。
 */
function getSheetRows_() {
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, headers.length)
    .getDisplayValues();

  return values
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        item[header] = cleanValue_(row[index]);
      });

      return normalizeRow_(item);
    })
    .filter(function(item) {
      return Boolean(
        item[FIELDS.sid] ||
        item[FIELDS.carNo] ||
        item[FIELDS.brand] ||
        item[FIELDS.type]
      );
    });
}

/*
 * 新增資料。
 *
 * 如果相同 sid 已存在，改成更新原資料，
 * 避免網路重送造成同一筆資料重複新增。
 */
function createRow_(data) {
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet);
  const normalized = normalizeRow_(data);

  const sid = normalizeSid_(normalized[FIELDS.sid]);
  const carNo = normalizeCarNo_(normalized[FIELDS.carNo]);

  if (!sid) {
    throw new Error("新增失敗：缺少 sid。");
  }

  if (!carNo) {
    throw new Error("新增失敗：缺少車號。");
  }

  let rowIndex = findRowIndexBySid_(sheet, sid);

  if (rowIndex < 2) {
    rowIndex = findRowIndexByCarNo_(sheet, carNo);
  }

  if (rowIndex >= 2) {
    writeRow_(sheet, headers, rowIndex, normalized);

    return {
      created: false,
      row: normalized,
    };
  }

  const row = headers.map(function(header) {
    return normalized[header] || "";
  });

  sheet.appendRow(row);
  SpreadsheetApp.flush();

  return {
    created: true,
    row: normalized,
  };
}

/*
 * 修改資料。
 *
 * 優先使用 sid 尋找，找不到時再使用車號。
 * 如果兩者都找不到，會新增成一筆新資料。
 */
function updateRow_(payload) {
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet);
  const normalized = normalizeRow_(payload.data || {});

  const requestedSid = getRequestedSid_(payload);
  const requestedCarNo = getRequestedCarNo_(payload);

  let rowIndex = findRowIndexBySid_(sheet, requestedSid);

  if (rowIndex < 2) {
    rowIndex = findRowIndexByCarNo_(sheet, requestedCarNo);
  }

  if (rowIndex < 2) {
    return createRow_(normalized);
  }

  writeRow_(sheet, headers, rowIndex, normalized);

  return {
    created: false,
    row: normalized,
  };
}

/*
 * 刪除資料。
 *
 * 優先使用 sid 尋找，找不到時再使用車號。
 */
function deleteRow_(payload) {
  const sheet = getSheet_();

  let rowIndex = findRowIndexBySid_(
    sheet,
    getRequestedSid_(payload)
  );

  if (rowIndex < 2) {
    rowIndex = findRowIndexByCarNo_(
      sheet,
      getRequestedCarNo_(payload)
    );
  }

  if (rowIndex < 2) {
    return null;
  }

  const deletedRow = readRow_(sheet, rowIndex);

  sheet.deleteRow(rowIndex);
  SpreadsheetApp.flush();

  return deletedRow;
}

/*
 * 寫入指定資料列。
 */
function writeRow_(sheet, headers, rowIndex, data) {
  const row = headers.map(function(header) {
    return data[header] || "";
  });

  sheet
    .getRange(rowIndex, 1, 1, row.length)
    .setValues([row]);

  SpreadsheetApp.flush();
}

/*
 * 依 sid 尋找資料列。
 */
function findRowIndexBySid_(sheet, sid) {
  const target = normalizeSid_(sid);

  if (!target) {
    return -1;
  }

  const headers = ensureHeaders_(sheet);
  const sidColumnIndex = headers.indexOf(FIELDS.sid);

  if (sidColumnIndex < 0 || sheet.getLastRow() < 2) {
    return -1;
  }

  const values = sheet
    .getRange(2, sidColumnIndex + 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  for (let index = 0; index < values.length; index++) {
    if (normalizeSid_(values[index][0]) === target) {
      return index + 2;
    }
  }

  return -1;
}

/*
 * 依車號尋找資料列。
 */
function findRowIndexByCarNo_(sheet, carNo) {
  const target = normalizeCarNo_(carNo);

  if (!target) {
    return -1;
  }

  const headers = ensureHeaders_(sheet);
  const carNoColumnIndex = headers.indexOf(FIELDS.carNo);

  if (carNoColumnIndex < 0 || sheet.getLastRow() < 2) {
    return -1;
  }

  const values = sheet
    .getRange(2, carNoColumnIndex + 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  for (let index = 0; index < values.length; index++) {
    if (normalizeCarNo_(values[index][0]) === target) {
      return index + 2;
    }
  }

  return -1;
}

/*
 * 讀取指定資料列。
 */
function readRow_(sheet, rowIndex) {
  const headers = ensureHeaders_(sheet);

  const values = sheet
    .getRange(rowIndex, 1, 1, headers.length)
    .getDisplayValues()[0];

  const item = {};

  headers.forEach(function(header, index) {
    item[header] = cleanValue_(values[index]);
  });

  return normalizeRow_(item);
}

/*
 * 確認試算表欄位順序。
 *
 * 若工作表完全空白，會自動建立表頭。
 * 若既有表頭順序不正確，會停止寫入並回傳錯誤，
 * 避免資料寫到錯誤欄位。
 */
function ensureHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0 || sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, FIELD_ORDER.length)
      .setValues([FIELD_ORDER]);

    return FIELD_ORDER.slice();
  }

  const readColumnCount = Math.max(lastColumn, FIELD_ORDER.length);

  const headers = sheet
    .getRange(1, 1, 1, readColumnCount)
    .getDisplayValues()[0]
    .map(cleanHeader_);

  FIELD_ORDER.forEach(function(expectedHeader, index) {
    const actualHeader = headers[index];

    if (actualHeader !== expectedHeader) {
      throw new Error(
        "試算表第 " +
        (index + 1) +
        " 欄應為「" +
        expectedHeader +
        "」，目前是「" +
        actualHeader +
        "」。"
      );
    }
  });

  return FIELD_ORDER.slice();
}

/*
 * 將傳入資料整理成固定欄位格式。
 */
function normalizeRow_(data) {
  data = data || {};

  const aliases = {
    sid: data.sid,
    車號: data["車號"] !== undefined ? data["車號"] : data.carnum,
    品牌: data["品牌"] !== undefined ? data["品牌"] : data.brand,
    車型: data["車型"] !== undefined ? data["車型"] : data.type,
    年份: data["年份"] !== undefined ? data["年份"] : data.yaer,
    排氣量: data["排氣量"] !== undefined ? data["排氣量"] : data.cc,
    顏色: data["顏色"] !== undefined ? data["顏色"] : data.c,
    里程數: data["里程數"] !== undefined ? data["里程數"] : data.miles,
    一手車: data["一手車"] !== undefined ? data["一手車"] : data.fhand,
    車況: data["車況"] !== undefined ? data["車況"] : data.sl,
    車況備注: data["車況備注"] !== undefined ? data["車況備注"] : data.note,
    車輛照片: data["車輛照片"] !== undefined ? data["車輛照片"] : data.imageweb,
    售價: data["售價"] !== undefined ? data["售價"] : data.op,
    發票: data["發票"] !== undefined ? data["發票"] : data.ticket,
    買進日: data["買進日"] !== undefined ? data["買進日"] : data.indate,
    來源: data["來源"] !== undefined ? data["來源"] : data.source,
    "8891": data["8891"] !== undefined ? data["8891"] : data.elseweb,
    線上購: data["線上購"] !== undefined ? data["線上購"] : data.onbuy,
  };

  const item = {};

  FIELD_ORDER.forEach(function(field) {
    item[field] = field === FIELDS.onlinePurchase
      ? normalizeOnlinePurchase_(aliases[field])
      : cleanValue_(aliases[field]);
  });

  return item;
}

function getRequestedSid_(payload) {
  const data = payload.data || {};

  return normalizeSid_(
    payload.sid ||
    data[FIELDS.sid] ||
    data.sid ||
    ""
  );
}

function getRequestedCarNo_(payload) {
  const data = payload.data || {};

  return normalizeCarNo_(
    payload.carNo ||
    data[FIELDS.carNo] ||
    data.carNo ||
    data.carnum ||
    ""
  );
}

function normalizeSid_(value) {
  return cleanValue_(value).replace(/[\s\u3000]+/g, "");
}

function normalizeCarNo_(value) {
  return cleanValue_(value)
    .replace(/[\s\u3000]+/g, "")
    .toUpperCase();
}

function cleanHeader_(value) {
  return cleanValue_(value);
}

function cleanValue_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeOnlinePurchase_(value) {
  const text = cleanValue_(value).toUpperCase();
  return ["0", "FALSE", "不可"].indexOf(text) >= 0 ? "0" : "1";
}

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("沒有收到 POST 資料。");
  }

  return JSON.parse(e.postData.contents);
}

function getSheet_() {
  const sheet = SpreadsheetApp
    .openById(SHEET_CONFIG.spreadsheetId)
    .getSheetByName(SHEET_CONFIG.sheetName);

  if (!sheet) {
    throw new Error(
      "找不到工作表：" + SHEET_CONFIG.sheetName
    );
  }

  return sheet;
}

function withWriteLock_(callback) {
  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getErrorMessage_(error) {
  if (error && error.message) {
    return error.message;
  }

  return String(error || "未知錯誤");
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
