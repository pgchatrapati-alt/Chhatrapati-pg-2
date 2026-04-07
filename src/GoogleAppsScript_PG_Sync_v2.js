// PG TENANT MANAGER — Google Apps Script v7
// SAFE WRITE: Never deletes data. Name-based update/append only.

function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var action, data;
    if (e.postData && e.postData.contents) {
      var b = JSON.parse(e.postData.contents);
      action = b.action; data = b.data;
    } else {
      action = e.parameter.action;
      data = e.parameter.data ? JSON.parse(e.parameter.data) : null;
    }
    if (action === "ping")  return makeResponse({ success: true, message: "Connected ✅" });
    if (action === "read")  return makeResponse(readAllData());
    if (action === "write" && data) return makeResponse(writeData(data));
    return makeResponse({ success: false, error: "Unknown action" });
  } catch(err) {
    return makeResponse({ success: false, error: err.message });
  }
}

// ── READ ──────────────────────────────────────────────────────
function readAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var DATA_START = 6; // rows 1-6 are fixed — data starts at row 7
  var allData = {};
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name.startsWith("_")) return;
    var rows = sheet.getDataRange().getValues();
    if (rows.length < 2) { allData[name] = []; return; }
    var tenants = [];
    var startIdx = DATA_START - 1; // 0-indexed
    for (var r = startIdx; r < rows.length; r++) {
      var row = rows[r];
      if (!row[0] || String(row[0]).trim() === '') continue;
      var fmtDate = function(v) {
        if (!v) return "";
        try { return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
        catch(e) { return String(v); }
      };
      var t = {
        name: String(row[0]||""), contact: String(row[1]||""),
        deposit: String(row[2]||""), rent: String(row[3]||""),
        dateJoining: fmtDate(row[4]), dateLeaving: fmtDate(row[5]),
        note: String(row[6]||""), monthly: {}
      };
      MONTHS.forEach(function(m, i) {
        var b = 7 + i*4;
        t.monthly[m] = {
          amount: String(row[b]||""), halfFull: String(row[b+1]||""),
          collector: String(row[b+2]||""), note: String(row[b+3]||"")
        };
      });
      tenants.push(t);
    }
    allData[name] = tenants;
  });
  return { success: true, data: allData };
}

// ── WRITE — PERMANENT SAFE: no clear, no delete, name-based ───
//
// For each PG sheet:
//   1. Read existing rows → build name→rowNum map
//   2. Each incoming tenant:
//      - Name exists in sheet → UPDATE that row only (merge, keep existing if blank)
//      - Name not found → INSERT new row at row 2 (pushes others down)
//   3. ZERO clearContent() calls — data is NEVER deleted
//
function writeData(pgData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
  var headers = ["Name","Contact","Deposit","Rent","Date Joining","Date Leaving","Note"];
  MONTHS.forEach(function(m) {
    headers.push(m+" Amount", m+" Half/Full", m+" Collector", m+" Note");
  });
  var NCOLS = headers.length; // 55
  var DATA_START = 6; // rows 1-6 fixed, data from row 7

  Object.keys(pgData).forEach(function(pgName) {
    try {
      // Skip if this PG has no tenants at all (prevent wiping sheets)
      var incoming = (pgData[pgName] || []).filter(function(t){ return t && t.name; });
      if (incoming.length === 0) return; // ← KEY: never process empty PG data

      var sheet = ss.getSheetByName(pgName);
      if (!sheet) sheet = ss.insertSheet(pgName);

      // Expand columns
      if (sheet.getMaxColumns() < NCOLS)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), NCOLS - sheet.getMaxColumns());

      // Rows 1-6 are fixed by user — we never touch them
      // Just ensure sheet has enough rows for data starting at row 7
      if (sheet.getMaxRows() < DATA_START)
        sheet.insertRowsAfter(sheet.getMaxRows(), DATA_START - sheet.getMaxRows());

      // Build name → rowNumber map from existing sheet
      var nameMap = {};
      var lastRow = sheet.getLastRow();
      if (lastRow >= DATA_START) {
        var numDataRows = lastRow - DATA_START + 1;
        var nameCol = sheet.getRange(DATA_START, 1, numDataRows, 1).getValues();
        for (var i = 0; i < nameCol.length; i++) {
          var n = String(nameCol[i][0]||"").trim().toLowerCase();
          if (n) nameMap[n] = DATA_START + i; // 1-based row number
        }
      }

      // Process each incoming tenant
      incoming.forEach(function(t) {
        var key = String(t.name).trim().toLowerCase();
        var isLeft = t.dateLeaving && String(t.dateLeaving).trim() !== "";

        if (nameMap[key]) {
          // ── UPDATE existing row ────────────────────────────
          var rowNum = nameMap[key];
          var existing = sheet.getRange(rowNum, 1, 1, NCOLS).getValues()[0];
          sheet.getRange(rowNum, 1, 1, NCOLS).setValues([buildRow(t, existing, MONTHS, isLeft)]);

        } else {
          // ── NEW tenant: insert at row 2 (top of data, below header) ─
          // This pushes existing rows down — no data lost
          sheet.insertRowAfter(DATA_START - 1);
          var emptyEx = new Array(NCOLS).fill("");
          sheet.getRange(DATA_START, 1, 1, NCOLS).setValues([buildRow(t, emptyEx, MONTHS, isLeft)]);
          nameMap[key] = DATA_START;
          Object.keys(nameMap).forEach(function(k) {
            if (k !== key) nameMap[k]++;
          });
        }
      });

    } catch(e) {
      Logger.log("ERROR " + pgName + ": " + e.message);
    }
  });

  return { success: true, message: "Saved ✅" };
}

// Merge incoming + existing. Blank incoming → keep existing.
function buildRow(t, ex, MONTHS, isLeft) {
  function s(val, fallback) {
    var v = String(val||"").trim();
    return v !== "" ? v : String(fallback||"");
  }
  var note = String(t.note||"").trim() || String(ex[6]||"");
  if (isLeft && note.indexOf("[LEFT]") === -1)
    note = note ? note + " [LEFT]" : "[LEFT]";

  var row = [s(t.name,ex[0]), s(t.contact,ex[1]), s(t.deposit,ex[2]),
             s(t.rent,ex[3]), s(t.dateJoining,ex[4]), s(t.dateLeaving,ex[5]), note];
  MONTHS.forEach(function(m, i) {
    var b = 7 + i*4;
    var md = (t.monthly && t.monthly[m]) || {};
    row.push(s(md.amount,ex[b]), s(md.halfFull,ex[b+1]),
             s(md.collector,ex[b+2]), s(md.note,ex[b+3]));
  });
  return row;
}

function styleHeader(sheet, ncols) {
  try {
    sheet.getRange(1,1,1,ncols)
      .setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } catch(e) {}
}
